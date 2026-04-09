//! Phase B: spawn `claude` for a prepared RunSpec, parse its stream-json
//! output line-by-line into Tauri events, and trigger post-run extraction
//! against the in-memory transcript when the `result` event arrives.
//!
//! The vault Stop hook does NOT fire under `--setting-sources user`, so this
//! module is the *only* place that closes the loop back into cortex-extract
//! for Phase B-spawned sessions.

use crate::run::prepare::{self, RunSpec};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ExecuteRunResponse {
    pub run_id: String,
    pub session_note_path: String,
    pub plan_path: String,
}

/// Tauri command: prepare and spawn a claude run from a `type:plan` note.
///
/// Returns immediately after the child process is spawned. The frontend
/// subscribes to `cortex://session/event/<run_id>` for the live transcript
/// and `cortex://session/{started,completed,aborted,error}` for lifecycle.
#[tauri::command]
#[specta::specta]
pub async fn execute_plan(
    plan_path: String,
    state: State<'_, Arc<AppState>>,
    app: AppHandle,
) -> Result<ExecuteRunResponse, String> {
    // 1. Resolve vault root.
    let vault_root = {
        let guard = state.vault.lock().map_err(|e| e.to_string())?;
        guard
            .as_ref()
            .ok_or_else(|| "No vault is currently open".to_string())?
            .root()
            .to_path_buf()
    };

    // 2. Prepare run (parse plan, build context bundle, write mcp.json,
    //    pre-write session note, generate uuid).
    let run_spec = {
        let kg_guard = state.knowledge_graph.read().map_err(|e| e.to_string())?;
        let kg = kg_guard
            .as_ref()
            .ok_or_else(|| "Knowledge graph not initialized".to_string())?;
        prepare::prepare_run(&vault_root, &plan_path, kg).map_err(|e| e.to_string())?
    };

    // 3. Build the args vec for claude.
    let args = build_claude_args(&run_spec);
    log::info!(
        "execute_plan: spawning claude for run {} (plan {}): {} args",
        run_spec.run_id,
        plan_path,
        args.len()
    );

    // 4. Spawn via tauri-plugin-shell. Inherit parent env unchanged so
    //    macOS keychain OAuth (Max plan) works.
    let shell = app.shell();
    let (mut rx, child) = shell
        .command("claude")
        .args(&args)
        .current_dir(&run_spec.cwd)
        .spawn()
        .map_err(|e| format!("Failed to spawn claude: {}", e))?;

    // 5. Track the child process so abort_run can SIGTERM it.
    {
        let mut runs = state.active_runs.lock().await;
        runs.insert(run_spec.run_id.clone(), child);
    }

    let response = ExecuteRunResponse {
        run_id: run_spec.run_id.clone(),
        session_note_path: run_spec.session_note_path.clone(),
        plan_path: plan_path.clone(),
    };

    // 6. Emit started immediately.
    let _ = app.emit(
        "cortex://session/started",
        serde_json::json!({
            "run_id": run_spec.run_id,
            "session_note_path": run_spec.session_note_path,
            "plan_path": plan_path,
        }),
    );

    // 7. Spawn the background task that consumes the stream and triggers
    //    extraction on completion.
    let app_handle = app.clone();
    let state_clone: Arc<AppState> = (*state).clone();
    let run_spec_clone = run_spec.clone();
    tauri::async_runtime::spawn(async move {
        run_event_loop(app_handle, state_clone, run_spec_clone, &mut rx).await;
    });

    Ok(response)
}

/// Tauri command: SIGTERM an in-flight run by run_id. The background event
/// loop will detect the early termination and emit
/// `cortex://session/aborted`.
#[tauri::command]
#[specta::specta]
pub async fn abort_run(run_id: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let child = {
        let mut runs = state.active_runs.lock().await;
        runs.remove(&run_id)
    };
    match child {
        Some(c) => c.kill().map_err(|e| format!("kill failed: {}", e)),
        None => Err(format!("run {} not active", run_id)),
    }
}

// ─── helpers ──────────────────────────────────────────────────────────────

/// Construct the full argv for `claude` from a RunSpec. Order matches the
/// Phase B v2 verified state doc; flags only emitted when the plan supplies
/// non-default values.
fn build_claude_args(spec: &RunSpec) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "--print".to_string(),
        "--verbose".to_string(),
        "--setting-sources".to_string(),
        "user".to_string(),
        "--strict-mcp-config".to_string(),
        "--mcp-config".to_string(),
        spec.mcp_config_path.to_string_lossy().to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--include-partial-messages".to_string(),
        "--include-hook-events".to_string(),
        "--max-turns".to_string(),
        spec.plan.max_turns.unwrap_or(30).to_string(),
        "--max-budget-usd".to_string(),
        format!("{}", spec.plan.max_budget_usd.unwrap_or(5.0)),
        "--permission-mode".to_string(),
        spec.plan
            .permission_mode
            .clone()
            .unwrap_or_else(|| "acceptEdits".to_string()),
        "--session-id".to_string(),
        spec.run_id.clone(),
        "--append-system-prompt-file".to_string(),
        spec.context_bundle_path.to_string_lossy().to_string(),
        "--add-dir".to_string(),
        spec.cwd.to_string_lossy().to_string(),
    ];

    if let Some(model) = &spec.plan.model {
        args.push("--model".to_string());
        args.push(model.clone());
    }

    if !spec.plan.allowed_tools.is_empty() {
        args.push("--allowedTools".to_string());
        args.push(spec.plan.allowed_tools.join(" "));
    }
    if !spec.plan.denied_tools.is_empty() {
        args.push("--disallowedTools".to_string());
        args.push(spec.plan.denied_tools.join(" "));
    }

    // --worktree is silently ignored under --print mode (verified in leaked
    // source). Skip it entirely for v1; surface as a warning instead.
    if spec.plan.worktree {
        log::warn!(
            "execute_plan: plan {} requested worktree:true but --worktree is a no-op under --print; ignoring",
            spec.plan_path
        );
    }

    args.push("-p".to_string());
    args.push(spec.prompt.clone());

    args
}

/// Drain the stream-json stdout, emit Tauri events, accumulate the in-memory
/// transcript, and on the `result` event trigger extraction + cleanup.
async fn run_event_loop(
    app: AppHandle,
    state: Arc<AppState>,
    run_spec: RunSpec,
    rx: &mut tokio::sync::mpsc::Receiver<CommandEvent>,
) {
    let event_channel = format!("cortex://session/event/{}", run_spec.run_id);
    let mut events: Vec<serde_json::Value> = Vec::new();
    let mut result_seen = false;
    let mut result_payload: Option<ResultMetadata> = None;

    while let Some(ev) = rx.recv().await {
        match ev {
            CommandEvent::Stdout(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                let value: serde_json::Value = match serde_json::from_str(line) {
                    Ok(v) => v,
                    Err(e) => {
                        log::debug!(
                            "execute_plan run {}: skipping unparseable stdout line: {}",
                            run_spec.run_id,
                            e
                        );
                        continue;
                    }
                };

                // Forward verbatim to the frontend.
                let _ = app.emit(&event_channel, &value);

                // Buffer for in-memory transcript building.
                if value
                    .get("type")
                    .and_then(|t| t.as_str())
                    .map(|s| s == "result")
                    .unwrap_or(false)
                {
                    result_seen = true;
                    result_payload = Some(extract_result_metadata(&value));
                }

                events.push(value);
            }
            CommandEvent::Stderr(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                let line = line.trim();
                if !line.is_empty() {
                    log::warn!(
                        "execute_plan run {} stderr: {}",
                        run_spec.run_id,
                        line
                    );
                }
            }
            CommandEvent::Terminated(payload) => {
                log::info!(
                    "execute_plan run {}: child terminated, code={:?}, signal={:?}",
                    run_spec.run_id,
                    payload.code,
                    payload.signal
                );
                break;
            }
            CommandEvent::Error(err) => {
                log::error!("execute_plan run {} error: {}", run_spec.run_id, err);
                let _ = app.emit(
                    "cortex://session/error",
                    serde_json::json!({
                        "run_id": run_spec.run_id,
                        "message": err,
                    }),
                );
                break;
            }
            _ => {}
        }
    }

    // Remove from active_runs in either path.
    {
        let mut runs = state.active_runs.lock().await;
        runs.remove(&run_spec.run_id);
    }

    // Persist the captured stream events as a vault-local JSONL file so
    // the live view can be replayed later from the Sessions panel. This
    // is the canonical Phase B transcript artifact (the JSONL Claude Code
    // itself writes to ~/.claude/projects/... is parallel but unowned).
    let transcript_rel = format!("sessions/{}.jsonl", run_spec.run_id);
    let transcript_abs = run_spec.cwd.join(&transcript_rel);
    if let Err(e) = write_events_jsonl(&transcript_abs, &events) {
        log::warn!(
            "failed to write transcript JSONL for run {}: {}",
            run_spec.run_id,
            e
        );
    }

    if result_seen {
        let meta = result_payload.unwrap_or_default();
        if let Err(e) = update_session_note_complete(&run_spec, &meta, &transcript_rel) {
            log::warn!("failed to update session note for {}: {}", run_spec.run_id, e);
        }

        // Build in-memory transcript and run extraction.
        let mut parsed = cortex_extract::parse_stream_events(&events);
        if parsed.session_id.is_empty() {
            parsed.session_id = run_spec.run_id.clone();
        }
        let kg_handle = state.knowledge_graph.clone();
        let vault_root = run_spec.cwd.clone();
        let session_id = run_spec.run_id.clone();

        let extraction_result = cortex_extract::extraction_job_from_parsed(
            kg_handle,
            vault_root,
            session_id,
            parsed,
        )
        .await;

        // Only set a retrospective path if Vertex actually wrote one.
        // extraction_job_from_parsed returns Ok(None) when GCP env is
        // missing — surfacing a phantom path would point at a missing
        // file in the UI.
        let retrospective_path = match extraction_result {
            Ok(Some(rel)) => Some(rel.to_string_lossy().to_string()),
            Ok(None) => None,
            Err(e) => {
                log::error!(
                    "extraction_job_from_parsed failed for run {}: {}",
                    run_spec.run_id,
                    e
                );
                None
            }
        };

        // Write back the plan note status so the Plans panel reflects
        // reality next time it lists.
        let plan_status = if meta.is_error { "failed" } else { "complete" };
        if let Err(e) = update_plan_note_after_run(&run_spec, plan_status) {
            log::warn!(
                "failed to update plan note status for {}: {}",
                run_spec.plan_path,
                e
            );
        }

        let _ = app.emit(
            "cortex://session/completed",
            serde_json::json!({
                "run_id": run_spec.run_id,
                "total_cost_usd": meta.total_cost_usd,
                "duration_ms": meta.duration_ms,
                "num_turns": meta.num_turns,
                "is_error": meta.is_error,
                "retrospective_path": retrospective_path,
                "transcript_path": transcript_rel,
                "plan_path": run_spec.plan_path,
            }),
        );
    } else {
        // No result event seen → process exited early. Treat as aborted.
        if let Err(e) = update_session_note_aborted(&run_spec, &transcript_rel) {
            log::warn!("failed to mark session aborted for {}: {}", run_spec.run_id, e);
        }
        if let Err(e) = update_plan_note_after_run(&run_spec, "aborted") {
            log::warn!(
                "failed to update plan note status for {}: {}",
                run_spec.plan_path,
                e
            );
        }
        let _ = app.emit(
            "cortex://session/aborted",
            serde_json::json!({
                "run_id": run_spec.run_id,
                "partial_event_count": events.len(),
                "plan_path": run_spec.plan_path,
            }),
        );
    }

    // Cleanup the temp run dir regardless of outcome.
    if let Err(e) = prepare::cleanup_run(&run_spec.run_dir) {
        log::warn!(
            "cleanup_run failed for {}: {}",
            run_spec.run_dir.display(),
            e
        );
    }
}

/// Write a sequence of stream-json events as NDJSON to disk. One event
/// per line, no trailing newline missing. Used to persist Phase B
/// transcripts so the live view can be replayed from the Sessions panel.
fn write_events_jsonl(
    path: &std::path::Path,
    events: &[serde_json::Value],
) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut buf = String::with_capacity(events.len() * 256);
    for event in events {
        match serde_json::to_string(event) {
            Ok(s) => {
                buf.push_str(&s);
                buf.push('\n');
            }
            Err(_) => continue,
        }
    }
    std::fs::write(path, buf)
}

#[derive(Debug, Default, Clone)]
struct ResultMetadata {
    total_cost_usd: f64,
    duration_ms: u64,
    num_turns: u32,
    is_error: bool,
}

fn extract_result_metadata(value: &serde_json::Value) -> ResultMetadata {
    ResultMetadata {
        total_cost_usd: value
            .get("total_cost_usd")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0),
        duration_ms: value
            .get("duration_ms")
            .and_then(|v| v.as_u64())
            .unwrap_or(0),
        num_turns: value
            .get("num_turns")
            .and_then(|v| v.as_u64())
            .map(|n| n as u32)
            .unwrap_or(0),
        is_error: value
            .get("subtype")
            .and_then(|v| v.as_str())
            .map(|s| s == "error")
            .unwrap_or(false),
    }
}

fn update_session_note_complete(
    spec: &RunSpec,
    meta: &ResultMetadata,
    transcript_rel: &str,
) -> std::io::Result<()> {
    let abs = spec.cwd.join(&spec.session_note_path);
    let raw = std::fs::read_to_string(&abs)?;
    let ended_at = chrono::Utc::now().to_rfc3339();
    let status = if meta.is_error { "failed" } else { "complete" };
    let updated = raw
        .replace("status: running", &format!("status: {}", status))
        .replace(
            "---\n\n# Session",
            &format!(
                "ended_at: {}\ntotal_cost_usd: {}\nduration_ms: {}\nnum_turns: {}\ntranscript_path: {}\n---\n\n# Session",
                ended_at,
                meta.total_cost_usd,
                meta.duration_ms,
                meta.num_turns,
                transcript_rel,
            ),
        );
    std::fs::write(&abs, updated)
}

fn update_session_note_aborted(spec: &RunSpec, transcript_rel: &str) -> std::io::Result<()> {
    let abs = spec.cwd.join(&spec.session_note_path);
    let raw = std::fs::read_to_string(&abs)?;
    let ended_at = chrono::Utc::now().to_rfc3339();
    let updated = raw
        .replace("status: running", "status: aborted")
        .replace(
            "---\n\n# Session",
            &format!(
                "ended_at: {}\ntranscript_path: {}\n---\n\n# Session",
                ended_at, transcript_rel
            ),
        );
    std::fs::write(&abs, updated)
}

/// After a Phase B run terminates, write the run outcome back into the
/// plan note's frontmatter so the Plans panel sort order and status pill
/// reflect reality. Status, last_run_id, and last_run_at are all upserted
/// — existing values for those keys are replaced; missing keys are
/// inserted just before the closing `---` fence.
///
/// `new_status` is one of `complete`, `failed`, `aborted`.
fn update_plan_note_after_run(spec: &RunSpec, new_status: &str) -> std::io::Result<()> {
    let abs = spec.cwd.join(&spec.plan_path);
    let raw = std::fs::read_to_string(&abs)?;
    let now = chrono::Utc::now().to_rfc3339();
    let updated = upsert_frontmatter_keys(
        &raw,
        &[
            ("status", new_status),
            ("last_run_id", &spec.run_id),
            ("last_run_at", &now),
        ],
    );
    std::fs::write(&abs, updated)
}

/// Replace or insert simple `key: value` lines inside the YAML frontmatter
/// block of a markdown file. Preserves all other lines verbatim. Values
/// must not contain newlines or YAML special characters that would need
/// escaping; all callers here pass plain ASCII identifiers and ISO
/// timestamps so this is safe.
fn upsert_frontmatter_keys(raw: &str, kvs: &[(&str, &str)]) -> String {
    // Locate the frontmatter block. If absent, prepend one.
    let trimmed = raw.trim_start_matches('\u{feff}');
    let body_start = if trimmed.starts_with("---\n") || trimmed.starts_with("---\r\n") {
        // Find the closing fence after the opening one.
        let after_opening = &trimmed[4..];
        match after_opening.find("\n---") {
            Some(end_rel) => {
                let fm = &after_opening[..end_rel];
                let mut new_fm = update_yaml_block(fm, kvs);
                if !new_fm.ends_with('\n') {
                    new_fm.push('\n');
                }
                let body = &after_opening[end_rel + 4..]; // skip "\n---"
                let mut out = String::with_capacity(raw.len() + 64);
                out.push_str("---\n");
                out.push_str(&new_fm);
                out.push_str("---");
                out.push_str(body);
                return out;
            }
            None => 0,
        }
    } else {
        0
    };
    // No frontmatter — synthesize one.
    let mut new_fm = String::new();
    for (k, v) in kvs {
        new_fm.push_str(k);
        new_fm.push_str(": ");
        new_fm.push_str(v);
        new_fm.push('\n');
    }
    let mut out = String::with_capacity(raw.len() + new_fm.len() + 16);
    out.push_str("---\n");
    out.push_str(&new_fm);
    out.push_str("---\n\n");
    out.push_str(&raw[body_start..]);
    out
}

/// Helper for upsert_frontmatter_keys: rewrite a YAML block in place,
/// replacing existing keys and appending any that were missing.
fn update_yaml_block(fm: &str, kvs: &[(&str, &str)]) -> String {
    use std::collections::HashSet;
    let mut handled: HashSet<&str> = HashSet::new();
    let mut out = String::with_capacity(fm.len() + 128);
    for line in fm.lines() {
        let trimmed = line.trim_start();
        let mut wrote = false;
        for (k, v) in kvs {
            if handled.contains(*k) {
                continue;
            }
            // Match `key:` exactly at line start (after optional indent).
            let prefix = format!("{}:", k);
            if trimmed.starts_with(&prefix) {
                out.push_str(k);
                out.push_str(": ");
                out.push_str(v);
                out.push('\n');
                handled.insert(*k);
                wrote = true;
                break;
            }
        }
        if !wrote {
            out.push_str(line);
            out.push('\n');
        }
    }
    // Append any keys we never saw.
    for (k, v) in kvs {
        if !handled.contains(*k) {
            out.push_str(k);
            out.push_str(": ");
            out.push_str(v);
            out.push('\n');
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fake_spec(allowed: Vec<&str>, denied: Vec<&str>) -> RunSpec {
        use std::path::PathBuf;
        RunSpec {
            run_id: "11111111-1111-4111-8111-111111111111".to_string(),
            plan_path: "plans/p.md".to_string(),
            plan: crate::run::prepare::PlanFrontmatter {
                title: None,
                goal: Some("do it".to_string()),
                mcp_servers: vec![],
                allowed_tools: allowed.into_iter().map(String::from).collect(),
                denied_tools: denied.into_iter().map(String::from).collect(),
                context_entities: vec![],
                context_notes: vec![],
                model: Some("claude-sonnet-4-5".to_string()),
                max_turns: Some(7),
                max_budget_usd: Some(2.0),
                permission_mode: Some("acceptEdits".to_string()),
                worktree: false,
            },
            context_bundle_path: PathBuf::from("/tmp/cortex-run-x/context.md"),
            mcp_config_path: PathBuf::from("/tmp/cortex-run-x/mcp.json"),
            run_dir: PathBuf::from("/tmp/cortex-run-x"),
            session_note_path: "sessions/x.md".to_string(),
            cwd: PathBuf::from("/vault"),
            prompt: "do it".to_string(),
        }
    }

    #[test]
    fn build_args_includes_required_flags() {
        let spec = fake_spec(vec![], vec![]);
        let args = build_claude_args(&spec);
        let joined = args.join(" ");
        assert!(joined.contains("--print"));
        assert!(joined.contains("--verbose"));
        assert!(joined.contains("--setting-sources user"));
        assert!(joined.contains("--strict-mcp-config"));
        assert!(joined.contains("--output-format stream-json"));
        assert!(joined.contains("--include-partial-messages"));
        assert!(joined.contains("--include-hook-events"));
        assert!(joined.contains("--max-turns 7"));
        assert!(joined.contains("--permission-mode acceptEdits"));
        assert!(joined.contains("--session-id 11111111-1111-4111-8111-111111111111"));
        assert!(joined.contains("--model claude-sonnet-4-5"));
        // last two args are -p <prompt>
        assert_eq!(args[args.len() - 2], "-p");
        assert_eq!(args[args.len() - 1], "do it");
    }

    #[test]
    fn build_args_includes_allowed_and_denied_tools_only_when_set() {
        let spec_a = fake_spec(vec!["Read", "Write"], vec!["Bash(rm *)"]);
        let args_a = build_claude_args(&spec_a);
        assert!(args_a.iter().any(|a| a == "--allowedTools"));
        assert!(args_a.iter().any(|a| a == "Read Write"));
        assert!(args_a.iter().any(|a| a == "--disallowedTools"));
        assert!(args_a.iter().any(|a| a == "Bash(rm *)"));

        let spec_b = fake_spec(vec![], vec![]);
        let args_b = build_claude_args(&spec_b);
        assert!(!args_b.iter().any(|a| a == "--allowedTools"));
        assert!(!args_b.iter().any(|a| a == "--disallowedTools"));
    }

    #[test]
    fn build_args_omits_worktree_flag_even_when_set() {
        let mut spec = fake_spec(vec![], vec![]);
        spec.plan.worktree = true;
        let args = build_claude_args(&spec);
        assert!(!args.iter().any(|a| a == "--worktree"));
    }

    #[test]
    fn extract_result_metadata_from_success() {
        let v = serde_json::json!({
            "type": "result",
            "subtype": "success",
            "duration_ms": 12345,
            "num_turns": 3,
            "total_cost_usd": 0.075
        });
        let meta = extract_result_metadata(&v);
        assert_eq!(meta.duration_ms, 12345);
        assert_eq!(meta.num_turns, 3);
        assert!((meta.total_cost_usd - 0.075).abs() < 1e-9);
        assert!(!meta.is_error);
    }

    #[test]
    fn upsert_frontmatter_replaces_existing_keys() {
        let raw = "---\ntype: plan\nstatus: ready\nmodel: claude-sonnet-4-5\n---\n\nbody\n";
        let updated = upsert_frontmatter_keys(
            raw,
            &[("status", "complete"), ("last_run_id", "abc-123")],
        );
        assert!(updated.contains("status: complete"));
        assert!(!updated.contains("status: ready"));
        assert!(updated.contains("last_run_id: abc-123"));
        // Untouched keys remain in place.
        assert!(updated.contains("type: plan"));
        assert!(updated.contains("model: claude-sonnet-4-5"));
        // Body is preserved.
        assert!(updated.contains("\nbody\n"));
    }

    #[test]
    fn upsert_frontmatter_appends_missing_keys() {
        let raw = "---\ntype: plan\nstatus: ready\n---\n\nbody\n";
        let updated = upsert_frontmatter_keys(
            raw,
            &[("last_run_id", "xyz"), ("last_run_at", "2026-04-09T00:00:00Z")],
        );
        assert!(updated.contains("last_run_id: xyz"));
        assert!(updated.contains("last_run_at: 2026-04-09T00:00:00Z"));
        // Existing keys untouched.
        assert!(updated.contains("status: ready"));
    }

    #[test]
    fn upsert_frontmatter_handles_no_frontmatter_block() {
        let raw = "no frontmatter here\njust body\n";
        let updated = upsert_frontmatter_keys(raw, &[("status", "complete")]);
        assert!(updated.starts_with("---\nstatus: complete\n---"));
        assert!(updated.contains("just body"));
    }

    #[test]
    fn write_events_jsonl_round_trips() {
        use tempfile::TempDir;
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("events.jsonl");
        let events = vec![
            serde_json::json!({"type": "system", "subtype": "init"}),
            serde_json::json!({"type": "result", "subtype": "success"}),
        ];
        write_events_jsonl(&path, &events).unwrap();
        let raw = std::fs::read_to_string(&path).unwrap();
        let lines: Vec<&str> = raw.lines().collect();
        assert_eq!(lines.len(), 2);
        let first: serde_json::Value = serde_json::from_str(lines[0]).unwrap();
        assert_eq!(first.get("type").unwrap().as_str(), Some("system"));
    }

    #[test]
    fn extract_result_metadata_from_error() {
        let v = serde_json::json!({
            "type": "result",
            "subtype": "error",
            "duration_ms": 50
        });
        let meta = extract_result_metadata(&v);
        assert!(meta.is_error);
    }
}
