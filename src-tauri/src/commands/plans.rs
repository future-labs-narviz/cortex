//! Plan note Tauri commands.

use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

const PLAN_TEMPLATE: &str = r#"---
type: plan
title: {TITLE}
status: draft
goal: Describe what you want claude to do here.
mcp_servers: []
allowed_tools: ["Read", "Write", "Edit"]
denied_tools: ["Bash(rm *)", "Bash(git push *)"]
context_entities: []
context_notes: []
model: claude-sonnet-4-5
max_turns: 10
max_budget_usd: 2
permission_mode: acceptEdits
worktree: false
---

Free-form notes about this plan. This body is NOT sent to claude — only
the goal field above is. Use it to remember intent, link related plans,
or capture context you don't want in the prompt.
"#;

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

/// Create a new draft plan note from the built-in template, sanitizing
/// the title into a filesystem-safe slug. Returns the new file's
/// vault-relative path so the frontend can immediately route to the
/// plan-runner sheet for it.
#[tauri::command]
#[specta::specta]
pub async fn create_plan_note(
    title: String,
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let vault_root = {
        let guard = state.vault.lock().map_err(|e| e.to_string())?;
        guard
            .as_ref()
            .ok_or_else(|| "No vault is currently open".to_string())?
            .root()
            .to_path_buf()
    };

    let plans_dir = vault_root.join("plans");
    std::fs::create_dir_all(&plans_dir).map_err(|e| e.to_string())?;

    let trimmed_title = title.trim();
    let display_title = if trimmed_title.is_empty() {
        "Untitled Plan".to_string()
    } else {
        trimmed_title.to_string()
    };

    let slug = slugify(&display_title);
    let mut filename = format!("{}.md", slug);
    let mut counter = 2;
    while plans_dir.join(&filename).exists() {
        filename = format!("{}-{}.md", slug, counter);
        counter += 1;
        if counter > 100 {
            return Err("too many existing plans with similar name".to_string());
        }
    }

    let body = PLAN_TEMPLATE.replace("{TITLE}", &display_title);
    let abs = plans_dir.join(&filename);
    std::fs::write(&abs, body).map_err(|e| e.to_string())?;

    Ok(format!("plans/{}", filename))
}

/// Read a Phase B run's persisted JSONL transcript and return its events
/// in order so the live session view can replay it. Reads from the
/// canonical vault-local path `sessions/<run_id>.jsonl` written by
/// `run::execute` after a run terminates. Returns an empty Vec if the
/// file does not exist (e.g. for Phase A interactive sessions, which
/// don't write a Cortex-owned transcript).
///
/// Returns a Vec of raw JSON strings — one per stream-json event — so
/// the frontend can parse them with the same `applyEvent` reducer the
/// live view uses. (specta can't serialize `serde_json::Value`, hence
/// the string-list shape.)
#[tauri::command]
#[specta::specta]
pub async fn load_run_transcript(
    run_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<String>, String> {
    let vault_root = {
        let guard = state.vault.lock().map_err(|e| e.to_string())?;
        match guard.as_ref() {
            Some(v) => v.root().to_path_buf(),
            None => return Ok(vec![]),
        }
    };

    let path = vault_root.join("sessions").join(format!("{}.jsonl", run_id));
    if !path.exists() {
        return Ok(vec![]);
    }

    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut out: Vec<String> = Vec::new();
    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        // Defensive: validate each line parses, drop garbage rather than
        // letting it propagate to the frontend.
        if serde_json::from_str::<serde_json::Value>(line).is_ok() {
            out.push(line.to_string());
        }
    }
    Ok(out)
}

/// Replace non-alphanumeric characters in a title with hyphens, lowercase
/// the result, and collapse runs of hyphens. Used for plan note filenames.
fn slugify(title: &str) -> String {
    let mut out = String::with_capacity(title.len());
    let mut prev_hyphen = false;
    for c in title.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
            prev_hyphen = false;
        } else if !prev_hyphen {
            out.push('-');
            prev_hyphen = true;
        }
    }
    let slug = out.trim_matches('-').to_string();
    if slug.is_empty() {
        "untitled".to_string()
    } else {
        slug
    }
}

/// Spawn `claude --print --permission-mode plan` against the open vault
/// and use Anthropic's canonical 5-phase plan-mode workflow (Explore →
/// Design → Review → Finalize → ExitPlanMode) to draft a plan from a
/// short user goal. Captures the `ExitPlanMode` tool_use input.plan
/// field from the stream-json output, then writes it as the body of a
/// new Cortex plan note.
///
/// This is the symmetric counterpart to `execute_plan`: that command
/// spawns `claude` to *execute* a plan, this one spawns `claude` (in
/// plan mode) to *draft* one. Both use Max plan OAuth keychain auth.
#[tauri::command]
#[specta::specta]
pub async fn draft_plan_from_goal(
    goal: String,
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let goal = goal.trim().to_string();
    if goal.is_empty() {
        return Err("goal must not be empty".to_string());
    }

    let vault_root = {
        let guard = state.vault.lock().map_err(|e| e.to_string())?;
        guard
            .as_ref()
            .ok_or_else(|| "No vault is currently open".to_string())?
            .root()
            .to_path_buf()
    };

    let draft_id = uuid::Uuid::new_v4().to_string();

    // Build args for the plan-mode spawn. Same flag spine as execute_plan
    // but with --permission-mode plan and a tighter budget — plan mode
    // typically completes in 30-60s with a few exploration tool calls.
    let args: Vec<String> = vec![
        "--print".to_string(),
        "--verbose".to_string(),
        "--setting-sources".to_string(),
        "user".to_string(),
        "--strict-mcp-config".to_string(),
        "--mcp-config".to_string(),
        "{\"mcpServers\":{}}".to_string(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--include-partial-messages".to_string(),
        "--include-hook-events".to_string(),
        "--max-turns".to_string(),
        "20".to_string(),
        "--max-budget-usd".to_string(),
        "3".to_string(),
        "--permission-mode".to_string(),
        "plan".to_string(),
        "--session-id".to_string(),
        draft_id.clone(),
        "--add-dir".to_string(),
        vault_root.to_string_lossy().to_string(),
        "-p".to_string(),
        goal.clone(),
    ];

    log::info!(
        "draft_plan_from_goal: spawning plan-mode claude (draft_id={})",
        draft_id
    );

    let _ = app.emit(
        "cortex://draft/started",
        serde_json::json!({ "draft_id": draft_id, "goal": goal }),
    );

    let shell = app.shell();
    let (mut rx, _child) = shell
        .command("claude")
        .args(&args)
        .current_dir(&vault_root)
        .spawn()
        .map_err(|e| format!("Failed to spawn claude (plan mode): {}", e))?;

    // Drain the stream until termination, looking for the ExitPlanMode
    // tool_use whose input.plan field carries the freeform markdown plan
    // (the SDK shim injects it there in print mode — see
    // ExitPlanModeV2Tool.outputSchema in the Claude Code source).
    let mut plan_text: Option<String> = None;
    let mut last_assistant_text: Option<String> = None;
    let mut event_count = 0u32;

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
                    Err(_) => continue,
                };
                event_count += 1;

                let _ = app.emit(
                    &format!("cortex://draft/event/{}", draft_id),
                    &value,
                );

                // Look for ExitPlanMode in any assistant message snapshot.
                if value.get("type").and_then(|t| t.as_str()) == Some("assistant") {
                    if let Some(content) = value
                        .get("message")
                        .and_then(|m| m.get("content"))
                        .and_then(|c| c.as_array())
                    {
                        for block in content {
                            if block.get("type").and_then(|t| t.as_str()) == Some("tool_use")
                                && block.get("name").and_then(|n| n.as_str())
                                    == Some("ExitPlanMode")
                            {
                                if let Some(plan) = block
                                    .get("input")
                                    .and_then(|i| i.get("plan"))
                                    .and_then(|p| p.as_str())
                                {
                                    plan_text = Some(plan.to_string());
                                }
                            }
                            if block.get("type").and_then(|t| t.as_str()) == Some("text") {
                                if let Some(t) = block.get("text").and_then(|t| t.as_str()) {
                                    if !t.trim().is_empty() {
                                        last_assistant_text = Some(t.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
            }
            CommandEvent::Stderr(line_bytes) => {
                let line = String::from_utf8_lossy(&line_bytes);
                let line = line.trim();
                if !line.is_empty() {
                    log::debug!("draft_plan_from_goal stderr: {}", line);
                }
            }
            CommandEvent::Terminated(payload) => {
                log::info!(
                    "draft_plan_from_goal: terminated (code={:?}, signal={:?}, events={})",
                    payload.code,
                    payload.signal,
                    event_count
                );
                break;
            }
            CommandEvent::Error(err) => {
                let _ = app.emit(
                    "cortex://draft/error",
                    serde_json::json!({ "draft_id": draft_id, "message": err }),
                );
                return Err(format!("draft spawn errored: {}", err));
            }
            _ => {}
        }
    }

    let body_md = match plan_text.or(last_assistant_text) {
        Some(t) => t,
        None => {
            return Err(
                "claude finished without producing a plan (no ExitPlanMode tool call and no assistant text)"
                    .to_string(),
            );
        }
    };

    // Try to extract a title from the first H1 of the drafted plan;
    // fall back to a truncated version of the goal.
    let drafted_title = body_md
        .lines()
        .find_map(|l| l.strip_prefix("# ").map(|s| s.trim().to_string()))
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| {
            let mut t = goal.clone();
            if t.len() > 60 {
                t.truncate(60);
                t.push('…');
            }
            t
        });

    // Reuse the create_plan_note machinery to seed a fresh template,
    // then rewrite it with the drafted body and the user's goal.
    let plans_dir = vault_root.join("plans");
    std::fs::create_dir_all(&plans_dir).map_err(|e| e.to_string())?;
    let slug = slugify(&drafted_title);
    let mut filename = format!("{}.md", slug);
    let mut counter = 2;
    while plans_dir.join(&filename).exists() {
        filename = format!("{}-{}.md", slug, counter);
        counter += 1;
        if counter > 100 {
            return Err("too many existing plans with similar name".to_string());
        }
    }

    // Build the file content directly. status starts at `ready` because
    // a drafted plan is meant to be reviewed and run, not parked as a
    // draft template. last_drafted_at marks provenance.
    let drafted_at = chrono::Utc::now().to_rfc3339();
    let escaped_goal = goal.replace('\n', " ").replace('"', "\\\"");
    let escaped_title = drafted_title.replace('\n', " ").replace('"', "\\\"");
    let body = format!(
        "---\ntype: plan\ntitle: \"{title}\"\nstatus: ready\ngoal: \"{goal}\"\nmcp_servers: []\nallowed_tools: [\"Read\", \"Write\", \"Edit\", \"Grep\", \"Glob\"]\ndenied_tools: [\"Bash(rm *)\", \"Bash(git push *)\"]\ncontext_entities: []\ncontext_notes: []\nmodel: claude-sonnet-4-5\nmax_turns: 30\nmax_budget_usd: 5\npermission_mode: acceptEdits\nworktree: false\ndrafted_by: claude-plan-mode\ndrafted_at: {drafted_at}\n---\n\n<!-- Drafted by Claude in plan mode from the goal above. Review and edit before executing. -->\n\n{body_md}\n",
        title = escaped_title,
        goal = escaped_goal,
        drafted_at = drafted_at,
        body_md = body_md,
    );

    let abs = plans_dir.join(&filename);
    std::fs::write(&abs, body).map_err(|e| e.to_string())?;

    let rel = format!("plans/{}", filename);
    let _ = app.emit(
        "cortex://draft/completed",
        serde_json::json!({
            "draft_id": draft_id,
            "plan_path": rel,
            "event_count": event_count,
        }),
    );

    Ok(rel)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugify_basic() {
        assert_eq!(slugify("Hello World"), "hello-world");
        assert_eq!(slugify("Add a README!"), "add-a-readme");
        assert_eq!(slugify("   "), "untitled");
        assert_eq!(slugify("foo  bar  baz"), "foo-bar-baz");
        assert_eq!(slugify("---weird---"), "weird");
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
