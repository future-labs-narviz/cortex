//! Plan note Tauri commands.

use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PlanSummary {
    pub path: String,
    pub title: String,
    pub goal: Option<String>,
    pub status: String,
    pub model: Option<String>,
    pub last_run_id: Option<String>,
    pub last_run_at: Option<String>,
}

/// List all `type:plan` notes anywhere in the vault. Walks the tree
/// recursively (markdown only) and inspects frontmatter to discriminate.
#[tauri::command]
#[specta::specta]
pub async fn list_plan_notes(
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<PlanSummary>, String> {
    let vault_root = {
        let guard = state.vault.lock().map_err(|e| e.to_string())?;
        match guard.as_ref() {
            Some(v) => v.root().to_path_buf(),
            None => return Ok(vec![]),
        }
    };

    let vault = match cortex_core::vault::Vault::new(vault_root.clone()) {
        Ok(v) => v,
        Err(e) => return Err(e.to_string()),
    };

    let mut summaries: Vec<PlanSummary> = Vec::new();
    walk_for_plans(&vault_root, &vault_root, &vault, &mut summaries);

    // Sort by status (running first, then ready, etc.) then path.
    summaries.sort_by(|a, b| {
        let a_rank = status_rank(&a.status);
        let b_rank = status_rank(&b.status);
        a_rank.cmp(&b_rank).then_with(|| a.path.cmp(&b.path))
    });

    Ok(summaries)
}

fn status_rank(s: &str) -> u8 {
    match s {
        "running" => 0,
        "ready" => 1,
        "draft" => 2,
        "complete" => 3,
        "failed" => 4,
        "aborted" => 5,
        _ => 6,
    }
}

fn walk_for_plans(
    base: &std::path::Path,
    dir: &std::path::Path,
    vault: &cortex_core::vault::Vault,
    out: &mut Vec<PlanSummary>,
) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        if name_str.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            if name_str == "node_modules" || name_str == "target" {
                continue;
            }
            walk_for_plans(base, &path, vault, out);
            continue;
        }
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }

        let rel = match path.strip_prefix(base) {
            Ok(p) => p.to_string_lossy().to_string(),
            Err(_) => continue,
        };

        let note = match vault.read_note(&rel) {
            Ok(n) => n,
            Err(_) => continue,
        };

        let fm = match note.frontmatter.as_ref() {
            Some(f) => f,
            None => continue,
        };

        let note_type = fm.extra.get("type").cloned().unwrap_or_default();
        if note_type != "plan" {
            continue;
        }

        let title = fm
            .extra
            .get("title")
            .cloned()
            .unwrap_or_else(|| note.title.clone());
        let goal = fm.extra.get("goal").cloned();
        let status = fm
            .extra
            .get("status")
            .cloned()
            .unwrap_or_else(|| "draft".to_string());
        let model = fm.extra.get("model").cloned();
        let last_run_id = fm.extra.get("last_run_id").cloned();
        let last_run_at = fm.extra.get("last_run_at").cloned();

        out.push(PlanSummary {
            path: rel,
            title,
            goal,
            status,
            model,
            last_run_id,
            last_run_at,
        });
    }
}
