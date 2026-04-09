//! Cortex - Tauri application library.
//!
//! This is the main entry point for the Tauri app, setting up plugins,
//! commands, and the MCP server.

mod commands;
mod mcp;
mod run;
mod state;

use cortex_core::vault::Vault;
use cortex_core::watcher::VaultEvent;
use cortex_search::indexer::SearchIndex;
#[cfg(debug_assertions)]
use specta_typescript::Typescript;
use state::AppState;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tauri_specta::{collect_commands, Builder};

/// Tauri command: get the application version.
#[tauri::command]
#[specta::specta]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Tauri command: check if the MCP server is running.
#[tauri::command]
#[specta::specta]
async fn is_mcp_running(state: tauri::State<'_, Arc<AppState>>) -> Result<bool, String> {
    Ok(state.is_mcp_running())
}

/// Determine the vault path. Uses `~/Desktop/Cortex/vault` by default.
fn vault_path() -> PathBuf {
    dirs::desktop_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Cortex")
        .join("vault")
}

/// Run the Tauri application.
///
/// # Errors
/// Returns an error if Tauri setup fails.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load env vars from ~/Desktop/Cortex/.env (GUI-launched .app has barebones env).
    if let Some(home) = dirs::home_dir() {
        let env_path = home.join("Desktop").join("Cortex").join(".env");
        if env_path.exists() {
            match dotenvy::from_path(&env_path) {
                Ok(_) => log::info!("Loaded env from {:?}", env_path),
                Err(e) => log::warn!("Failed to load env from {:?}: {}", env_path, e),
            }
        } else {
            log::info!("No .env at {:?} (extract pipeline will be disabled)", env_path);
        }
    }

    // Set up specta type export and command builder.
    let specta_builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        get_app_version,
        is_mcp_running,
        commands::vault::open_vault,
        commands::vault::list_files,
        commands::vault::read_note,
        commands::vault::write_note,
        commands::vault::create_note,
        commands::vault::rename_note,
        commands::vault::delete_note,
        commands::vault::create_folder,
        commands::editor::save_note,
        commands::search::full_text_search,
        commands::search::rebuild_search_index,
        commands::graph::get_backlinks,
        commands::graph::get_graph_data,
        commands::graph::get_all_tags,
        commands::graph::get_notes_by_tag,
        commands::daily::create_daily_note,
        commands::daily::list_templates,
        commands::daily::create_from_template,
        commands::voice::voice_start_recording,
        commands::voice::voice_stop_recording,
        commands::voice::voice_cancel_recording,
        commands::voice::voice_get_devices,
        commands::voice::voice_is_recording,
        commands::kg::get_kg_graph_data,
        commands::kg::get_entity_profile,
        commands::kg::get_kg_stats,
        commands::sessions::list_session_notes,
        commands::sessions::get_session_note,
        commands::plans::list_plan_notes,
        commands::plans::create_plan_note,
        commands::plans::load_run_transcript,
        run::execute::execute_plan,
        run::execute::abort_run,
    ]);

    #[cfg(debug_assertions)]
    specta_builder
        .export(Typescript::default(), "../src/bindings.ts")
        .expect("Failed to export TypeScript bindings");

    let invoke_handler = specta_builder.invoke_handler();

    // Initialize the vault.
    let vault_dir = vault_path();
    let _vault = Vault::new(vault_dir).expect("Failed to initialize vault");

    // Create the centralized app state wrapped in Arc.
    // Commands use State<'_, Arc<AppState>> and auto-deref to access fields.
    // The MCP server also takes Arc<AppState> directly.
    let app_state = Arc::new(AppState::new());
    let vault_event_tx = app_state.vault_event_tx.clone();
    let mcp_app_state = app_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(invoke_handler)
        .manage(app_state)
        .setup(move |app| {
            // Register specta events.
            specta_builder.mount_events(app);

            // Store the app handle in AppState so the MCP server can emit events.
            {
                let state: tauri::State<Arc<AppState>> = app.state();
                let app_state: Arc<AppState> = state.inner().clone();
                drop(state);
                let handle = app.handle().clone();
                let lock_result = app_state.app_handle.lock();
                if let Ok(mut guard) = lock_result {
                    *guard = Some(handle);
                }
            }

            // Initialize sub-crates.
            cortex_core::init();
            cortex_search::init();
            cortex_graph::init();
            cortex_voice::init();
            cortex_kg::init();

            // Build the search index for the default vault.
            {
                let vault_dir = vault_path();
                let index_path = vault_dir.join(".cortex").join("search-index");
                match SearchIndex::new(&index_path) {
                    Ok(search_index) => {
                        if let Err(e) = search_index.build_from_vault(&vault_dir) {
                            log::error!("Failed to build search index: {}", e);
                        }
                        let state: tauri::State<Arc<AppState>> = app.state();
                        let app_state: Arc<AppState> = state.inner().clone();
                        drop(state);
                        if let Ok(mut guard) = app_state.search_index.lock() {
                            *guard = Some(search_index);
                        };
                    }
                    Err(e) => {
                        log::error!("Failed to create search index: {}", e);
                    }
                }
            }

            // Spawn vault event forwarding to Tauri events.
            let app_handle = app.handle().clone();
            let mut vault_event_rx = vault_event_tx.subscribe();
            tauri::async_runtime::spawn(async move {
                loop {
                    match vault_event_rx.recv().await {
                        Ok(event) => {
                            let (event_name, payload) = match &event {
                                VaultEvent::Created(path) => {
                                    ("vault:file-created", path.clone())
                                }
                                VaultEvent::Modified(path) => {
                                    ("vault:file-modified", path.clone())
                                }
                                VaultEvent::Deleted(path) => {
                                    ("vault:file-deleted", path.clone())
                                }
                                VaultEvent::Renamed(old, new) => {
                                    ("vault:file-renamed", format!("{}:{}", old, new))
                                }
                            };
                            if let Err(e) = app_handle.emit(event_name, &payload) {
                                log::error!("Failed to emit vault event: {}", e);
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                            log::warn!("Vault event receiver lagged, missed {} events", n);
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                            log::info!("Vault event channel closed");
                            break;
                        }
                    }
                }
            });

            // Spawn incremental search index updater.
            {
                let search_app_handle = app.handle().clone();
                let mut search_event_rx = vault_event_tx.subscribe();
                tauri::async_runtime::spawn(async move {
                    loop {
                        match search_event_rx.recv().await {
                            Ok(event) => {
                                let state: tauri::State<Arc<AppState>> = search_app_handle.state();
                                handle_search_index_event(&state, &event);
                            }
                            Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                                log::warn!(
                                    "Search index event receiver lagged, missed {} events",
                                    n
                                );
                            }
                            Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                                log::info!("Search index event channel closed");
                                break;
                            }
                        }
                    }
                });
            }

            // Spawn incremental link index updater.
            {
                let link_app_handle = app.handle().clone();
                let mut link_event_rx = vault_event_tx.subscribe();
                tauri::async_runtime::spawn(async move {
                    loop {
                        match link_event_rx.recv().await {
                            Ok(event) => {
                                let state: tauri::State<Arc<AppState>> = link_app_handle.state();
                                handle_link_index_event(&state, &event);
                            }
                            Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                                log::warn!(
                                    "Link index event receiver lagged, missed {} events",
                                    n
                                );
                            }
                            Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                                log::info!("Link index event channel closed");
                                break;
                            }
                        }
                    }
                });
            }

            // Load knowledge graph from persistence.
            {
                let vault_dir = vault_path();
                let kg_path = vault_dir.join(".cortex").join("kg.json");
                let state: tauri::State<Arc<AppState>> = app.state();
                let app_state: Arc<AppState> = state.inner().clone();
                drop(state);
                if kg_path.exists() {
                    match cortex_kg::TypedKnowledgeGraph::load(&kg_path) {
                        Ok(kg) => {
                            if let Ok(mut guard) = app_state.knowledge_graph.write() {
                                *guard = Some(kg);
                                log::info!("Loaded knowledge graph from {:?}", kg_path);
                            }
                        }
                        Err(e) => {
                            log::warn!("Failed to load knowledge graph: {}", e);
                            if let Ok(mut guard) = app_state.knowledge_graph.write() {
                                *guard = Some(cortex_kg::TypedKnowledgeGraph::new());
                            }
                        }
                    }
                } else {
                    if let Ok(mut guard) = app_state.knowledge_graph.write() {
                        *guard = Some(cortex_kg::TypedKnowledgeGraph::new());
                    }
                }
            }

            // Spawn knowledge graph invalidation on vault events.
            {
                let kg_app_handle = app.handle().clone();
                let mut kg_event_rx = vault_event_tx.subscribe();
                tauri::async_runtime::spawn(async move {
                    loop {
                        match kg_event_rx.recv().await {
                            Ok(event) => {
                                let state: tauri::State<Arc<AppState>> =
                                    kg_app_handle.state();
                                match &event {
                                    VaultEvent::Modified(path) => {
                                        if path.ends_with(".md") {
                                            if let Ok(mut kg) =
                                                state.knowledge_graph.write()
                                            {
                                                if let Some(kg) = kg.as_mut() {
                                                    kg.invalidate_note(path);
                                                    log::debug!(
                                                        "KG invalidated note: {}",
                                                        path
                                                    );
                                                }
                                            }
                                        }
                                    }
                                    VaultEvent::Deleted(path) => {
                                        if path.ends_with(".md") {
                                            if let Ok(mut kg) =
                                                state.knowledge_graph.write()
                                            {
                                                if let Some(kg) = kg.as_mut() {
                                                    kg.invalidate_note(path);
                                                }
                                            }
                                        }
                                    }
                                    _ => {}
                                }
                            }
                            Err(
                                tokio::sync::broadcast::error::RecvError::Lagged(n),
                            ) => {
                                log::warn!(
                                    "KG event receiver lagged, missed {} events",
                                    n
                                );
                            }
                            Err(
                                tokio::sync::broadcast::error::RecvError::Closed,
                            ) => {
                                break;
                            }
                        }
                    }
                });
            }

            // Spawn the MCP server on a background tokio task.
            tauri::async_runtime::spawn(async move {
                mcp_app_state.set_mcp_running(true);

                if let Err(e) = mcp::start_mcp_server(mcp_app_state.clone()).await {
                    log::error!("MCP server error: {}", e);
                    mcp_app_state.set_mcp_running(false);
                }
            });

            log::info!("Cortex app setup complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Handle a vault file event by updating the search index incrementally.
fn handle_search_index_event(state: &AppState, event: &VaultEvent) {
    let index_guard = match state.search_index.lock() {
        Ok(g) => g,
        Err(e) => {
            log::error!("Failed to lock search index: {}", e);
            return;
        }
    };
    let index = match index_guard.as_ref() {
        Some(i) => i,
        None => return, // No index available yet.
    };

    let vault_guard = match state.vault.lock() {
        Ok(g) => g,
        Err(e) => {
            log::error!("Failed to lock vault: {}", e);
            return;
        }
    };
    let vault = match vault_guard.as_ref() {
        Some(v) => v,
        None => return,
    };

    match event {
        VaultEvent::Created(rel_path) | VaultEvent::Modified(rel_path) => {
            match vault.read_note(rel_path) {
                Ok(note) => {
                    let tags: Vec<String> = note
                        .frontmatter
                        .as_ref()
                        .map(|fm| fm.tags.clone())
                        .unwrap_or_default();
                    if let Err(e) =
                        index.index_note(&note.path, &note.title, &note.content, &tags)
                    {
                        log::error!("Failed to index note {}: {}", rel_path, e);
                    }
                }
                Err(e) => {
                    log::warn!("Failed to read note for indexing {}: {}", rel_path, e);
                }
            }
        }
        VaultEvent::Deleted(rel_path) => {
            if let Err(e) = index.remove_note(rel_path) {
                log::error!("Failed to remove note from index {}: {}", rel_path, e);
            }
        }
        VaultEvent::Renamed(old_path, new_path) => {
            if let Err(e) = index.remove_note(old_path) {
                log::error!(
                    "Failed to remove old path from index {}: {}",
                    old_path,
                    e
                );
            }
            match vault.read_note(new_path) {
                Ok(note) => {
                    let tags: Vec<String> = note
                        .frontmatter
                        .as_ref()
                        .map(|fm| fm.tags.clone())
                        .unwrap_or_default();
                    if let Err(e) =
                        index.index_note(&note.path, &note.title, &note.content, &tags)
                    {
                        log::error!("Failed to index renamed note {}: {}", new_path, e);
                    }
                }
                Err(e) => {
                    log::warn!(
                        "Failed to read renamed note for indexing {}: {}",
                        new_path,
                        e
                    );
                }
            }
        }
    }
}

/// Handle a vault file event by updating the link index incrementally.
fn handle_link_index_event(state: &AppState, event: &VaultEvent) {
    let vault_root = {
        let vault_guard = match state.vault.lock() {
            Ok(g) => g,
            Err(e) => {
                log::error!("Failed to lock vault for link index: {}", e);
                return;
            }
        };
        match vault_guard.as_ref() {
            Some(v) => v.root().to_path_buf(),
            None => return,
        }
    };

    let mut index_guard = match state.link_index.write() {
        Ok(g) => g,
        Err(e) => {
            log::error!("Failed to write-lock link index: {}", e);
            return;
        }
    };
    let index = match index_guard.as_mut() {
        Some(i) => i,
        None => return,
    };

    match event {
        VaultEvent::Created(rel_path) | VaultEvent::Modified(rel_path) => {
            if !rel_path.ends_with(".md") {
                return;
            }
            let full_path = vault_root.join(rel_path);
            match std::fs::read_to_string(&full_path) {
                Ok(content) => {
                    let title = std::path::Path::new(rel_path)
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| rel_path.clone());
                    index.update_note(rel_path, &title, &content);
                    log::debug!("LinkIndex updated for: {}", rel_path);
                }
                Err(e) => {
                    log::warn!("Failed to read note for link indexing {}: {}", rel_path, e);
                }
            }
        }
        VaultEvent::Deleted(rel_path) => {
            index.remove_note(rel_path);
            log::debug!("LinkIndex removed: {}", rel_path);
        }
        VaultEvent::Renamed(old_path, new_path) => {
            index.remove_note(old_path);
            if new_path.ends_with(".md") {
                let full_path = vault_root.join(new_path);
                if let Ok(content) = std::fs::read_to_string(&full_path) {
                    let title = std::path::Path::new(new_path)
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| new_path.clone());
                    index.update_note(new_path, &title, &content);
                }
            }
            log::debug!("LinkIndex renamed: {} -> {}", old_path, new_path);
        }
    }
}
