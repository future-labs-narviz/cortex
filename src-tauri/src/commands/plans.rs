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

/// Tokenize a goal string into meaningful keywords suitable for KG
/// entity search. Drops common English stopwords and anything shorter
/// than 4 characters so a goal like "add a README explaining cortex"
/// becomes `["readme", "explaining", "cortex"]`.
fn goal_keywords(goal: &str) -> Vec<String> {
    const STOPWORDS: &[&str] = &[
        "the", "and", "for", "with", "from", "that", "this", "some", "into",
        "will", "would", "could", "should", "shall", "need", "needs", "want",
        "wants", "make", "makes", "made", "add", "adding", "added", "add",
        "when", "what", "where", "which", "about", "have", "been", "also",
        "their", "there", "these", "those", "over", "under", "than", "then",
        "just", "like", "each", "more", "most", "here", "only", "them",
        "they", "your", "you're", "its", "it's", "dont", "don't",
    ];
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for raw in goal.split(|c: char| !c.is_alphanumeric()) {
        let word = raw.trim().to_ascii_lowercase();
        if word.len() < 4 {
            continue;
        }
        if STOPWORDS.contains(&word.as_str()) {
            continue;
        }
        if seen.insert(word.clone()) {
            out.push(word);
        }
    }
    out
}

/// Score KG entities by how many goal keywords match their name or
/// description (case-insensitive substring), and return the top `top_n`
/// entity names. Uses the existing `search_entities` method for
/// consistency with elsewhere in the app.
fn rank_entities_for_goal(
    kg: &cortex_kg::TypedKnowledgeGraph,
    goal: &str,
    top_n: usize,
) -> Vec<String> {
    use std::collections::HashMap;

    let keywords = goal_keywords(goal);
    if keywords.is_empty() {
        return Vec::new();
    }

    let mut scores: HashMap<String, usize> = HashMap::new();
    for kw in &keywords {
        for entity in kg.search_entities(kw) {
            *scores.entry(entity.name.clone()).or_insert(0) += 1;
        }
    }

    let mut ranked: Vec<(String, usize)> = scores.into_iter().collect();
    ranked.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    ranked.into_iter().take(top_n).map(|(name, _)| name).collect()
}

/// Build an `--append-system-prompt-file` markdown bundle that tells
/// plan-mode claude what the user's knowledge graph already knows about
/// entities relevant to the goal. Returns `(bundle_text, entity_names)`
/// where `entity_names` gets written into the drafted plan's
/// `context_entities` frontmatter field so the eventual execute_plan
/// run inherits the same KG context automatically.
fn build_kg_context_for_goal(
    kg: &cortex_kg::TypedKnowledgeGraph,
    goal: &str,
) -> (String, Vec<String>) {
    let top_entities = rank_entities_for_goal(kg, goal, 5);
    let kg_graph = kg.to_graph_data();

    let mut out = String::new();
    out.push_str("# Cortex knowledge graph context\n\n");
    out.push_str(
        "The user has a typed knowledge graph from prior Cortex sessions. You are\n\
         running in plan mode inside their vault; use both the raw filesystem\n\
         (via Read/Glob/Grep) AND the structured knowledge below when drafting\n\
         your plan. Reference entities by name when relevant.\n\n",
    );

    if kg_graph.entities.is_empty() {
        out.push_str("## Graph is empty\n\nNo entities have been captured yet.\n");
        return (out, top_entities);
    }

    out.push_str(&format!(
        "## Vault graph summary\n\n{} entities, {} relations across the graph.\n\n",
        kg_graph.entities.len(),
        kg_graph.relations.len()
    ));

    // A brief index of every entity name + type so the model knows
    // what the vault knows about even if the goal doesn't textually
    // match any entity directly.
    out.push_str("### Entity index\n\n");
    let mut all_names: Vec<(String, String)> = kg_graph
        .entities
        .iter()
        .map(|e| (e.name.clone(), e.entity_type.to_string()))
        .collect();
    all_names.sort();
    for (name, etype) in all_names.iter().take(60) {
        out.push_str(&format!("- **{}** _({})_\n", name, etype));
    }
    if all_names.len() > 60 {
        out.push_str(&format!(
            "- _…and {} more_\n",
            all_names.len() - 60
        ));
    }
    out.push('\n');

    if top_entities.is_empty() {
        out.push_str(
            "## Most relevant to this goal\n\nNo entities directly matched the goal\n\
             text. Use the entity index above to orient yourself if any of the\n\
             listed entities are relevant.\n",
        );
    } else {
        out.push_str("## Most relevant entities for this goal\n\n");
        out.push_str(&format!(
            "_Auto-selected by fuzzy-matching the goal text against the KG:_\n\n{}\n\n",
            top_entities
                .iter()
                .map(|n| format!("- {}", n))
                .collect::<Vec<_>>()
                .join("\n")
        ));

        for name in &top_entities {
            if let Some(profile) = kg.entity_profile(name) {
                out.push_str(&format!(
                    "### {} _({})_\n\n{}\n\n",
                    profile.entity.name, profile.entity.entity_type, profile.entity.description
                ));
                if !profile.entity.source_notes.is_empty() {
                    out.push_str("**Source notes:** ");
                    out.push_str(
                        &profile
                            .entity
                            .source_notes
                            .iter()
                            .take(5)
                            .map(|s| format!("`{}`", s))
                            .collect::<Vec<_>>()
                            .join(", "),
                    );
                    out.push_str("\n\n");
                }
            }
            let subgraph = kg.serialize_subgraph(name, 2);
            if !subgraph.is_empty() {
                out.push_str("**Related (2 hops):**\n\n```\n");
                out.push_str(&subgraph);
                out.push_str("\n```\n\n");
            }
        }
    }

    out.push_str(
        "---\n\nWhen drafting the plan, you MAY reference these entities by name in\n\
         the plan text. Your plan will later be executed by another claude run\n\
         which can be pointed at these same entities via the plan's\n\
         `context_entities` frontmatter field — so naming them clearly is useful.\n",
    );

    (out, top_entities)
}

/// Spawn `claude --print --permission-mode plan` against the open vault
/// and use Anthropic's canonical 5-phase plan-mode workflow (Explore →
/// Design → Review → Finalize → ExitPlanMode) to draft a plan from a
/// short user goal. Captures the `ExitPlanMode` tool_use input.plan
/// field from the stream-json output, then writes it as the body of a
/// new Cortex plan note.
///
/// KG-aware: before spawning, the active typed knowledge graph is
/// fuzzy-matched against the goal text to pick the top ~5 relevant
/// entities. Their 2-hop subgraphs + a full entity index are written
/// to a temp context bundle and passed via `--append-system-prompt-file`.
/// The matched entity names are also injected into the drafted plan's
/// `context_entities: [...]` field so a subsequent execute_plan run
/// inherits the same KG context automatically.
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

    // Build KG context bundle for the goal. We drop the lock before the
    // (long-running) spawn so the rest of the app isn't blocked while
    // claude explores the vault.
    let (kg_context_md, matched_entities) = {
        let guard = state.knowledge_graph.read().map_err(|e| e.to_string())?;
        match guard.as_ref() {
            Some(kg) => build_kg_context_for_goal(kg, &goal),
            None => (String::new(), Vec::new()),
        }
    };

    let draft_id = uuid::Uuid::new_v4().to_string();

    // Materialize the context bundle to disk so --append-system-prompt-file
    // can point at it. Scratch dir mirrors the Phase B cortex-run-<id>
    // pattern from prepare.rs.
    let draft_dir = std::env::temp_dir().join(format!("cortex-draft-{}", draft_id));
    std::fs::create_dir_all(&draft_dir)
        .map_err(|e| format!("failed to create draft scratch dir: {}", e))?;
    let context_path = draft_dir.join("context.md");
    if !kg_context_md.is_empty() {
        std::fs::write(&context_path, &kg_context_md)
            .map_err(|e| format!("failed to write draft context bundle: {}", e))?;
    }

    // Build args for the plan-mode spawn. Same flag spine as execute_plan
    // but with --permission-mode plan and a tighter budget — plan mode
    // typically completes in 30-60s with a few exploration tool calls.
    // See CLAUDE.md "Phase B self-modification rule" and the regression
    // guard `build_args_does_not_include_hook_events_flag` in execute.rs.
    // `--include-hook-events` causes claude --print --output-format
    // stream-json to hang or exit with 0 events under Tauri shell spawn.
    // The fix in commit 69cacb0 removed it from execute.rs but missed
    // this draft path — symptom: drafting spinner stuck indefinitely
    // with only a "no stdin data received in 3s, proceeding without it"
    // stderr warning and zero stream-json events. DO NOT re-add.
    let mut args: Vec<String> = vec![
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
    ];
    if !kg_context_md.is_empty() {
        args.push("--append-system-prompt-file".to_string());
        args.push(context_path.to_string_lossy().to_string());
    }
    args.push("-p".to_string());
    args.push(goal.clone());

    log::info!(
        "draft_plan_from_goal: spawning plan-mode claude (draft_id={}, kg_entities={})",
        draft_id,
        matched_entities.len()
    );

    let _ = app.emit(
        "cortex://draft/started",
        serde_json::json!({
            "draft_id": draft_id,
            "goal": goal,
            "matched_entities": matched_entities,
        }),
    );

    let shell = app.shell();
    // macOS GUI apps don't inherit the user's shell PATH. Mirror the
    // PATH extension we do in execute.rs so the shell plugin can find
    // `claude` when Cortex is launched from Finder. See
    // feedback_tauri_gotchas memory + CLAUDE.md.
    let current_path = std::env::var("PATH").unwrap_or_default();
    let extended_path = format!("/opt/homebrew/bin:/usr/local/bin:{}", current_path);
    let (mut rx, child) = shell
        .command("claude")
        .args(&args)
        .current_dir(&vault_root)
        .env("PATH", &extended_path)
        .spawn()
        .map_err(|e| {
            let _ = std::fs::remove_dir_all(&draft_dir);
            format!("Failed to spawn claude (plan mode): {}", e)
        })?;

    // Track the child so abort_draft can SIGTERM it.
    {
        let mut drafts = state.active_drafts.lock().await;
        drafts.insert(draft_id.clone(), child);
    }

    // Drain the stream until termination, looking for the ExitPlanMode
    // tool_use whose input.plan field carries the freeform markdown plan
    // (the SDK shim injects it there in print mode — see
    // ExitPlanModeV2Tool.outputSchema in the Claude Code source).
    let mut plan_text: Option<String> = None;
    let mut last_assistant_text: Option<String> = None;
    let mut event_count = 0u32;
    let mut aborted = false;

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
                // Treat exit code 143 (128 + SIGTERM) as an abort signal.
                // macOS delivers this to spawned processes killed via
                // CommandChild::kill() from abort_draft.
                if payload.code == Some(143) || payload.signal == Some(15) {
                    aborted = true;
                }
                break;
            }
            CommandEvent::Error(err) => {
                let _ = app.emit(
                    "cortex://draft/error",
                    serde_json::json!({ "draft_id": draft_id, "message": err }),
                );
                // Remove the child handle before bailing out.
                {
                    let mut drafts = state.active_drafts.lock().await;
                    drafts.remove(&draft_id);
                }
                let _ = std::fs::remove_dir_all(&draft_dir);
                return Err(format!("draft spawn errored: {}", err));
            }
            _ => {}
        }
    }

    // Drop the child handle from active_drafts on every exit path.
    {
        let mut drafts = state.active_drafts.lock().await;
        drafts.remove(&draft_id);
    }

    // If abort_draft was called, emit the aborted event and bail out
    // without writing a plan file.
    if aborted {
        let _ = app.emit(
            "cortex://draft/aborted",
            serde_json::json!({
                "draft_id": draft_id,
                "partial_event_count": event_count,
            }),
        );
        let _ = std::fs::remove_dir_all(&draft_dir);
        return Err("draft aborted by user".to_string());
    }

    // Temp scratch dir is no longer needed once the spawn has finished.
    let _ = std::fs::remove_dir_all(&draft_dir);

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
    // draft template. drafted_by / drafted_at mark provenance. Matched
    // entity names are preserved in context_entities so a later
    // execute_plan run inherits the same KG context.
    let drafted_at = chrono::Utc::now().to_rfc3339();
    let escaped_goal = goal.replace('\n', " ").replace('"', "\\\"");
    let escaped_title = drafted_title.replace('\n', " ").replace('"', "\\\"");
    let context_entities_yaml = if matched_entities.is_empty() {
        "[]".to_string()
    } else {
        format!(
            "[{}]",
            matched_entities
                .iter()
                .map(|n| format!("\"{}\"", n.replace('"', "\\\"")))
                .collect::<Vec<_>>()
                .join(", ")
        )
    };
    let body = format!(
        "---\ntype: plan\ntitle: \"{title}\"\nstatus: ready\ngoal: \"{goal}\"\nmcp_servers: []\nallowed_tools: [\"Read\", \"Write\", \"Edit\", \"Grep\", \"Glob\"]\ndenied_tools: [\"Bash(rm *)\", \"Bash(git push *)\"]\ncontext_entities: {context_entities}\ncontext_notes: []\nmodel: claude-sonnet-4-5\nmax_turns: 30\nmax_budget_usd: 5\npermission_mode: acceptEdits\nworktree: false\ndrafted_by: claude-plan-mode\ndrafted_at: {drafted_at}\n---\n\n<!-- Drafted by Claude in plan mode from the goal above. Review and edit before executing. -->\n\n{body_md}\n",
        title = escaped_title,
        goal = escaped_goal,
        context_entities = context_entities_yaml,
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
            "matched_entities": matched_entities,
        }),
    );

    Ok(rel)
}

/// Tauri command: SIGTERM an in-flight plan drafting spawn by draft_id.
///
/// The background event loop in `draft_plan_from_goal` detects the SIGTERM
/// (exit code 143 / signal 15), emits `cortex://draft/aborted`, cleans up
/// its temp scratch dir, and returns `Err("draft aborted by user")` to its
/// original caller. The frontend's PlansPanel listens for the aborted
/// event and clears its drafting state.
///
/// Mirrors `run::execute::abort_run` exactly — separate state, separate
/// Tauri command, separate event channel.
#[tauri::command]
#[specta::specta]
pub async fn abort_draft(
    draft_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let child = {
        let mut drafts = state.active_drafts.lock().await;
        drafts.remove(&draft_id)
    };
    match child {
        Some(c) => c.kill().map_err(|e| format!("kill failed: {}", e)),
        None => Err(format!("draft {} not active", draft_id)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use cortex_kg::types::{EntityType, KgEntity, KgRelation};
    use cortex_kg::TypedKnowledgeGraph;

    #[test]
    fn slugify_basic() {
        assert_eq!(slugify("Hello World"), "hello-world");
        assert_eq!(slugify("Add a README!"), "add-a-readme");
        assert_eq!(slugify("   "), "untitled");
        assert_eq!(slugify("foo  bar  baz"), "foo-bar-baz");
        assert_eq!(slugify("---weird---"), "weird");
    }

    #[test]
    fn goal_keywords_drops_stopwords_and_short_tokens() {
        let kws = goal_keywords("Add a README explaining Cortex to the vault");
        assert!(kws.contains(&"readme".to_string()));
        assert!(kws.contains(&"explaining".to_string()));
        assert!(kws.contains(&"cortex".to_string()));
        assert!(kws.contains(&"vault".to_string()));
        assert!(!kws.contains(&"add".to_string()));
        assert!(!kws.contains(&"the".to_string()));
        assert!(!kws.contains(&"to".to_string()));
    }

    #[test]
    fn goal_keywords_dedupes() {
        let kws = goal_keywords("cortex cortex CORTEX");
        assert_eq!(kws, vec!["cortex"]);
    }

    fn seeded_kg_for_goal_tests() -> TypedKnowledgeGraph {
        let mut kg = TypedKnowledgeGraph::new();
        kg.store_entities(
            "notes/seed.md",
            vec![
                KgEntity {
                    name: "Cortex".to_string(),
                    entity_type: EntityType::Project,
                    description: "A knowledge graph desktop app".to_string(),
                    source_notes: vec!["notes/seed.md".to_string()],
                    aliases: vec![],
                },
                KgEntity {
                    name: "Knowledge Graph".to_string(),
                    entity_type: EntityType::Concept,
                    description: "Typed entities + relations".to_string(),
                    source_notes: vec!["notes/seed.md".to_string()],
                    aliases: vec![],
                },
                KgEntity {
                    name: "Axum".to_string(),
                    entity_type: EntityType::Technology,
                    description: "Rust web framework".to_string(),
                    source_notes: vec!["notes/seed.md".to_string()],
                    aliases: vec![],
                },
            ],
        );
        kg.store_relations(
            "notes/seed.md",
            vec![KgRelation {
                source: "Cortex".to_string(),
                predicate: "built_with".to_string(),
                target: "Axum".to_string(),
                source_note: "notes/seed.md".to_string(),
            }],
        );
        kg
    }

    #[test]
    fn rank_entities_for_goal_matches_relevant_entities() {
        let kg = seeded_kg_for_goal_tests();
        let ranked = rank_entities_for_goal(&kg, "extend cortex with a new endpoint", 5);
        assert!(ranked.contains(&"Cortex".to_string()));
    }

    #[test]
    fn rank_entities_for_goal_returns_empty_when_no_keywords_match() {
        let kg = seeded_kg_for_goal_tests();
        let ranked =
            rank_entities_for_goal(&kg, "unrelated tangent about cooking recipes", 5);
        // No entity in the seeded KG matches any of the food-related keywords.
        assert!(ranked.is_empty());
    }

    #[test]
    fn build_kg_context_for_goal_includes_entity_index_and_relevant_subgraph() {
        let kg = seeded_kg_for_goal_tests();
        let (bundle, matched) = build_kg_context_for_goal(&kg, "extend cortex somehow");
        assert!(bundle.contains("Cortex knowledge graph context"));
        assert!(bundle.contains("Entity index"));
        assert!(bundle.contains("Cortex"));
        assert!(bundle.contains("Axum"));
        assert!(matched.contains(&"Cortex".to_string()));
    }

    #[test]
    fn build_kg_context_for_goal_handles_empty_graph() {
        let kg = TypedKnowledgeGraph::new();
        let (bundle, matched) = build_kg_context_for_goal(&kg, "anything at all");
        assert!(bundle.contains("Graph is empty"));
        assert!(matched.is_empty());
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
