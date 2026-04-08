//! Editor-related Tauri commands.

use crate::state::AppState;
use std::sync::Arc;
use tauri::{Emitter, State};

/// Save a note and emit a "note-saved" event to the frontend.
#[tauri::command]
#[specta::specta]
pub async fn save_note(
    path: String,
    content: String,
    state: State<'_, Arc<AppState>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    {
        let vault_guard = state.vault.lock().map_err(|e| e.to_string())?;
        let vault = vault_guard
            .as_ref()
            .ok_or_else(|| "No vault is currently open".to_string())?;
        vault
            .write_note(&path, &content)
            .map_err(|e| e.to_string())?;
    }

    // Emit a "note-saved" event to the frontend.
    app.emit("note-saved", &path)
        .map_err(|e| e.to_string())?;

    Ok(())
}
