//! Session notes Tauri commands.

use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SessionSummary {
    pub session_id: String,
    pub path: String,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
    pub goal: Option<String>,
    pub note_type: String, // "session" | "retrospective"
    /// Plan note path for Phase B-spawned sessions; None for Phase A
    /// interactive sessions. Lets the frontend route Phase B sessions
    /// to the live transcript replay view.
    pub plan_ref: Option<String>,
    /// Vault-relative path to the persisted JSONL transcript, if any.
    /// Phase B writes one to `sessions/<run_id>.jsonl`; Phase A does not.
    pub transcript_path: Option<String>,
    /// Status from the session note frontmatter. `running`, `complete`,
    /// `failed`, `aborted`, or empty string if not set.
    pub status: String,
}

/// List all session/retrospective notes from <vault>/sessions/.
#[tauri::command]
#[specta::specta]
pub async fn list_session_notes(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<SessionSummary>, String> {
    let vault_guard = state.vault.lock().map_err(|e| e.to_string())?;
    let vault = match vault_guard.as_ref() {
        Some(v) => v,
        None => return Ok(vec![]),
    };

    let sessions_dir = vault.root().join("sessions");
    if !sessions_dir.exists() {
        return Ok(vec![]);
    }

    let mut summaries: Vec<SessionSummary> = Vec::new();

    let entries = std::fs::read_dir(&sessions_dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().map_or(true, |ext| ext != "md") {
            continue;
        }

        // Build vault-relative path.
        let rel_path = match path.strip_prefix(vault.root()) {
            Ok(p) => p.to_string_lossy().to_string(),
            Err(_) => continue,
        };

        let note = match vault.read_note(&rel_path) {
            Ok(n) => n,
            Err(e) => {
                log::warn!("Failed to read session note {}: {}", rel_path, e);
                continue;
            }
        };

        let fm = match note.frontmatter.as_ref() {
            Some(fm) => fm,
            None => continue,
        };

        let note_type = fm.extra.get("type").cloned().unwrap_or_default();
        if note_type != "session" && note_type != "retrospective" {
            continue;
        }

        let session_id = fm
            .extra
            .get("session_id")
            .cloned()
            .unwrap_or_else(|| note.title.clone());
        let started_at = fm.extra.get("started_at").cloned();
        let ended_at = fm.extra.get("ended_at").cloned();
        let goal = fm.extra.get("goal").cloned();
        let plan_ref = fm.extra.get("plan_ref").cloned();
        let transcript_path = fm.extra.get("transcript_path").cloned();
        let status = fm.extra.get("status").cloned().unwrap_or_default();

        summaries.push(SessionSummary {
            session_id,
            path: rel_path,
            started_at,
            ended_at,
            goal,
            note_type,
            plan_ref,
            transcript_path,
            status,
        });
    }

    // Sort by started_at descending (ISO strings sort lexicographically).
    summaries.sort_by(|a, b| b.started_at.cmp(&a.started_at));

    Ok(summaries)
}

/// Read the raw content of a session note by vault-relative path.
#[tauri::command]
#[specta::specta]
pub async fn get_session_note(
    path: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let vault_guard = state.vault.lock().map_err(|e| e.to_string())?;
    let vault = vault_guard
        .as_ref()
        .ok_or_else(|| "No vault is currently open".to_string())?;
    let note = vault.read_note(&path).map_err(|e| e.to_string())?;
    Ok(note.content)
}
