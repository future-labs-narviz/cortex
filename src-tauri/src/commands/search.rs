//! Search-related Tauri commands.

use crate::state::AppState;
use cortex_search::types::SearchResult;
use std::sync::Arc;
use tauri::State;

/// Full-text search across all indexed notes in the vault.
///
/// Returns up to `limit` results (default 20) ranked by relevance.
#[tauri::command]
#[specta::specta]
pub async fn full_text_search(
    query: String,
    limit: Option<u32>,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<SearchResult>, String> {
    let limit = limit.unwrap_or(20) as usize;

    let index_guard = state.search_index.lock().map_err(|e| e.to_string())?;
    let index = index_guard
        .as_ref()
        .ok_or_else(|| "Search index not initialized. Open a vault first.".to_string())?;

    index.search(&query, limit).map_err(|e| e.to_string())
}

/// Rebuild the full search index from all vault files.
#[tauri::command]
#[specta::specta]
pub async fn rebuild_search_index(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let vault_path = {
        let vault_guard = state.vault.lock().map_err(|e| e.to_string())?;
        let vault = vault_guard
            .as_ref()
            .ok_or_else(|| "No vault is currently open".to_string())?;
        vault.root().to_path_buf()
    };

    let index_guard = state.search_index.lock().map_err(|e| e.to_string())?;
    let index = index_guard
        .as_ref()
        .ok_or_else(|| "Search index not initialized".to_string())?;

    index
        .build_from_vault(&vault_path)
        .map_err(|e| e.to_string())
}
