use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use anyhow::Context;
use cortex_kg::types::{EntityType, KgEntity, KgRelation};
use cortex_kg::TypedKnowledgeGraph;
use serde_json::json;

use crate::{transcript, vertex};

#[allow(unused_imports)]
use transcript::ParsedTranscript;

pub async fn extraction_job(
    kg: Arc<RwLock<Option<TypedKnowledgeGraph>>>,
    vault_root: PathBuf,
    session_id: String,
    transcript_path: PathBuf,
) -> anyhow::Result<()> {
    let parsed = transcript::parse_jsonl(&transcript_path)
        .with_context(|| format!("Failed to parse transcript at {}", transcript_path.display()))?;
    extraction_job_from_parsed(kg, vault_root, session_id, parsed).await
}

/// Variant of `extraction_job` that takes an already-parsed transcript
/// instead of reading from a JSONL file. Used by Phase B's `execute_plan`
/// when the in-memory transcript is built from stream-json events.
pub async fn extraction_job_from_parsed(
    kg: Arc<RwLock<Option<TypedKnowledgeGraph>>>,
    vault_root: PathBuf,
    session_id: String,
    parsed: transcript::ParsedTranscript,
) -> anyhow::Result<()> {
    // 2. Build VertexClient or skip
    let client = match vertex::VertexClient::from_env() {
        Some(c) => c,
        None => {
            log::warn!("extract pipeline disabled: populate ~/Desktop/Cortex/.env with GCP_SERVICE_ACCOUNT_JSON to enable post-session entity extraction via Vertex AI");
            return Ok(());
        }
    };

    // 3. Build user prompt: combine messages + tool_calls, truncated to ~30000 chars
    let mut prompt_parts: Vec<String> = Vec::new();

    prompt_parts.push("## User Messages\n".to_string());
    for msg in parsed.user_messages.iter().take(30) {
        prompt_parts.push(format!("USER: {}", msg));
    }

    prompt_parts.push("\n## Assistant Messages\n".to_string());
    for msg in parsed.assistant_messages.iter().take(30) {
        prompt_parts.push(format!("ASSISTANT: {}", msg));
    }

    if !parsed.tool_calls.is_empty() {
        prompt_parts.push("\n## Tool Calls\n".to_string());
        for (tool, summary) in &parsed.tool_calls {
            prompt_parts.push(format!("- {}({})", tool, summary));
        }
    }

    if !parsed.files_modified.is_empty() {
        prompt_parts.push("\n## Files Modified\n".to_string());
        for file in &parsed.files_modified {
            prompt_parts.push(format!("- {}", file));
        }
    }

    let mut user_prompt = prompt_parts.join("\n");
    if user_prompt.len() > 30000 {
        user_prompt.truncate(30000);
        user_prompt.push_str("\n\n[transcript truncated]");
    }

    // 4. Define input_schema for forced tool_use
    let input_schema = json!({
        "type": "object",
        "properties": {
            "entities": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "entity_type": {
                            "type": "string",
                            "enum": ["Person","Project","Technology","Decision","Pattern","Organization","Concept"]
                        },
                        "description": {"type": "string"}
                    },
                    "required": ["name","entity_type","description"]
                }
            },
            "relations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "source": {"type": "string"},
                        "predicate": {"type": "string"},
                        "target": {"type": "string"}
                    },
                    "required": ["source","predicate","target"]
                }
            },
            "key_decisions": {"type": "array", "items": {"type": "string"}},
            "what_worked": {"type": "array", "items": {"type": "string"}},
            "what_failed": {"type": "array", "items": {"type": "string"}},
            "summary": {"type": "string"}
        },
        "required": ["entities","relations","key_decisions","what_worked","what_failed","summary"]
    });

    let system = "You are a knowledge extraction agent. Given a Claude Code coding session transcript, extract structured knowledge: entities (people, projects, technologies, decisions, patterns, organizations, concepts), typed relations between them (decided, built_with, depends_on, supersedes, part_of, used_by, etc.), key decisions made, what worked, what failed, and a one-paragraph summary. Be selective — only entities CENTRAL to the session, not incidental mentions.";

    // 5. Call Vertex with claude-haiku-4-5@20251001
    let result = client
        .extract_structured(
            "claude-haiku-4-5@20251001",
            system,
            &user_prompt,
            "extract_knowledge",
            "Extract entities, relations, decisions, outcomes, and a summary from the session transcript.",
            input_schema,
            4096,
        )
        .await
        .with_context(|| "Vertex extraction call failed")?;

    // 6. Parse result into KgEntity / KgRelation
    let entities: Vec<KgEntity> = result
        .get("entities")
        .and_then(|e| e.as_array())
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|e| {
            let name = e.get("name")?.as_str()?.to_string();
            let entity_type_str = e.get("entity_type")?.as_str()?;
            let description = e.get("description")?.as_str()?.to_string();
            let entity_type = parse_entity_type(entity_type_str);
            Some(KgEntity {
                name,
                entity_type,
                description,
                source_notes: vec![session_id.clone()],
                aliases: Vec::new(),
            })
        })
        .collect();

    let relations: Vec<KgRelation> = result
        .get("relations")
        .and_then(|r| r.as_array())
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|r| {
            let source = r.get("source")?.as_str()?.to_string();
            let predicate = r.get("predicate")?.as_str()?.to_string();
            let target = r.get("target")?.as_str()?.to_string();
            Some(KgRelation {
                source,
                predicate,
                target,
                source_note: session_id.clone(),
            })
        })
        .collect();

    // 7. Store in kg
    {
        let mut guard = kg.write().map_err(|e| anyhow::anyhow!("KG lock poisoned: {}", e))?;
        if let Some(ref mut graph) = *guard {
            graph.store_entities(&session_id, entities);
            graph.store_relations(&session_id, relations);
        } else {
            log::warn!("cortex-extract: KG not initialized, skipping entity storage");
        }
    }

    // 8. Save kg to vault_root/.cortex/kg.json
    {
        let guard = kg.read().map_err(|e| anyhow::anyhow!("KG lock poisoned: {}", e))?;
        if let Some(ref graph) = *guard {
            let kg_path = vault_root.join(".cortex").join("kg.json");
            if let Err(e) = graph.save(&kg_path) {
                log::error!("cortex-extract: failed to save KG: {}", e);
            }
        }
    }

    // 9. Write retrospective markdown note
    let summary = result
        .get("summary")
        .and_then(|s| s.as_str())
        .unwrap_or("(no summary)")
        .to_string();

    let key_decisions = result
        .get("key_decisions")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| format!("- {}", s))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();

    let what_worked = result
        .get("what_worked")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| format!("- {}", s))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();

    let what_failed = result
        .get("what_failed")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| format!("- {}", s))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();

    let retro_note = format!(
        r#"---
type: retrospective
session_id: {}
---

# Session Retrospective: {}

## Summary
{}

## What Worked
{}

## What Failed
{}

## Key Decisions
{}
"#,
        session_id, session_id, summary, what_worked, what_failed, key_decisions
    );

    let sessions_dir = vault_root.join("sessions");
    if let Err(e) = std::fs::create_dir_all(&sessions_dir) {
        log::error!("cortex-extract: failed to create sessions dir: {}", e);
    } else {
        let retro_path = sessions_dir.join(format!("{}-retrospective.md", session_id));
        if let Err(e) = std::fs::write(&retro_path, &retro_note) {
            log::error!("cortex-extract: failed to write retrospective note: {}", e);
        } else {
            log::info!("cortex-extract: wrote retrospective to {}", retro_path.display());
        }
    }

    log::info!(
        "cortex-extract: extraction complete for session {}",
        session_id
    );
    Ok(())
}

fn parse_entity_type(s: &str) -> EntityType {
    match s {
        "Person" => EntityType::Person,
        "Project" => EntityType::Project,
        "Technology" => EntityType::Technology,
        "Decision" => EntityType::Decision,
        "Pattern" => EntityType::Pattern,
        "Organization" => EntityType::Organization,
        _ => EntityType::Concept,
    }
}
