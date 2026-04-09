//! Vault management Tauri commands.

use crate::state::AppState;
use cortex_core::types::{NoteData, VaultFile};
use cortex_core::vault::Vault;
use cortex_core::watcher::FileWatcher;
use cortex_graph::index::LinkIndex;
use cortex_search::indexer::SearchIndex;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::State;

/// Merge Cortex hook entries into .claude/settings.json (non-destructively).
fn write_claude_settings(vault_path: &Path) -> anyhow::Result<()> {
    let claude_dir = vault_path.join(".claude");
    std::fs::create_dir_all(&claude_dir)?;
    let settings_path = claude_dir.join("settings.json");

    // Read existing JSON or start with empty object.
    let mut settings: serde_json::Value = if settings_path.exists() {
        let raw = std::fs::read_to_string(&settings_path)?;
        serde_json::from_str(&raw).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure top-level "hooks" object exists.
    if !settings.get("hooks").is_some_and(|v| v.is_object()) {
        settings["hooks"] = serde_json::json!({});
    }
    let hooks = settings["hooks"].as_object_mut().unwrap();

    // Hook event → route mapping.
    let hook_entries = [
        ("SessionStart", "session-start"),
        ("UserPromptSubmit", "prompt"),
        ("PostToolUse", "tool-use"),
        ("Stop", "session-end"),
    ];

    for (event, route) in hook_entries {
        let url = format!("http://localhost:3847/hooks/{}", route);

        // Get or create the array for this event.
        if !hooks.get(event).is_some_and(|v| v.is_array()) {
            hooks.insert(event.to_string(), serde_json::json!([]));
        }
        let arr = hooks.get_mut(event).unwrap().as_array_mut().unwrap();

        // Idempotency: skip if any existing entry already has this URL.
        let already_present = arr.iter().any(|entry| {
            entry
                .get("hooks")
                .and_then(|h| h.as_array())
                .map(|inner| {
                    inner
                        .iter()
                        .any(|h| h.get("url").and_then(|u| u.as_str()) == Some(&url))
                })
                .unwrap_or(false)
        });

        if !already_present {
            arr.push(serde_json::json!({
                "hooks": [{ "type": "http", "url": url }]
            }));
        }
    }

    let pretty = serde_json::to_string_pretty(&settings)?;
    std::fs::write(&settings_path, pretty)?;
    log::info!("Wrote .claude/settings.json at {:?}", settings_path);
    Ok(())
}

/// Open a vault at the given path, start the file watcher, and return the file listing.
#[tauri::command]
#[specta::specta]
pub async fn open_vault(
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<VaultFile>, String> {
    let vault_path = PathBuf::from(&path);
    let vault = Vault::open(vault_path.clone()).map_err(|e| e.to_string())?;
    let files = vault.list_files().map_err(|e| e.to_string())?;

    // Start file watcher.
    let tx = state.vault_event_tx.clone();
    let watcher = FileWatcher::new(vault_path.clone(), tx).map_err(|e| e.to_string())?;

    // Build link index from the vault.
    let link_index =
        LinkIndex::build_from_vault(&vault_path).map_err(|e| e.to_string())?;
    log::info!("LinkIndex built: {} notes indexed", link_index.note_count());

    // Build search index for this vault.
    let index_path = vault_path.join(".cortex").join("search-index");
    std::fs::create_dir_all(&index_path).map_err(|e| e.to_string())?;
    let search_idx = SearchIndex::new(&index_path).map_err(|e| e.to_string())?;
    search_idx
        .build_from_vault(&vault_path)
        .map_err(|e| e.to_string())?;
    log::info!("SearchIndex built for vault: {}", path);

    // Store vault, watcher, link index, and search index in state.
    {
        let mut v = state.vault.lock().map_err(|e| e.to_string())?;
        *v = Some(vault);
    }
    {
        let mut w = state.watcher.lock().map_err(|e| e.to_string())?;
        *w = Some(watcher);
    }
    {
        let mut idx = state.link_index.write().map_err(|e| e.to_string())?;
        *idx = Some(link_index);
    }
    {
        let mut si = state.search_index.lock().map_err(|e| e.to_string())?;
        *si = Some(search_idx);
    }

    // Reload the typed knowledge graph from this vault's .cortex/kg.json.
    // Without this, opening a new vault leaves the in-memory KG holding the
    // previous vault's state, which silently breaks SessionStart context injection.
    {
        let kg_path = vault_path.join(".cortex").join("kg.json");
        let loaded = if kg_path.exists() {
            match cortex_kg::TypedKnowledgeGraph::load(&kg_path) {
                Ok(kg) => {
                    log::info!("Reloaded knowledge graph from {:?}", kg_path);
                    kg
                }
                Err(e) => {
                    log::warn!("Failed to load KG from {:?}: {}", kg_path, e);
                    cortex_kg::TypedKnowledgeGraph::new()
                }
            }
        } else {
            log::info!("No KG at {:?}, starting empty", kg_path);
            cortex_kg::TypedKnowledgeGraph::new()
        };
        if let Ok(mut guard) = state.knowledge_graph.write() {
            *guard = Some(loaded);
        }
    }

    // Write .claude/settings.json with Cortex hook entries (non-destructive).
    if let Err(e) = write_claude_settings(&vault_path) {
        log::warn!("Failed to write .claude/settings.json: {}", e);
    }

    Ok(files)
}

/// List all files in the currently open vault.
#[tauri::command]
#[specta::specta]
pub async fn list_files(state: State<'_, Arc<AppState>>) -> Result<Vec<VaultFile>, String> {
    let vault_guard = state.vault.lock().map_err(|e| e.to_string())?;
    let vault = vault_guard
        .as_ref()
        .ok_or_else(|| "No vault is currently open".to_string())?;
    vault.list_files().map_err(|e| e.to_string())
}

/// Read a note from the vault and return its content with parsed frontmatter.
#[tauri::command]
#[specta::specta]
pub async fn read_note(path: String, state: State<'_, Arc<AppState>>) -> Result<NoteData, String> {
    let vault_guard = state.vault.lock().map_err(|e| e.to_string())?;
    let vault = vault_guard
        .as_ref()
        .ok_or_else(|| "No vault is currently open".to_string())?;
    let note = vault.read_note(&path).map_err(|e| e.to_string())?;
    Ok(NoteData {
        content: note.content,
        frontmatter: note.frontmatter,
    })
}

/// Write content to a note in the vault (atomic write).
#[tauri::command]
#[specta::specta]
pub async fn write_note(
    path: String,
    content: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let vault_guard = state.vault.lock().map_err(|e| e.to_string())?;
    let vault = vault_guard
        .as_ref()
        .ok_or_else(|| "No vault is currently open".to_string())?;
    vault.write_note(&path, &content).map_err(|e| e.to_string())
}

/// Create a new note with the given title and optional folder.
/// Returns the relative path of the created note.
#[tauri::command]
#[specta::specta]
pub async fn create_note(
    title: String,
    folder: Option<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let vault_guard = state.vault.lock().map_err(|e| e.to_string())?;
    let vault = vault_guard
        .as_ref()
        .ok_or_else(|| "No vault is currently open".to_string())?;
    vault
        .create_note(&title, folder.as_deref())
        .map_err(|e| e.to_string())
}

/// Rename (move) a note from one path to another.
#[tauri::command]
#[specta::specta]
pub async fn rename_note(
    old_path: String,
    new_path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let vault_guard = state.vault.lock().map_err(|e| e.to_string())?;
    let vault = vault_guard
        .as_ref()
        .ok_or_else(|| "No vault is currently open".to_string())?;
    vault
        .rename_note(&old_path, &new_path)
        .map_err(|e| e.to_string())
}

/// Delete a note by its relative path.
#[tauri::command]
#[specta::specta]
pub async fn delete_note(path: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let vault_guard = state.vault.lock().map_err(|e| e.to_string())?;
    let vault = vault_guard
        .as_ref()
        .ok_or_else(|| "No vault is currently open".to_string())?;
    vault.delete_note(&path).map_err(|e| e.to_string())
}

/// Create a folder inside the vault.
#[tauri::command]
#[specta::specta]
pub async fn create_folder(path: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let vault_guard = state.vault.lock().map_err(|e| e.to_string())?;
    let vault = vault_guard
        .as_ref()
        .ok_or_else(|| "No vault is currently open".to_string())?;
    vault.create_folder(&path).map_err(|e| e.to_string())
}
