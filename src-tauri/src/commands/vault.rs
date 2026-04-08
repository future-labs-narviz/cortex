//! Vault management Tauri commands.

use crate::state::AppState;
use cortex_core::types::{NoteData, VaultFile};
use cortex_core::vault::Vault;
use cortex_core::watcher::FileWatcher;
use cortex_graph::index::LinkIndex;
use cortex_search::indexer::SearchIndex;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;

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
