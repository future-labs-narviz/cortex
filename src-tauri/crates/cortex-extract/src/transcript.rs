use std::collections::HashSet;
use std::path::Path;

use anyhow::Context;

/// Parsed representation of a Claude Code JSONL session transcript.
#[derive(Debug, Clone, Default)]
pub struct ParsedTranscript {
    pub session_id: String,
    pub user_messages: Vec<String>,
    pub assistant_messages: Vec<String>,
    pub files_modified: Vec<String>,
    pub tool_calls: Vec<(String, String)>, // (tool_name, brief summary)
}

const FILE_TOOLS: &[&str] = &["Edit", "Write", "MultiEdit", "NotebookEdit"];

/// Build a `ParsedTranscript` from a sequence of stream-json event objects
/// (the same shapes Phase B captures from a live `claude --print
/// --output-format stream-json` run). Mirrors `parse_jsonl` but operates on
/// already-deserialized JSON values held in memory, so the live run loop can
/// hand the result straight to `extraction_job_from_parsed` without round-
/// tripping through disk.
pub fn parse_stream_events(events: &[serde_json::Value]) -> ParsedTranscript {
    let mut transcript = ParsedTranscript::default();
    let mut files_seen: HashSet<String> = HashSet::new();

    for event in events {
        let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");

        match event_type {
            // session_id from system/init.
            "system" => {
                if let Some(sub) = event.get("subtype").and_then(|s| s.as_str()) {
                    if sub == "init" {
                        if let Some(sid) = event.get("session_id").and_then(|s| s.as_str()) {
                            if transcript.session_id.is_empty() {
                                transcript.session_id = sid.to_string();
                            }
                        }
                    }
                    // skip compact_boundary, hook_started, hook_response, etc.
                }
            }
            // Full assistant snapshot — same shape as JSONL `assistant` turn.
            "assistant" => {
                if let Some(message) = event.get("message") {
                    if let Some(content_arr) = message.get("content").and_then(|c| c.as_array()) {
                        for item in content_arr {
                            let item_type = item.get("type").and_then(|t| t.as_str()).unwrap_or("");
                            match item_type {
                                "text" => {
                                    if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                                        if !text.is_empty() {
                                            transcript.assistant_messages.push(text.to_string());
                                        }
                                    }
                                }
                                "tool_use" => {
                                    let tool_name = item
                                        .get("name")
                                        .and_then(|n| n.as_str())
                                        .unwrap_or("unknown");

                                    if FILE_TOOLS.contains(&tool_name) {
                                        if let Some(file_path) = item
                                            .get("input")
                                            .and_then(|i| i.get("file_path"))
                                            .and_then(|f| f.as_str())
                                        {
                                            if files_seen.insert(file_path.to_string()) {
                                                transcript
                                                    .files_modified
                                                    .push(file_path.to_string());
                                            }
                                        }
                                    }

                                    let summary = item
                                        .get("input")
                                        .and_then(|i| i.get("file_path"))
                                        .and_then(|f| f.as_str())
                                        .map(|f| f.to_string())
                                        .unwrap_or_else(|| {
                                            item.get("input")
                                                .and_then(|i| i.as_object())
                                                .map(|obj| {
                                                    obj.keys()
                                                        .take(3)
                                                        .cloned()
                                                        .collect::<Vec<_>>()
                                                        .join(", ")
                                                })
                                                .unwrap_or_default()
                                        });

                                    transcript
                                        .tool_calls
                                        .push((tool_name.to_string(), summary));
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
            // The result event carries the final aggregated text plus stop reason.
            "result" => {
                if let Some(text) = event.get("result").and_then(|t| t.as_str()) {
                    if !text.is_empty() && !transcript.assistant_messages.iter().any(|m| m == text)
                    {
                        transcript.assistant_messages.push(text.to_string());
                    }
                }
            }
            _ => {
                // skip stream_event, rate_limit_event, attribution-snapshot, etc.
            }
        }
    }

    transcript
}

pub fn parse_jsonl(path: &Path) -> anyhow::Result<ParsedTranscript> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("Failed to read transcript at {}", path.display()))?;

    parse_jsonl_str(&content)
}

fn parse_jsonl_str(content: &str) -> anyhow::Result<ParsedTranscript> {
    let mut transcript = ParsedTranscript::default();
    let mut files_seen: HashSet<String> = HashSet::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let value: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue, // skip unparseable lines defensively
        };

        let turn_type = value.get("type").and_then(|t| t.as_str()).unwrap_or("");

        match turn_type {
            "user" => {
                if let Some(text) = extract_text_from_message(&value) {
                    if !text.is_empty() {
                        transcript.user_messages.push(text);
                    }
                }
            }
            "assistant" => {
                if let Some(message) = value.get("message") {
                    if let Some(content_arr) = message.get("content").and_then(|c| c.as_array()) {
                        for item in content_arr {
                            let item_type = item.get("type").and_then(|t| t.as_str()).unwrap_or("");
                            match item_type {
                                "text" => {
                                    if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                                        if !text.is_empty() {
                                            transcript.assistant_messages.push(text.to_string());
                                        }
                                    }
                                }
                                "tool_use" => {
                                    let tool_name = item
                                        .get("name")
                                        .and_then(|n| n.as_str())
                                        .unwrap_or("unknown");

                                    // Extract file_path from file-modifying tools
                                    if FILE_TOOLS.contains(&tool_name) {
                                        if let Some(file_path) = item
                                            .get("input")
                                            .and_then(|i| i.get("file_path"))
                                            .and_then(|f| f.as_str())
                                        {
                                            if files_seen.insert(file_path.to_string()) {
                                                transcript.files_modified.push(file_path.to_string());
                                            }
                                        }
                                    }

                                    // Brief summary: "ToolName(file_path or input keys)"
                                    let summary = item
                                        .get("input")
                                        .and_then(|i| i.get("file_path"))
                                        .and_then(|f| f.as_str())
                                        .map(|f| f.to_string())
                                        .unwrap_or_else(|| {
                                            item.get("input")
                                                .and_then(|i| i.as_object())
                                                .map(|obj| {
                                                    obj.keys()
                                                        .take(3)
                                                        .cloned()
                                                        .collect::<Vec<_>>()
                                                        .join(", ")
                                                })
                                                .unwrap_or_default()
                                        });

                                    transcript.tool_calls.push((tool_name.to_string(), summary));
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    Ok(transcript)
}

/// Extract text content from a user/assistant message field.
/// Handles both plain string and array-of-content-blocks.
fn extract_text_from_message(value: &serde_json::Value) -> Option<String> {
    let message = value.get("message")?;
    let content = message.get("content")?;

    if let Some(s) = content.as_str() {
        return Some(s.to_string());
    }

    if let Some(arr) = content.as_array() {
        let mut parts = Vec::new();
        for item in arr {
            let item_type = item.get("type").and_then(|t| t.as_str()).unwrap_or("");
            if item_type == "text" {
                if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                    parts.push(text.to_string());
                }
            }
        }
        if !parts.is_empty() {
            return Some(parts.join("\n"));
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = r#"{"type":"user","message":{"content":"Hello, can you help me build a Rust crate?"}}
{"type":"assistant","message":{"content":[{"type":"text","text":"Sure! Let me create the files."},{"type":"tool_use","name":"Write","input":{"file_path":"src/lib.rs","content":"// lib"}}]}}
{"type":"user","message":{"content":[{"type":"text","text":"Now edit the main file please."}]}}
{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Edit","input":{"file_path":"src/main.rs","old_str":"fn main() {}","new_str":"fn main() { println!(\"hi\"); }"}},{"type":"text","text":"Done editing."}]}}
{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"cargo check"}}]}}"#;

    #[test]
    fn test_parse_jsonl_fixture() {
        let transcript = parse_jsonl_str(FIXTURE).expect("should parse fixture");

        // User messages
        assert_eq!(transcript.user_messages.len(), 2);
        assert!(transcript.user_messages[0].contains("Rust crate"));
        assert!(transcript.user_messages[1].contains("main file"));

        // Assistant text messages
        assert!(transcript.assistant_messages.iter().any(|m| m.contains("Sure!")));
        assert!(transcript.assistant_messages.iter().any(|m| m.contains("Done editing.")));

        // Files modified — Write and Edit both captured, deduped
        assert!(
            transcript.files_modified.contains(&"src/lib.rs".to_string()),
            "lib.rs should be in files_modified"
        );
        assert!(
            transcript.files_modified.contains(&"src/main.rs".to_string()),
            "main.rs should be in files_modified"
        );
        assert_eq!(transcript.files_modified.len(), 2, "should be deduped");

        // Tool calls: Write, Edit, Bash
        assert!(transcript.tool_calls.iter().any(|(name, _)| name == "Write"));
        assert!(transcript.tool_calls.iter().any(|(name, _)| name == "Edit"));
        assert!(transcript.tool_calls.iter().any(|(name, _)| name == "Bash"));
    }

    #[test]
    fn test_parse_jsonl_skips_bad_lines() {
        let input = "not json at all\n{\"type\":\"user\",\"message\":{\"content\":\"hello\"}}\n{broken}";
        let transcript = parse_jsonl_str(input).expect("should not error on bad lines");
        assert_eq!(transcript.user_messages.len(), 1);
        assert_eq!(transcript.user_messages[0], "hello");
    }

    #[test]
    fn parse_stream_events_extracts_assistant_text_and_tool_uses() {
        let events: Vec<serde_json::Value> = vec![
            serde_json::json!({
                "type": "system",
                "subtype": "init",
                "session_id": "abc-123"
            }),
            serde_json::json!({
                "type": "assistant",
                "message": {
                    "content": [
                        { "type": "text", "text": "Working on it." },
                        { "type": "tool_use", "name": "Write", "input": { "file_path": "README.md", "content": "hi" } }
                    ]
                }
            }),
            serde_json::json!({
                "type": "result",
                "subtype": "success",
                "result": "Done."
            }),
        ];
        let parsed = parse_stream_events(&events);
        assert_eq!(parsed.session_id, "abc-123");
        assert!(parsed.assistant_messages.iter().any(|m| m == "Working on it."));
        assert!(parsed.assistant_messages.iter().any(|m| m == "Done."));
        assert!(parsed.files_modified.contains(&"README.md".to_string()));
        assert!(parsed.tool_calls.iter().any(|(n, _)| n == "Write"));
    }

    #[test]
    fn parse_stream_events_skips_unknown_event_types() {
        let events: Vec<serde_json::Value> = vec![
            serde_json::json!({ "type": "stream_event", "event": { "type": "content_block_delta" } }),
            serde_json::json!({ "type": "rate_limit_event", "tokens_remaining": 100 }),
            serde_json::json!({ "type": "system", "subtype": "compact_boundary" }),
        ];
        let parsed = parse_stream_events(&events);
        assert!(parsed.assistant_messages.is_empty());
        assert!(parsed.tool_calls.is_empty());
    }

    #[test]
    fn parse_stream_events_dedupes_result_text_against_assistant_snapshot() {
        let events: Vec<serde_json::Value> = vec![
            serde_json::json!({
                "type": "assistant",
                "message": { "content": [ { "type": "text", "text": "Same text." } ] }
            }),
            serde_json::json!({ "type": "result", "result": "Same text." }),
        ];
        let parsed = parse_stream_events(&events);
        assert_eq!(parsed.assistant_messages.len(), 1);
    }

    #[test]
    fn test_files_modified_deduped() {
        let input = r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Edit","input":{"file_path":"src/lib.rs"}}]}}
{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Write","input":{"file_path":"src/lib.rs"}}]}}"#;
        let transcript = parse_jsonl_str(input).expect("should parse");
        assert_eq!(transcript.files_modified.len(), 1, "duplicate file_path should be deduped");
        assert_eq!(transcript.files_modified[0], "src/lib.rs");
    }
}
