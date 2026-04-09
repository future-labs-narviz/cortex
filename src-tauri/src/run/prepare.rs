//! Phase B: turn a `type: plan` markdown note into a fully-resolved `RunSpec`
//! ready for `execute_plan` to spawn `claude` against.

use anyhow::Context;
use cortex_core::vault::Vault;
use cortex_kg::TypedKnowledgeGraph;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Plan note frontmatter, parsed directly from the YAML block (not via the
/// stringified `Frontmatter.extra` map, which loses Vec/number type info).
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct PlanFrontmatter {
    pub title: Option<String>,
    pub goal: Option<String>,
    #[serde(default)]
    pub mcp_servers: Vec<String>,
    #[serde(default)]
    pub allowed_tools: Vec<String>,
    #[serde(default)]
    pub denied_tools: Vec<String>,
    #[serde(default)]
    pub context_entities: Vec<String>,
    #[serde(default)]
    pub context_notes: Vec<String>,
    pub model: Option<String>,
    pub max_turns: Option<u32>,
    pub max_budget_usd: Option<f64>,
    pub permission_mode: Option<String>,
    #[serde(default)]
    pub worktree: bool,
}

/// Everything `execute_plan` needs to spawn a claude run.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RunSpec {
    /// UUIDv4 used as Claude Code's `--session-id`.
    pub run_id: String,
    /// Vault-relative plan note path.
    pub plan_path: String,
    /// Parsed plan frontmatter.
    pub plan: PlanFrontmatter,
    /// Absolute path to the per-run context bundle (`<run_dir>/context.md`).
    pub context_bundle_path: PathBuf,
    /// Absolute path to the per-run MCP config (`<run_dir>/mcp.json`).
    pub mcp_config_path: PathBuf,
    /// Per-run scratch directory under the OS temp dir.
    pub run_dir: PathBuf,
    /// Vault-relative path of the pre-written `type: session` note.
    pub session_note_path: String,
    /// Working directory the spawned claude inherits (the vault root).
    pub cwd: PathBuf,
    /// The text passed via `-p` to claude — taken from the plan's `goal`.
    pub prompt: String,
}

/// Read a `type: plan` note, build a context bundle from KG entities and
/// reference notes, write a per-run MCP config, generate a UUIDv4 run id,
/// pre-write a session note marked `running`, and return the resolved RunSpec.
pub fn prepare_run(
    vault_root: &Path,
    plan_path: &str,
    kg: &TypedKnowledgeGraph,
) -> anyhow::Result<RunSpec> {
    // 1. Read the plan note via Vault.
    let vault = Vault::new(vault_root.to_path_buf())
        .with_context(|| format!("Failed to open vault at {}", vault_root.display()))?;
    let note = vault
        .read_note(plan_path)
        .with_context(|| format!("Failed to read plan note at {}", plan_path))?;

    // 2. Verify it is a type:plan note.
    let is_plan = note
        .frontmatter
        .as_ref()
        .and_then(|fm| fm.extra.get("type"))
        .map(|s| s == "plan")
        .unwrap_or(false);
    if !is_plan {
        return Err(anyhow::anyhow!(
            "Note at {} is not a type:plan note",
            plan_path
        ));
    }

    // 3. Re-parse the YAML frontmatter directly so Vec/number fields keep their type.
    let raw = std::fs::read_to_string(vault_root.join(plan_path))
        .with_context(|| format!("Failed to re-read plan note at {}", plan_path))?;
    let yaml_block = extract_yaml_block(&raw)
        .ok_or_else(|| anyhow::anyhow!("no frontmatter block in {}", plan_path))?;
    let plan: PlanFrontmatter = serde_yaml::from_str(yaml_block)
        .with_context(|| format!("Failed to parse plan frontmatter in {}", plan_path))?;

    // 4. Generate a v4 UUID for this run.
    let run_id = uuid::Uuid::new_v4().to_string();

    // 5. Resolve KG context entities into a serialized subgraph string.
    let kg_section = if plan.context_entities.is_empty() {
        "(no entities requested)".to_string()
    } else {
        plan.context_entities
            .iter()
            .map(|name| kg.serialize_subgraph(name, 2))
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join("\n\n---\n\n")
    };
    let kg_section = if kg_section.is_empty() {
        "(no entities requested)".to_string()
    } else {
        kg_section
    };

    // 6. Inline reference notes verbatim, skipping any that fail to read.
    let mut note_sections: Vec<String> = Vec::new();
    for ctx_note_path in &plan.context_notes {
        match vault.read_note(ctx_note_path) {
            Ok(n) => {
                note_sections.push(format!("### {}\n{}", ctx_note_path, n.content));
            }
            Err(e) => {
                log::warn!(
                    "prepare_run: skipping context note {} ({})",
                    ctx_note_path,
                    e
                );
            }
        }
    }
    let notes_section = if note_sections.is_empty() {
        "(no reference notes)".to_string()
    } else {
        note_sections.join("\n\n")
    };

    // 7. Build the context bundle markdown.
    let title = plan.title.clone().unwrap_or_else(|| plan_path.to_string());
    let goal_text = plan
        .goal
        .clone()
        .unwrap_or_else(|| "(no goal specified)".to_string());
    let context_bundle = format!(
        "# Cortex run context for plan: {}\n\n## Goal\n{}\n\n## Knowledge graph subgraph\n{}\n\n## Reference notes\n{}\n",
        title, goal_text, kg_section, notes_section
    );

    // 8. Create the per-run scratch directory and write context.md.
    let run_dir = std::env::temp_dir().join(format!("cortex-run-{}", run_id));
    std::fs::create_dir_all(&run_dir)
        .with_context(|| format!("Failed to create run dir {}", run_dir.display()))?;
    let context_bundle_path = run_dir.join("context.md");
    std::fs::write(&context_bundle_path, &context_bundle)
        .with_context(|| format!("Failed to write context bundle at {}", context_bundle_path.display()))?;

    // 9. Build per-run MCP config: filter user .mcp.json by plan.mcp_servers,
    //    then merge cortex on top so it always wins.
    let mcp_config_path = run_dir.join("mcp.json");
    let mcp_value = build_mcp_config(vault_root, &plan.mcp_servers);
    std::fs::write(
        &mcp_config_path,
        serde_json::to_string_pretty(&mcp_value)
            .with_context(|| "Failed to serialize per-run MCP config")?,
    )
    .with_context(|| format!("Failed to write MCP config at {}", mcp_config_path.display()))?;

    // 10. Pre-write the session note as type:session, status:running.
    let sessions_dir = vault_root.join("sessions");
    std::fs::create_dir_all(&sessions_dir)
        .with_context(|| format!("Failed to create sessions dir {}", sessions_dir.display()))?;
    let session_note_rel = format!("sessions/{}.md", run_id);
    let session_note_abs = vault_root.join(&session_note_rel);
    let started_at = chrono::Utc::now().to_rfc3339();
    let session_note_body = format!(
        "---\ntype: session\nsession_id: {run_id}\nplan_ref: {plan_path}\nstarted_at: {started_at}\nstatus: running\n---\n\n# Session {run_id}\n\nSpawned by Cortex Phase B for plan: {plan_path}\n",
        run_id = run_id,
        plan_path = plan_path,
        started_at = started_at,
    );
    std::fs::write(&session_note_abs, &session_note_body)
        .with_context(|| format!("Failed to write session note at {}", session_note_abs.display()))?;

    // 11. Build the prompt — for v1 it's just the plan goal text.
    let prompt = plan
        .goal
        .clone()
        .unwrap_or_else(|| "Execute the plan as described.".to_string());

    // 12. Return the fully resolved RunSpec.
    Ok(RunSpec {
        run_id,
        plan_path: plan_path.to_string(),
        plan,
        context_bundle_path,
        mcp_config_path,
        run_dir,
        session_note_path: session_note_rel,
        cwd: vault_root.to_path_buf(),
        prompt,
    })
}

/// Best-effort cleanup of a per-run scratch directory. Removing a missing
/// directory is treated as success.
pub fn cleanup_run(run_dir: &Path) -> anyhow::Result<()> {
    if run_dir.exists() {
        std::fs::remove_dir_all(run_dir)
            .with_context(|| format!("Failed to clean up run dir {}", run_dir.display()))?;
    }
    Ok(())
}

/// Extract the raw YAML block between the first two `---` fences in a markdown
/// note. Returns None if no frontmatter is present.
fn extract_yaml_block(raw: &str) -> Option<&str> {
    let trimmed = raw.trim_start();
    let stripped = trimmed.strip_prefix("---")?;
    let after_first = stripped.strip_prefix('\n').unwrap_or(stripped);
    let end = after_first.find("\n---")?;
    Some(&after_first[..end])
}

/// Build the per-run MCP config JSON value: cortex MCP server is always
/// included; user vault servers are filtered to those listed in `plan_servers`.
fn build_mcp_config(vault_root: &Path, plan_servers: &[String]) -> serde_json::Value {
    use serde_json::{json, Map, Value};

    let mut servers: Map<String, Value> = Map::new();

    // Filter user .mcp.json by plan_servers if it exists.
    let user_mcp_path = vault_root.join(".mcp.json");
    if user_mcp_path.exists() {
        if let Ok(raw) = std::fs::read_to_string(&user_mcp_path) {
            if let Ok(value) = serde_json::from_str::<Value>(&raw) {
                if let Some(user_servers) = value.get("mcpServers").and_then(|v| v.as_object()) {
                    for (name, def) in user_servers {
                        if plan_servers.iter().any(|n| n == name) {
                            servers.insert(name.clone(), def.clone());
                        }
                    }
                }
            } else {
                log::warn!(
                    "prepare_run: failed to parse user .mcp.json at {}",
                    user_mcp_path.display()
                );
            }
        }
    }

    // Cortex always wins on key collision.
    servers.insert(
        "cortex".to_string(),
        json!({
            "type": "http",
            "url": "http://127.0.0.1:3847/mcp"
        }),
    );

    json!({ "mcpServers": Value::Object(servers) })
}

#[cfg(test)]
mod tests {
    use super::*;
    use cortex_kg::types::{EntityType, KgEntity, KgRelation};
    use tempfile::TempDir;

    fn write(vault: &Path, rel: &str, content: &str) {
        let abs = vault.join(rel);
        if let Some(parent) = abs.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        std::fs::write(abs, content).unwrap();
    }

    fn empty_kg() -> TypedKnowledgeGraph {
        TypedKnowledgeGraph::new()
    }

    fn seeded_kg() -> TypedKnowledgeGraph {
        let mut kg = TypedKnowledgeGraph::new();
        kg.store_entities(
            "notes/seed.md",
            vec![
                KgEntity {
                    name: "Entity One".to_string(),
                    entity_type: EntityType::Concept,
                    description: "First entity".to_string(),
                    source_notes: vec!["notes/seed.md".to_string()],
                    aliases: vec![],
                },
                KgEntity {
                    name: "Entity Two".to_string(),
                    entity_type: EntityType::Concept,
                    description: "Second entity".to_string(),
                    source_notes: vec!["notes/seed.md".to_string()],
                    aliases: vec![],
                },
            ],
        );
        kg.store_relations(
            "notes/seed.md",
            vec![KgRelation {
                source: "Entity One".to_string(),
                predicate: "relates-to".to_string(),
                target: "Entity Two".to_string(),
                source_note: "notes/seed.md".to_string(),
            }],
        );
        kg
    }

    #[test]
    fn parses_minimal_plan_frontmatter() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        write(
            vault,
            "plans/minimal.md",
            "---\ntype: plan\ngoal: do a thing\n---\n\nbody\n",
        );
        let spec = prepare_run(vault, "plans/minimal.md", &empty_kg()).unwrap();
        assert!(spec.plan.allowed_tools.is_empty());
        assert_eq!(spec.plan.goal.as_deref(), Some("do a thing"));
        assert!(spec.plan.model.is_none());
    }

    #[test]
    fn parses_full_plan_frontmatter() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        write(
            vault,
            "plans/full.md",
            r#"---
type: plan
title: Full plan
status: ready
goal: build the thing
mcp_servers: ["serverA"]
allowed_tools: ["Read", "Write"]
denied_tools: ["Bash(rm *)"]
context_entities: ["Cortex"]
context_notes: ["notes/foo.md"]
model: claude-sonnet-4-5
max_turns: 12
max_budget_usd: 2.5
permission_mode: acceptEdits
worktree: true
---

body
"#,
        );
        let spec = prepare_run(vault, "plans/full.md", &empty_kg()).unwrap();
        assert_eq!(spec.plan.title.as_deref(), Some("Full plan"));
        assert_eq!(spec.plan.goal.as_deref(), Some("build the thing"));
        assert_eq!(spec.plan.mcp_servers, vec!["serverA"]);
        assert_eq!(spec.plan.allowed_tools, vec!["Read", "Write"]);
        assert_eq!(spec.plan.denied_tools, vec!["Bash(rm *)"]);
        assert_eq!(spec.plan.context_entities, vec!["Cortex"]);
        assert_eq!(spec.plan.context_notes, vec!["notes/foo.md"]);
        assert_eq!(spec.plan.model.as_deref(), Some("claude-sonnet-4-5"));
        assert_eq!(spec.plan.max_turns, Some(12));
        assert_eq!(spec.plan.max_budget_usd, Some(2.5));
        assert_eq!(spec.plan.permission_mode.as_deref(), Some("acceptEdits"));
        assert!(spec.plan.worktree);
    }

    #[test]
    fn rejects_non_plan_note() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        write(
            vault,
            "sessions/x.md",
            "---\ntype: session\nsession_id: abc\n---\n",
        );
        let err = prepare_run(vault, "sessions/x.md", &empty_kg()).unwrap_err();
        assert!(
            err.to_string().contains("not a type:plan note"),
            "expected 'not a type:plan note', got: {}",
            err
        );
    }

    #[test]
    fn rejects_no_frontmatter() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        write(vault, "plans/bare.md", "no frontmatter here\n");
        let err = prepare_run(vault, "plans/bare.md", &empty_kg()).unwrap_err();
        assert!(
            err.to_string().contains("not a type:plan note"),
            "got: {}",
            err
        );
    }

    #[test]
    fn resolves_context_entities_to_subgraph_string() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        write(
            vault,
            "plans/p.md",
            "---\ntype: plan\ngoal: g\ncontext_entities: [\"Entity One\"]\n---\n",
        );
        let spec = prepare_run(vault, "plans/p.md", &seeded_kg()).unwrap();
        let bundle = std::fs::read_to_string(&spec.context_bundle_path).unwrap();
        assert!(
            bundle.contains("Entity One"),
            "bundle missing entity: {}",
            bundle
        );
        assert!(
            bundle.contains("relates-to"),
            "bundle missing relation: {}",
            bundle
        );
    }

    #[test]
    fn inlines_context_notes_verbatim() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        write(
            vault,
            "notes/foo.md",
            "MAGIC_MARKER_FOO_NOTE_CONTENT_12345\n",
        );
        write(
            vault,
            "plans/p.md",
            "---\ntype: plan\ngoal: g\ncontext_notes: [\"notes/foo.md\"]\n---\n",
        );
        let spec = prepare_run(vault, "plans/p.md", &empty_kg()).unwrap();
        let bundle = std::fs::read_to_string(&spec.context_bundle_path).unwrap();
        assert!(
            bundle.contains("MAGIC_MARKER_FOO_NOTE_CONTENT_12345"),
            "bundle missing inlined note content"
        );
    }

    #[test]
    fn silently_skips_missing_context_notes() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        write(
            vault,
            "plans/p.md",
            "---\ntype: plan\ngoal: g\ncontext_notes: [\"does/not/exist.md\"]\n---\n",
        );
        let spec = prepare_run(vault, "plans/p.md", &empty_kg()).unwrap();
        assert!(spec.context_bundle_path.exists());
    }

    #[test]
    fn mcp_config_always_includes_cortex_server() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        write(vault, "plans/p.md", "---\ntype: plan\ngoal: g\n---\n");
        let spec = prepare_run(vault, "plans/p.md", &empty_kg()).unwrap();
        let raw = std::fs::read_to_string(&spec.mcp_config_path).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap();
        let cortex = parsed
            .get("mcpServers")
            .and_then(|v| v.get("cortex"))
            .expect("cortex server present");
        assert_eq!(cortex.get("type").and_then(|v| v.as_str()), Some("http"));
        assert_eq!(
            cortex.get("url").and_then(|v| v.as_str()),
            Some("http://127.0.0.1:3847/mcp")
        );
    }

    #[test]
    fn mcp_config_filters_user_servers_by_name() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        write(
            vault,
            ".mcp.json",
            r#"{
  "mcpServers": {
    "serverA": { "type": "stdio", "command": "a" },
    "serverB": { "type": "stdio", "command": "b" }
  }
}"#,
        );
        write(
            vault,
            "plans/p.md",
            "---\ntype: plan\ngoal: g\nmcp_servers: [\"serverA\"]\n---\n",
        );
        let spec = prepare_run(vault, "plans/p.md", &empty_kg()).unwrap();
        let raw = std::fs::read_to_string(&spec.mcp_config_path).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap();
        let servers = parsed.get("mcpServers").and_then(|v| v.as_object()).unwrap();
        assert!(servers.contains_key("serverA"));
        assert!(servers.contains_key("cortex"));
        assert!(!servers.contains_key("serverB"));
    }

    #[test]
    fn generates_uuidv4_run_id() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        write(vault, "plans/p.md", "---\ntype: plan\ngoal: g\n---\n");
        let spec = prepare_run(vault, "plans/p.md", &empty_kg()).unwrap();
        let parsed = uuid::Uuid::parse_str(&spec.run_id).expect("valid uuid");
        assert_eq!(parsed.get_version(), Some(uuid::Version::Random));
    }

    #[test]
    fn creates_run_dir_with_context_and_mcp_files() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        write(vault, "plans/p.md", "---\ntype: plan\ngoal: g\n---\n");
        let spec = prepare_run(vault, "plans/p.md", &empty_kg()).unwrap();
        assert!(spec.run_dir.exists());
        assert!(spec.context_bundle_path.exists());
        assert!(spec.mcp_config_path.exists());
        // cleanup
        let _ = cleanup_run(&spec.run_dir);
    }

    #[test]
    fn pre_writes_session_note_with_running_status() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        write(vault, "plans/p.md", "---\ntype: plan\ngoal: g\n---\n");
        let spec = prepare_run(vault, "plans/p.md", &empty_kg()).unwrap();
        let abs = vault.join(&spec.session_note_path);
        let body = std::fs::read_to_string(&abs).unwrap();
        assert!(body.contains("status: running"), "body: {}", body);
        assert!(body.contains("plan_ref: plans/p.md"), "body: {}", body);
        assert!(body.contains(&format!("session_id: {}", spec.run_id)));
    }

    #[test]
    fn cleanup_run_removes_dir() {
        let dir = TempDir::new().unwrap();
        let vault = dir.path();
        write(vault, "plans/p.md", "---\ntype: plan\ngoal: g\n---\n");
        let spec = prepare_run(vault, "plans/p.md", &empty_kg()).unwrap();
        assert!(spec.run_dir.exists());
        cleanup_run(&spec.run_dir).unwrap();
        assert!(!spec.run_dir.exists());
        // calling again on missing dir is still Ok
        cleanup_run(&spec.run_dir).unwrap();
    }
}
