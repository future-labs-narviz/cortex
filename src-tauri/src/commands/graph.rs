//! Graph and backlinks Tauri commands.

use crate::state::AppState;
use cortex_graph::types::{Backlink, GraphData, TagInfo};
use std::sync::Arc;
use tauri::State;

/// Get all backlinks for a given note.
#[tauri::command]
#[specta::specta]
pub async fn get_backlinks(
    note_path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<Backlink>, String> {
    let index_guard = state.link_index.read().map_err(|e| e.to_string())?;
    let index = index_guard
        .as_ref()
        .ok_or_else(|| "Link index not built yet (open a vault first)".to_string())?;
    let backlinks = index.get_backlinks(&note_path);
    log::info!("get_backlinks('{}') → {} results", note_path, backlinks.len());
    Ok(backlinks)
}

/// Get graph data for visualization.
///
/// If `center` is provided, returns a subgraph centered on that note up to `depth` hops.
/// If `center` is `None`, returns the full graph.
#[tauri::command]
#[specta::specta]
pub async fn get_graph_data(
    center: Option<String>,
    depth: u32,
    state: State<'_, Arc<AppState>>,
) -> Result<GraphData, String> {
    let index_guard = state.link_index.read().map_err(|e| e.to_string())?;
    let index = index_guard
        .as_ref()
        .ok_or_else(|| "Link index not built yet (open a vault first)".to_string())?;
    Ok(index.get_graph_data(center.as_deref(), depth))
}

/// Get all tags in the vault with their occurrence counts.
#[tauri::command]
#[specta::specta]
pub async fn get_all_tags(state: State<'_, Arc<AppState>>) -> Result<Vec<TagInfo>, String> {
    let index_guard = state.link_index.read().map_err(|e| e.to_string())?;
    let index = index_guard
        .as_ref()
        .ok_or_else(|| "Link index not built yet (open a vault first)".to_string())?;
    let tags = index.get_all_tags();
    log::info!("get_all_tags() → {} tags", tags.len());
    Ok(tags)
}

/// Get all note paths that have a specific tag.
#[tauri::command]
#[specta::specta]
pub async fn get_notes_by_tag(
    tag: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<String>, String> {
    let index_guard = state.link_index.read().map_err(|e| e.to_string())?;
    let index = index_guard
        .as_ref()
        .ok_or_else(|| "Link index not built yet (open a vault first)".to_string())?;
    Ok(index.get_notes_by_tag(&tag))
}
