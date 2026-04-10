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
    // Skip write if file already has the same content (avoids triggering Vite HMR reload loop).
    if settings_path.exists() {
        if let Ok(existing) = std::fs::read_to_string(&settings_path) {
            if existing == pretty {
                log::info!(".claude/settings.json unchanged, skipping write");
                return Ok(());
            }
        }
    }
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

    // Sweep orphaned Phase B session notes. A session note stuck with
    // `status: running` after the app restarts means its run_event_loop
    // task was killed before the cleanup path could execute — typically
    // because the user quit Cortex mid-run, the process crashed, or the
    // dev server hot-reloaded while a self-modifying plan was rebuilding
    // Cortex itself. See CLAUDE.md "Phase B self-modification rule".
    let active_run_ids: Vec<String> = {
        let runs = state.active_runs.lock().await;
        runs.keys().cloned().collect()
    };
    match sweep_orphan_sessions(&vault_path, &active_run_ids) {
        Ok(n) if n > 0 => {
            log::info!("open_vault: transitioned {} orphan session(s) to aborted", n);
        }
        Ok(_) => {}
        Err(e) => {
            log::warn!("open_vault: orphan sweep failed: {}", e);
        }
    }

    Ok(files)
}

/// Scan `<vault>/sessions/*.md` for session notes whose frontmatter has
/// `status: running` but whose `session_id` is NOT in the provided list
/// of currently-active runs. Those are orphans — their run_event_loop
/// task never reached the cleanup block that would have flipped their
/// status. Transition each orphan to `status: aborted` with a synthetic
/// `ended_at` timestamp and an `orphaned: true` marker. Returns the
/// number of orphans swept.
///
/// This is a best-effort janitor. It does not need to be perfectly atomic
/// (a crashed write just means the next open_vault will retry). It does
/// need to be safe to run during a live session — the `active_run_ids`
/// check ensures we never clobber an in-flight run.
fn sweep_orphan_sessions(
    vault_root: &Path,
    active_run_ids: &[String],
) -> anyhow::Result<usize> {
    let sessions_dir = vault_root.join("sessions");
    if !sessions_dir.exists() {
        return Ok(0);
    }

    let now = chrono::Utc::now().to_rfc3339();
    let mut swept = 0usize;

    for entry in std::fs::read_dir(&sessions_dir)? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        // Skip retrospectives (they're just markdown, no status field).
        if name.ends_with("-retrospective.md") || !name.ends_with(".md") {
            continue;
        }

        let raw = match std::fs::read_to_string(&path) {
            Ok(r) => r,
            Err(_) => continue,
        };

        // Parse out session_id + status from the YAML frontmatter.
        // Plain regex is fine — the frontmatter we write is deterministic.
        let session_id = extract_fm_field(&raw, "session_id");
        let status = extract_fm_field(&raw, "status");

        let is_orphan = status.as_deref() == Some("running")
            && session_id
                .as_ref()
                .map(|sid| !active_run_ids.iter().any(|a| a == sid))
                .unwrap_or(false);

        if !is_orphan {
            continue;
        }

        // Rewrite frontmatter: status: running → aborted, add ended_at
        // and orphaned: true if missing. Uses simple string replacement
        // to preserve everything else verbatim.
        let mut updated = raw.replace("status: running", "status: aborted");
        if !updated.contains("ended_at:") {
            updated = updated.replacen(
                "status: aborted",
                &format!("status: aborted\nended_at: {}", now),
                1,
            );
        }
        if !updated.contains("orphaned:") {
            updated = updated.replacen(
                "status: aborted",
                "status: aborted\norphaned: true",
                1,
            );
        }

        if let Err(e) = std::fs::write(&path, updated) {
            log::warn!("sweep_orphan_sessions: failed to write {}: {}", name, e);
            continue;
        }
        swept += 1;
        log::info!("sweep_orphan_sessions: marked {} as aborted", name);
    }

    Ok(swept)
}

/// Extract a single top-level YAML scalar field from a markdown note's
/// frontmatter block. Returns None if no frontmatter is present or if
/// the field is not found. Intentionally simple — good enough for the
/// deterministic frontmatter Cortex writes for session notes.
fn extract_fm_field(raw: &str, key: &str) -> Option<String> {
    let trimmed = raw.trim_start_matches('\u{feff}');
    if !trimmed.starts_with("---\n") && !trimmed.starts_with("---\r\n") {
        return None;
    }
    let after_first = &trimmed[4..];
    let end = after_first.find("\n---")?;
    let fm = &after_first[..end];
    let prefix = format!("{}:", key);
    for line in fm.lines() {
        let line = line.trim_start();
        if let Some(rest) = line.strip_prefix(&prefix) {
            return Some(rest.trim().to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn write_session(dir: &Path, name: &str, content: &str) {
        let sessions = dir.join("sessions");
        std::fs::create_dir_all(&sessions).unwrap();
        std::fs::write(sessions.join(name), content).unwrap();
    }

    fn read_status(dir: &Path, name: &str) -> Option<String> {
        let raw = std::fs::read_to_string(dir.join("sessions").join(name)).ok()?;
        extract_fm_field(&raw, "status")
    }

    #[test]
    fn sweep_marks_orphan_running_sessions_as_aborted() {
        let dir = TempDir::new().unwrap();
        write_session(
            dir.path(),
            "orphan-123.md",
            "---\ntype: session\nsession_id: orphan-123\nplan_ref: plans/p.md\nstatus: running\nstarted_at: 2026-04-10T00:00:00Z\n---\n\nbody\n",
        );
        let swept = sweep_orphan_sessions(dir.path(), &[]).unwrap();
        assert_eq!(swept, 1);
        assert_eq!(read_status(dir.path(), "orphan-123.md").as_deref(), Some("aborted"));
        let raw = std::fs::read_to_string(dir.path().join("sessions/orphan-123.md")).unwrap();
        assert!(raw.contains("ended_at:"));
        assert!(raw.contains("orphaned: true"));
    }

    #[test]
    fn sweep_ignores_active_runs() {
        let dir = TempDir::new().unwrap();
        write_session(
            dir.path(),
            "active-456.md",
            "---\ntype: session\nsession_id: active-456\nstatus: running\n---\n",
        );
        let swept = sweep_orphan_sessions(dir.path(), &["active-456".to_string()]).unwrap();
        assert_eq!(swept, 0);
        assert_eq!(read_status(dir.path(), "active-456.md").as_deref(), Some("running"));
    }

    #[test]
    fn sweep_ignores_already_complete_sessions() {
        let dir = TempDir::new().unwrap();
        write_session(
            dir.path(),
            "done-789.md",
            "---\ntype: session\nsession_id: done-789\nstatus: complete\nended_at: 2026-04-10T00:00:00Z\n---\n",
        );
        let swept = sweep_orphan_sessions(dir.path(), &[]).unwrap();
        assert_eq!(swept, 0);
        assert_eq!(read_status(dir.path(), "done-789.md").as_deref(), Some("complete"));
    }

    #[test]
    fn sweep_ignores_retrospective_notes() {
        let dir = TempDir::new().unwrap();
        write_session(
            dir.path(),
            "abc-retrospective.md",
            "---\ntype: retrospective\nsession_id: abc\n---\n",
        );
        let swept = sweep_orphan_sessions(dir.path(), &[]).unwrap();
        assert_eq!(swept, 0);
    }

    #[test]
    fn sweep_handles_missing_sessions_dir() {
        let dir = TempDir::new().unwrap();
        let swept = sweep_orphan_sessions(dir.path(), &[]).unwrap();
        assert_eq!(swept, 0);
    }

    #[test]
    fn extract_fm_field_roundtrip() {
        let raw = "---\ntype: session\nsession_id: abc-123\nstatus: running\n---\n\nbody\n";
        assert_eq!(extract_fm_field(raw, "session_id").as_deref(), Some("abc-123"));
        assert_eq!(extract_fm_field(raw, "status").as_deref(), Some("running"));
        assert_eq!(extract_fm_field(raw, "nonexistent"), None);
    }

    #[test]
    fn extract_fm_field_handles_no_frontmatter() {
        assert_eq!(extract_fm_field("no frontmatter here", "status"), None);
    }
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
