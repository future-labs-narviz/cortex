//! Knowledge graph Tauri commands.

use crate::state::AppState;
use cortex_kg::{KgEntityProfile, KgGraphData, KgStats};
use std::sync::Arc;
use tauri::State;

/// Get typed graph data for D3 visualization.
#[tauri::command]
#[specta::specta]
pub async fn get_kg_graph_data(
    state: State<'_, Arc<AppState>>,
) -> Result<KgGraphData, String> {
    let kg_guard = state
        .knowledge_graph
        .read()
        .map_err(|e| format!("Failed to lock knowledge graph: {e}"))?;
    let kg = kg_guard
        .as_ref()
        .ok_or_else(|| "Knowledge graph not initialized.".to_string())?;
    Ok(kg.to_graph_data())
}

/// Get the profile for a specific entity.
#[tauri::command]
#[specta::specta]
pub async fn get_entity_profile(
    name: String,
    state: State<'_, Arc<AppState>>,
) -> Result<KgEntityProfile, String> {
    let kg_guard = state
        .knowledge_graph
        .read()
        .map_err(|e| format!("Failed to lock knowledge graph: {e}"))?;
    let kg = kg_guard
        .as_ref()
        .ok_or_else(|| "Knowledge graph not initialized.".to_string())?;
    kg.entity_profile(&name)
        .ok_or_else(|| format!("Entity '{}' not found", name))
}

/// Get knowledge graph stats.
#[tauri::command]
#[specta::specta]
pub async fn get_kg_stats(
    state: State<'_, Arc<AppState>>,
) -> Result<KgStats, String> {
    let kg_guard = state
        .knowledge_graph
        .read()
        .map_err(|e| format!("Failed to lock knowledge graph: {e}"))?;
    let kg = kg_guard
        .as_ref()
        .ok_or_else(|| "Knowledge graph not initialized.".to_string())?;

    // Count unprocessed by getting all vault notes.
    let all_notes = {
        let vault_guard = state
            .vault
            .lock()
            .map_err(|e| format!("Failed to lock vault: {e}"))?;
        match vault_guard.as_ref() {
            Some(vault) => {
                let files = vault.list_files().map_err(|e| e.to_string())?;
                files
                    .iter()
                    .filter(|f| !f.is_dir && f.path.ends_with(".md"))
                    .map(|f| f.path.clone())
                    .collect::<Vec<_>>()
            }
            None => Vec::new(),
        }
    };

    let unprocessed = kg.get_unprocessed_notes(&all_notes);

    Ok(KgStats {
        entity_count: kg.entity_count() as u32,
        relation_count: kg.relation_count() as u32,
        processed_count: kg.processed_count() as u32,
        unprocessed_count: unprocessed.len() as u32,
    })
}
