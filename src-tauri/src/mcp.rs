//! MCP HTTP Server - JSON-RPC protocol implementation for Claude Code integration.
//!
//! Runs an axum-based HTTP server on port 3847 that implements the Model Context Protocol.
//! Uses `AppState` for access to the vault, search index, and link index.

use crate::state::AppState;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use cortex_core::vault::Vault;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::Emitter;

/// JSON-RPC request envelope.
#[derive(Debug, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub method: String,
    pub id: Option<Value>,
    pub params: Option<Value>,
}

/// JSON-RPC response envelope.
#[derive(Debug, Serialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

/// JSON-RPC error object.
#[derive(Debug, Serialize)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

impl JsonRpcResponse {
    fn success(id: Value, result: Value) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            result: Some(result),
            error: None,
        }
    }

    fn error(id: Value, code: i64, message: String) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            result: None,
            error: Some(JsonRpcError {
                code,
                message,
                data: None,
            }),
        }
    }
}

/// Tool definitions for the MCP protocol.
fn get_tools() -> Value {
    json!({
        "tools": [
            {
                "name": "cortex/search",
                "description": "Search the Cortex knowledge graph",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "cortex/capture",
                "description": "Capture a development insight to Cortex",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "content": { "type": "string" },
                        "tags": {
                            "type": "array",
                            "items": { "type": "string" }
                        }
                    },
                    "required": ["content"]
                }
            },
            {
                "name": "cortex/get-context",
                "description": "Get relevant context for a topic from the knowledge graph",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "topic": { "type": "string" }
                    },
                    "required": ["topic"]
                }
            },
            {
                "name": "cortex/list-related",
                "description": "Find notes related to a file or topic",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "cortex/list-tags",
                "description": "List all tags in the knowledge graph with note counts",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "cortex/get-note",
                "description": "Read the full content of a specific note",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                }
            },
            {
                "name": "cortex/create-note",
                "description": "Create a new note in the Cortex vault",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "title": { "type": "string" },
                        "content": { "type": "string" },
                        "tags": {
                            "type": "array",
                            "items": { "type": "string" }
                        },
                        "folder": { "type": "string" }
                    },
                    "required": ["title", "content"]
                }
            }
        ]
    })
}

/// Handle the `initialize` method.
fn handle_initialize() -> Value {
    json!({
        "protocolVersion": "2024-11-05",
        "capabilities": {
            "tools": {},
            "resources": {}
        },
        "serverInfo": {
            "name": "cortex-mcp",
            "version": "0.1.0"
        }
    })
}

/// Handle the `tools/list` method.
fn handle_tools_list() -> Value {
    get_tools()
}

/// Handle the `resources/list` method.
fn handle_resources_list() -> Value {
    json!({
        "resources": [
            {
                "uri": "cortex://vault/notes",
                "name": "All Notes",
                "description": "List of all notes in the vault"
            },
            {
                "uri": "cortex://vault/tags",
                "name": "All Tags",
                "description": "All tags with note counts"
            },
            {
                "uri": "cortex://vault/recent",
                "name": "Recent Notes",
                "description": "Recently modified notes"
            }
        ]
    })
}

/// Handle the `resources/read` method.
fn handle_resources_read(state: &AppState, params: Option<Value>) -> Result<Value, String> {
    let params = params.ok_or_else(|| "Missing params".to_string())?;
    let uri = params
        .get("uri")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing uri parameter".to_string())?;

    let vault_guard = state
        .vault
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    let vault = vault_guard
        .as_ref()
        .ok_or_else(|| "No vault is currently open".to_string())?;

    match uri {
        "cortex://vault/notes" => {
            let files = vault.list_files().map_err(|e| format!("{}", e))?;
            let notes: Vec<Value> = files
                .iter()
                .filter(|f| !f.is_dir)
                .map(|f| {
                    json!({
                        "path": f.path,
                        "name": f.name,
                        "modified": f.modified
                    })
                })
                .collect();
            Ok(json!({
                "contents": [{
                    "uri": uri,
                    "mimeType": "application/json",
                    "text": serde_json::to_string_pretty(&notes).unwrap_or_default()
                }]
            }))
        }
        "cortex://vault/tags" => {
            // Try link index first, fall back to scanning vault.
            let tags = get_tags_from_index_or_vault(state, vault);
            Ok(json!({
                "contents": [{
                    "uri": uri,
                    "mimeType": "application/json",
                    "text": serde_json::to_string_pretty(&tags).unwrap_or_default()
                }]
            }))
        }
        "cortex://vault/recent" => {
            let mut files = vault.list_files().map_err(|e| format!("{}", e))?;
            files.retain(|f| !f.is_dir);
            files.sort_by(|a, b| {
                b.modified
                    .partial_cmp(&a.modified)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
            files.truncate(10);
            let recent: Vec<Value> = files
                .iter()
                .map(|f| {
                    json!({
                        "path": f.path,
                        "name": f.name,
                        "modified": f.modified
                    })
                })
                .collect();
            Ok(json!({
                "contents": [{
                    "uri": uri,
                    "mimeType": "application/json",
                    "text": serde_json::to_string_pretty(&recent).unwrap_or_default()
                }]
            }))
        }
        _ => Err(format!("Unknown resource URI: {}", uri)),
    }
}

/// Get tags from the link index if available, otherwise scan vault files.
fn get_tags_from_index_or_vault(state: &AppState, vault: &Vault) -> Vec<Value> {
    // Try link index first.
    if let Ok(link_guard) = state.link_index.read() {
        if let Some(ref link_idx) = *link_guard {
            return link_idx
                .get_all_tags()
                .into_iter()
                .map(|t| json!({"name": t.name, "count": t.count}))
                .collect();
        }
    }

    // Fallback: scan vault notes for frontmatter tags.
    let mut tag_map: std::collections::HashMap<String, u32> = std::collections::HashMap::new();
    if let Ok(files) = vault.list_files() {
        for file in files.iter().filter(|f| !f.is_dir) {
            if let Ok(note) = vault.read_note(&file.path) {
                if let Some(ref fm) = note.frontmatter {
                    for tag in &fm.tags {
                        *tag_map.entry(tag.clone()).or_insert(0) += 1;
                    }
                }
            }
        }
    }
    let mut tags: Vec<(String, u32)> = tag_map.into_iter().collect();
    tags.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    tags.into_iter()
        .map(|(name, count)| json!({"name": name, "count": count}))
        .collect()
}

/// Simple text search through vault files. Returns matching notes with context snippets.
fn grep_vault(vault: &Vault, query: &str, max_results: usize) -> Vec<(String, String, String)> {
    // Returns (path, title, snippet)
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    if let Ok(files) = vault.list_files() {
        for file in files.iter().filter(|f| !f.is_dir) {
            if results.len() >= max_results {
                break;
            }
            if let Ok(note) = vault.read_note(&file.path) {
                let content_lower = note.content.to_lowercase();
                if content_lower.contains(&query_lower) {
                    let snippet = extract_snippet(&note.content, &query_lower);
                    let title = note
                        .frontmatter
                        .as_ref()
                        .and_then(|fm| fm.title.clone())
                        .unwrap_or_else(|| note.title.clone());
                    results.push((file.path.clone(), title, snippet));
                }
            }
        }
    }

    results
}

/// Extract a snippet of text around the first occurrence of `query` in `content`.
fn extract_snippet(content: &str, query_lower: &str) -> String {
    let content_lower = content.to_lowercase();
    if let Some(pos) = content_lower.find(query_lower) {
        let start = pos.saturating_sub(100);
        let end = std::cmp::min(pos + query_lower.len() + 100, content.len());
        let mut snippet = String::new();
        if start > 0 {
            snippet.push_str("...");
        }
        snippet.push_str(&content[start..end]);
        if end < content.len() {
            snippet.push_str("...");
        }
        snippet.replace('\n', " ").replace('\r', "")
    } else {
        let end = std::cmp::min(200, content.len());
        let mut s = content[..end].replace('\n', " ").replace('\r', "");
        if content.len() > 200 {
            s.push_str("...");
        }
        s
    }
}

/// Handle the `tools/call` method.
fn handle_tools_call(state: &AppState, params: Option<Value>) -> Result<Value, String> {
    let params = params.ok_or_else(|| "Missing params".to_string())?;
    let tool_name = params
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing tool name".to_string())?;
    let arguments = params.get("arguments").cloned().unwrap_or(json!({}));

    match tool_name {
        "cortex/search" => handle_search(state, &arguments),
        "cortex/capture" => handle_capture(state, &arguments),
        "cortex/get-context" => handle_get_context(state, &arguments),
        "cortex/list-related" => handle_list_related(state, &arguments),
        "cortex/list-tags" => handle_list_tags(state),
        "cortex/get-note" => handle_get_note(state, &arguments),
        "cortex/create-note" => handle_create_note(state, &arguments),
        _ => Err(format!("Unknown tool: {}", tool_name)),
    }
}

/// cortex/search - Search vault notes by query.
///
/// Uses the Tantivy search index when available, falling back to simple text grep.
fn handle_search(state: &AppState, arguments: &Value) -> Result<Value, String> {
    let query = arguments
        .get("query")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing query parameter".to_string())?;

    // Try the search index first.
    if let Ok(search_guard) = state.search_index.lock() {
        if let Some(ref search_idx) = *search_guard {
            match search_idx.search(query, 10) {
                Ok(results) => {
                    if results.is_empty() {
                        return Ok(json!({
                            "content": [{
                                "type": "text",
                                "text": format!("No results found for '{}'.", query)
                            }]
                        }));
                    }

                    let mut text =
                        format!("Found {} results for '{}':\n\n", results.len(), query);
                    for (i, result) in results.iter().enumerate() {
                        text.push_str(&format!(
                            "{}. **{}** ({}) (score: {:.2})\n   {}\n\n",
                            i + 1,
                            result.title,
                            result.path,
                            result.score,
                            result.snippet
                        ));
                    }

                    return Ok(json!({
                        "content": [{
                            "type": "text",
                            "text": text.trim_end()
                        }]
                    }));
                }
                Err(e) => {
                    log::warn!("Search index query failed, falling back to grep: {}", e);
                }
            }
        }
    }

    // Fallback: grep through vault files.
    let vault_guard = state
        .vault
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    let vault = match vault_guard.as_ref() {
        Some(v) => v,
        None => {
            return Ok(json!({
                "content": [{
                    "type": "text",
                    "text": "No vault is currently open. Open a vault first to search."
                }]
            }));
        }
    };

    let results = grep_vault(vault, query, 10);

    if results.is_empty() {
        return Ok(json!({
            "content": [{
                "type": "text",
                "text": format!("No results found for '{}'.", query)
            }]
        }));
    }

    let mut text = format!("Found {} results for '{}':\n\n", results.len(), query);
    for (i, (path, title, snippet)) in results.iter().enumerate() {
        text.push_str(&format!(
            "{}. **{}** ({})\n   {}\n\n",
            i + 1,
            title,
            path,
            snippet
        ));
    }

    Ok(json!({
        "content": [{
            "type": "text",
            "text": text.trim_end()
        }]
    }))
}

/// cortex/capture - Capture an insight as both JSON and markdown.
fn handle_capture(state: &AppState, arguments: &Value) -> Result<Value, String> {
    let content = arguments
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing content parameter".to_string())?
        .to_string();
    let tags: Vec<String> = arguments
        .get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let vault_guard = state
        .vault
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    let vault = match vault_guard.as_ref() {
        Some(v) => v,
        None => {
            return Ok(json!({
                "content": [{
                    "type": "text",
                    "text": "No vault is currently open. Cannot capture."
                }],
                "isError": true
            }));
        }
    };

    // Write the legacy JSON capture.
    let captured_note = vault
        .capture(content.clone(), tags.clone())
        .map_err(|e| format!("Failed to capture note: {}", e))?;

    // Also write a proper markdown note.
    let now = Utc::now();
    let md_filename = format!("{}.md", now.format("%Y-%m-%d_%H%M%S"));
    let tags_str = if tags.is_empty() {
        "[]".to_string()
    } else {
        format!(
            "[{}]",
            tags.iter()
                .map(|t| format!("\"{}\"", t))
                .collect::<Vec<_>>()
                .join(", ")
        )
    };
    let md_content = format!(
        "---\ntype: captured-context\nsource: claude-code\ntags: {}\ncreated: {}\n---\n\n# Captured Insight\n\n{}\n",
        tags_str,
        now.format("%Y-%m-%dT%H:%M:%SZ"),
        content
    );

    let md_path = format!("captured/{}", md_filename);
    if let Err(e) = vault.write_note(&md_path, &md_content) {
        log::warn!("Failed to write markdown capture: {}", e);
    }

    Ok(json!({
        "content": [{
            "type": "text",
            "text": format!(
                "Captured note '{}' with {} tags. Saved as both JSON and Markdown.",
                captured_note.id,
                captured_note.tags.len()
            )
        }]
    }))
}

/// cortex/get-context - Get relevant context for a topic.
///
/// Uses the search index if available, falling back to grep. Returns top 3 notes
/// with content truncated to 500 characters each.
fn handle_get_context(state: &AppState, arguments: &Value) -> Result<Value, String> {
    let topic = arguments
        .get("topic")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing topic parameter".to_string())?;

    // Try search index first for ranked results.
    let search_results = if let Ok(search_guard) = state.search_index.lock() {
        if let Some(ref search_idx) = *search_guard {
            search_idx.search(topic, 3).ok()
        } else {
            None
        }
    } else {
        None
    };

    if let Some(results) = search_results {
        if !results.is_empty() {
            let vault_guard = state
                .vault
                .lock()
                .map_err(|e| format!("Lock error: {}", e))?;
            let vault = vault_guard
                .as_ref()
                .ok_or_else(|| "No vault is currently open".to_string())?;

            let mut text = format!("Context for '{}':\n\n", topic);
            for (i, result) in results.iter().enumerate() {
                let note_content = vault
                    .read_note(&result.path)
                    .map(|n| {
                        if n.content.len() > 500 {
                            format!("{}...", &n.content[..500])
                        } else {
                            n.content
                        }
                    })
                    .unwrap_or_else(|_| "(could not read note)".to_string());

                text.push_str(&format!(
                    "---\n### {}. {} ({}) (score: {:.2})\n\n{}\n\n",
                    i + 1,
                    result.title,
                    result.path,
                    result.score,
                    note_content
                ));
            }

            return Ok(json!({
                "content": [{
                    "type": "text",
                    "text": text.trim_end()
                }]
            }));
        }
    }

    // Fallback: grep through vault files.
    let vault_guard = state
        .vault
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    let vault = match vault_guard.as_ref() {
        Some(v) => v,
        None => {
            return Ok(json!({
                "content": [{
                    "type": "text",
                    "text": "No vault is currently open. Cannot retrieve context."
                }]
            }));
        }
    };

    let results = grep_vault(vault, topic, 3);

    if results.is_empty() {
        return Ok(json!({
            "content": [{
                "type": "text",
                "text": format!("No context found for topic '{}'.", topic)
            }]
        }));
    }

    let mut text = format!("Context for '{}':\n\n", topic);
    for (i, (path, title, _snippet)) in results.iter().enumerate() {
        let note_content = vault
            .read_note(path)
            .map(|n| {
                if n.content.len() > 500 {
                    format!("{}...", &n.content[..500])
                } else {
                    n.content
                }
            })
            .unwrap_or_else(|_| "(could not read note)".to_string());

        text.push_str(&format!(
            "---\n### {}. {} ({})\n\n{}\n\n",
            i + 1,
            title,
            path,
            note_content
        ));
    }

    Ok(json!({
        "content": [{
            "type": "text",
            "text": text.trim_end()
        }]
    }))
}

/// cortex/list-related - Find related notes via backlinks or search fallback.
///
/// Uses the link index for backlinks when available, falling back to search.
fn handle_list_related(state: &AppState, arguments: &Value) -> Result<Value, String> {
    let query = arguments
        .get("query")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing query parameter".to_string())?;

    // Try link index for backlinks first.
    if let Ok(link_guard) = state.link_index.read() {
        if let Some(ref link_idx) = *link_guard {
            let backlinks = link_idx.get_backlinks(query);
            if !backlinks.is_empty() {
                let mut text = format!(
                    "Found {} backlinks for '{}':\n\n",
                    backlinks.len(),
                    query
                );
                for (i, bl) in backlinks.iter().enumerate() {
                    text.push_str(&format!(
                        "{}. **{}** ({}) line {}\n   {}\n\n",
                        i + 1,
                        bl.source_title,
                        bl.source_path,
                        bl.line,
                        bl.context
                    ));
                }

                return Ok(json!({
                    "content": [{
                        "type": "text",
                        "text": text.trim_end()
                    }]
                }));
            }
        }
    }

    // Try search index next.
    if let Ok(search_guard) = state.search_index.lock() {
        if let Some(ref search_idx) = *search_guard {
            if let Ok(results) = search_idx.search(query, 10) {
                if !results.is_empty() {
                    let mut text =
                        format!("Notes related to '{}' (by search):\n\n", query);
                    for (i, result) in results.iter().enumerate() {
                        text.push_str(&format!(
                            "{}. **{}** ({}) (score: {:.2})\n   {}\n\n",
                            i + 1,
                            result.title,
                            result.path,
                            result.score,
                            result.snippet
                        ));
                    }

                    return Ok(json!({
                        "content": [{
                            "type": "text",
                            "text": text.trim_end()
                        }]
                    }));
                }
            }
        }
    }

    // Final fallback: grep.
    let vault_guard = state
        .vault
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    let vault = match vault_guard.as_ref() {
        Some(v) => v,
        None => {
            return Ok(json!({
                "content": [{
                    "type": "text",
                    "text": "No vault is currently open. Cannot find related notes."
                }]
            }));
        }
    };

    let results = grep_vault(vault, query, 10);

    if results.is_empty() {
        return Ok(json!({
            "content": [{
                "type": "text",
                "text": format!("No related notes found for '{}'.", query)
            }]
        }));
    }

    let mut text = format!("Notes related to '{}':\n\n", query);
    for (i, (path, title, snippet)) in results.iter().enumerate() {
        text.push_str(&format!(
            "{}. **{}** ({})\n   {}\n\n",
            i + 1,
            title,
            path,
            snippet
        ));
    }

    Ok(json!({
        "content": [{
            "type": "text",
            "text": text.trim_end()
        }]
    }))
}

/// cortex/list-tags - List all tags with note counts.
///
/// Uses the link index when available, otherwise scans vault frontmatter.
fn handle_list_tags(state: &AppState) -> Result<Value, String> {
    // Try link index first.
    if let Ok(link_guard) = state.link_index.read() {
        if let Some(ref link_idx) = *link_guard {
            let tags = link_idx.get_all_tags();
            if tags.is_empty() {
                return Ok(json!({
                    "content": [{
                        "type": "text",
                        "text": "No tags found in the vault."
                    }]
                }));
            }

            let mut text = format!("Tags ({} total):\n\n", tags.len());
            for t in &tags {
                let plural = if t.count == 1 { "note" } else { "notes" };
                text.push_str(&format!("- **#{}** ({} {})\n", t.name, t.count, plural));
            }

            return Ok(json!({
                "content": [{
                    "type": "text",
                    "text": text.trim_end()
                }]
            }));
        }
    }

    // Fallback: scan vault.
    let vault_guard = state
        .vault
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    let vault = match vault_guard.as_ref() {
        Some(v) => v,
        None => {
            return Ok(json!({
                "content": [{
                    "type": "text",
                    "text": "No vault is currently open."
                }]
            }));
        }
    };

    let tags = get_tags_from_index_or_vault(state, vault);

    if tags.is_empty() {
        return Ok(json!({
            "content": [{
                "type": "text",
                "text": "No tags found in the vault."
            }]
        }));
    }

    let mut text = format!("Tags ({} total):\n\n", tags.len());
    for t in &tags {
        let name = t.get("name").and_then(|v| v.as_str()).unwrap_or("?");
        let count = t.get("count").and_then(|v| v.as_u64()).unwrap_or(0);
        let plural = if count == 1 { "note" } else { "notes" };
        text.push_str(&format!("- **#{}** ({} {})\n", name, count, plural));
    }

    Ok(json!({
        "content": [{
            "type": "text",
            "text": text.trim_end()
        }]
    }))
}

/// cortex/get-note - Read a specific note's content.
fn handle_get_note(state: &AppState, arguments: &Value) -> Result<Value, String> {
    let path = arguments
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing path parameter".to_string())?;

    let vault_guard = state
        .vault
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    let vault = match vault_guard.as_ref() {
        Some(v) => v,
        None => {
            return Ok(json!({
                "content": [{
                    "type": "text",
                    "text": "No vault is currently open."
                }],
                "isError": true
            }));
        }
    };

    match vault.read_note(path) {
        Ok(note) => {
            let mut text = String::new();
            if let Some(ref fm) = note.frontmatter {
                if let Some(ref title) = fm.title {
                    text.push_str(&format!("**Title:** {}\n", title));
                }
                if !fm.tags.is_empty() {
                    text.push_str(&format!("**Tags:** {}\n", fm.tags.join(", ")));
                }
                text.push_str("---\n\n");
            }
            text.push_str(&note.content);

            Ok(json!({
                "content": [{
                    "type": "text",
                    "text": text
                }]
            }))
        }
        Err(e) => Ok(json!({
            "content": [{
                "type": "text",
                "text": format!("Failed to read note '{}': {}", path, e)
            }],
            "isError": true
        })),
    }
}

/// cortex/create-note - Create a new note in the vault.
fn handle_create_note(state: &AppState, arguments: &Value) -> Result<Value, String> {
    let title = arguments
        .get("title")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing title parameter".to_string())?;
    let content = arguments
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing content parameter".to_string())?;
    let tags: Vec<String> = arguments
        .get("tags")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    let folder = arguments.get("folder").and_then(|v| v.as_str());

    let vault_guard = state
        .vault
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    let vault = match vault_guard.as_ref() {
        Some(v) => v,
        None => {
            return Ok(json!({
                "content": [{
                    "type": "text",
                    "text": "No vault is currently open."
                }],
                "isError": true
            }));
        }
    };

    // Create the note file via vault.
    let relative_path = vault
        .create_note(title, folder)
        .map_err(|e| format!("Failed to create note: {}", e))?;

    // Overwrite with richer content including user-provided body and tags.
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let tags_yaml = if tags.is_empty() {
        "[]".to_string()
    } else {
        format!(
            "\n{}",
            tags.iter()
                .map(|t| format!("  - {}", t))
                .collect::<Vec<_>>()
                .join("\n")
        )
    };
    let note_content = format!(
        "---\ntitle: {}\ncreated: {}\nmodified: {}\ntags: {}\n---\n\n# {}\n\n{}\n",
        title, now, now, tags_yaml, title, content
    );

    vault
        .write_note(&relative_path, &note_content)
        .map_err(|e| format!("Failed to write note content: {}", e))?;

    Ok(json!({
        "content": [{
            "type": "text",
            "text": format!("Created note '{}' at '{}'.", title, relative_path)
        }]
    }))
}

/// Main JSON-RPC handler for POST /mcp.
async fn handle_mcp(
    State(state): State<Arc<AppState>>,
    Json(request): Json<JsonRpcRequest>,
) -> (StatusCode, Json<JsonRpcResponse>) {
    let id = request.id.clone().unwrap_or(Value::Null);

    let response = match request.method.as_str() {
        "initialize" => JsonRpcResponse::success(id, handle_initialize()),
        "tools/list" => JsonRpcResponse::success(id, handle_tools_list()),
        "resources/list" => JsonRpcResponse::success(id, handle_resources_list()),
        "resources/read" => match handle_resources_read(&state, request.params) {
            Ok(result) => JsonRpcResponse::success(id, result),
            Err(e) => JsonRpcResponse::error(id, -32602, e),
        },
        "tools/call" => match handle_tools_call(&state, request.params) {
            Ok(result) => JsonRpcResponse::success(id, result),
            Err(e) => JsonRpcResponse::error(id, -32602, e),
        },
        _ => JsonRpcResponse::error(id, -32601, format!("Method not found: {}", request.method)),
    };

    (StatusCode::OK, Json(response))
}

// ---------------------------------------------------------------------------
// Context Capture REST API
// ---------------------------------------------------------------------------
//
// These REST endpoints run alongside the MCP JSON-RPC route on port 3847.
// They are called by Claude Code hooks to automatically capture development
// context into the Cortex vault.
//
// Claude Code hook configuration (~/.claude/settings.json):
// {
//   "hooks": {
//     "SessionStart": [{
//       "command": "curl -s -X POST http://localhost:3847/api/capture/session-start -H 'Content-Type: application/json' -d '{\"session_id\": \"$CLAUDE_SESSION_ID\", \"cwd\": \"$PWD\", \"project\": \"$(basename $PWD)\", \"started_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}'"
//     }],
//     "Stop": [{
//       "command": "curl -s -X POST http://localhost:3847/api/capture/session-end -H 'Content-Type: application/json' -d '{\"session_id\": \"$CLAUDE_SESSION_ID\", \"ended_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}'"
//     }]
//   }
// }

/// Request body for POST /api/capture/session-start.
#[derive(Debug, Deserialize)]
struct SessionStartRequest {
    session_id: String,
    cwd: Option<String>,
    project: Option<String>,
    started_at: Option<String>,
    goal: Option<String>,
}

/// Request body for POST /api/capture/session-end.
#[derive(Debug, Deserialize)]
struct SessionEndRequest {
    session_id: String,
    ended_at: Option<String>,
    summary: Option<String>,
    files_modified: Option<Vec<String>>,
    tools_used: Option<Vec<String>>,
    prompts_count: Option<u32>,
    key_decisions: Option<Vec<String>>,
    what_worked: Option<String>,
    what_failed: Option<String>,
}

/// Request body for POST /api/capture/insight.
#[derive(Debug, Deserialize)]
struct CaptureInsightRequest {
    session_id: Option<String>,
    content: String,
    tags: Option<Vec<String>>,
    source: Option<String>,
}

/// Request body for POST /api/capture/tool-use.
#[derive(Debug, Deserialize)]
struct ToolUseRequest {
    session_id: String,
    tool: String,
    file: Option<String>,
    description: Option<String>,
}

/// A single tool-use entry within a session tracking file.
#[derive(Debug, Serialize, Deserialize, Clone)]
struct ToolUseEntry {
    tool: String,
    file: Option<String>,
    description: Option<String>,
    at: String,
}

/// The session tracking file stored at vault/.cortex/sessions/{id}.json.
#[derive(Debug, Serialize, Deserialize)]
struct SessionFile {
    session_id: String,
    project: Option<String>,
    cwd: Option<String>,
    started_at: Option<String>,
    ended_at: Option<String>,
    goal: Option<String>,
    summary: Option<String>,
    tool_uses: Vec<ToolUseEntry>,
    insights: Vec<String>,
    files_modified: Vec<String>,
    tools_used: Vec<String>,
    prompts_count: Option<u32>,
    key_decisions: Vec<String>,
    what_worked: Option<String>,
    what_failed: Option<String>,
}

/// Return the vault root directory (same logic as lib.rs).
fn capture_vault_root() -> std::path::PathBuf {
    dirs::desktop_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Cortex")
        .join("vault")
}

/// Ensure directories exist for the session tracking files.
fn ensure_capture_dirs(vault_root: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(vault_root.join(".cortex").join("sessions"))?;
    std::fs::create_dir_all(vault_root.join("sessions"))?;
    std::fs::create_dir_all(vault_root.join("captured"))?;
    Ok(())
}

/// Read a session file from disk, returning None if it does not exist.
fn read_session_file(vault_root: &std::path::Path, session_id: &str) -> Option<SessionFile> {
    let path = vault_root
        .join(".cortex")
        .join("sessions")
        .join(format!("{}.json", session_id));
    let data = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

/// Write a session file to disk.
fn write_session_file(
    vault_root: &std::path::Path,
    session: &SessionFile,
) -> Result<(), String> {
    let path = vault_root
        .join(".cortex")
        .join("sessions")
        .join(format!("{}.json", session.session_id));
    let data = serde_json::to_string_pretty(session)
        .map_err(|e| format!("Failed to serialize session: {}", e))?;
    std::fs::write(path, data).map_err(|e| format!("Failed to write session file: {}", e))
}

/// POST /api/capture/session-start
async fn handle_session_start(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<SessionStartRequest>,
) -> (StatusCode, Json<Value>) {
    let vault_root = capture_vault_root();
    if let Err(e) = ensure_capture_dirs(&vault_root) {
        log::error!("Failed to create capture dirs: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": format!("{}", e)})),
        );
    }

    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let session = SessionFile {
        session_id: req.session_id.clone(),
        project: req.project,
        cwd: req.cwd,
        started_at: Some(req.started_at.unwrap_or_else(|| now.clone())),
        ended_at: None,
        goal: req.goal,
        summary: None,
        tool_uses: Vec::new(),
        insights: Vec::new(),
        files_modified: Vec::new(),
        tools_used: Vec::new(),
        prompts_count: None,
        key_decisions: Vec::new(),
        what_worked: None,
        what_failed: None,
    };

    if let Err(e) = write_session_file(&vault_root, &session) {
        log::error!("Failed to write session file: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e})),
        );
    }

    log::info!("Capture: session started {}", req.session_id);
    (StatusCode::OK, Json(json!({"status": "ok"})))
}

/// POST /api/capture/session-end
async fn handle_session_end(
    State(state): State<Arc<AppState>>,
    Json(req): Json<SessionEndRequest>,
) -> (StatusCode, Json<Value>) {
    let vault_root = capture_vault_root();
    if let Err(e) = ensure_capture_dirs(&vault_root) {
        log::error!("Failed to create capture dirs: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": format!("{}", e)})),
        );
    }

    // Read existing session or create a minimal one.
    let mut session = read_session_file(&vault_root, &req.session_id).unwrap_or_else(|| {
        SessionFile {
            session_id: req.session_id.clone(),
            project: None,
            cwd: None,
            started_at: None,
            ended_at: None,
            goal: None,
            summary: None,
            tool_uses: Vec::new(),
            insights: Vec::new(),
            files_modified: Vec::new(),
            tools_used: Vec::new(),
            prompts_count: None,
            key_decisions: Vec::new(),
            what_worked: None,
            what_failed: None,
        }
    });

    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    session.ended_at = Some(req.ended_at.unwrap_or_else(|| now.clone()));
    if let Some(summary) = req.summary {
        session.summary = Some(summary);
    }
    if let Some(files) = req.files_modified {
        session.files_modified = files;
    }
    if let Some(tools) = req.tools_used {
        session.tools_used = tools;
    }
    if let Some(count) = req.prompts_count {
        session.prompts_count = Some(count);
    }
    if let Some(decisions) = req.key_decisions {
        session.key_decisions = decisions;
    }
    if let Some(worked) = req.what_worked {
        session.what_worked = Some(worked);
    }
    if let Some(failed) = req.what_failed {
        session.what_failed = Some(failed);
    }

    // Write updated session tracking file.
    if let Err(e) = write_session_file(&vault_root, &session) {
        log::error!("Failed to write session file: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e})),
        );
    }

    // Generate a markdown summary note in vault/sessions/.
    let summary_text = session
        .summary
        .as_deref()
        .unwrap_or("Development session");
    let project = session.project.as_deref().unwrap_or("unknown");
    let started = session.started_at.as_deref().unwrap_or("unknown");
    let ended = session.ended_at.as_deref().unwrap_or("unknown");

    // Compute a human-readable duration.
    let duration_str = compute_duration(session.started_at.as_deref(), session.ended_at.as_deref());

    let prompts = session.prompts_count.unwrap_or(0);
    let files_count = session.files_modified.len();

    let decisions_md = if session.key_decisions.is_empty() {
        String::from("(none)")
    } else {
        session
            .key_decisions
            .iter()
            .map(|d| format!("- {}", d))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let worked_md = session
        .what_worked
        .as_deref()
        .unwrap_or("(none)");
    let failed_md = session
        .what_failed
        .as_deref()
        .unwrap_or("(none)");

    let files_md = if session.files_modified.is_empty() {
        String::from("(none)")
    } else {
        session
            .files_modified
            .iter()
            .map(|f| format!("- {}", f))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let tools_md = if session.tools_used.is_empty() {
        String::from("(none)")
    } else {
        session.tools_used.join(", ")
    };

    let md_note = format!(
        r#"---
type: session-capture
session_id: {}
project: {}
started: {}
ended: {}
duration: {}
tags: [session, {}]
---

# Session: {}

**Duration:** {} | **Prompts:** {} | **Files:** {}

## Summary
{}

## Key Decisions
{}

## What Worked
{}

## What Failed
{}

## Files Modified
{}

## Tools Used
{}
"#,
        session.session_id,
        project,
        started,
        ended,
        duration_str,
        project,
        summary_text,
        duration_str,
        prompts,
        files_count,
        summary_text,
        decisions_md,
        worked_md,
        failed_md,
        files_md,
        tools_md,
    );

    // Write the markdown note.
    let date_prefix = if let Some(ref started_at) = session.started_at {
        // Extract YYYY-MM-DD from ISO string.
        started_at.get(..10).unwrap_or("unknown").to_string()
    } else {
        Utc::now().format("%Y-%m-%d").to_string()
    };
    let md_filename = format!("{}_session-summary.md", date_prefix);
    let md_path = vault_root.join("sessions").join(&md_filename);
    if let Err(e) = std::fs::write(&md_path, &md_note) {
        log::error!("Failed to write session summary markdown: {}", e);
    }

    // Emit Tauri event so frontend can update in real-time.
    if let Some(ref app_handle) = *state.app_handle.lock().unwrap_or_else(|e| e.into_inner()) {
        let _ = app_handle.emit("capture:session-end", &json!({
            "session_id": session.session_id,
            "summary": session.summary,
        }));
    }

    log::info!("Capture: session ended {}", session.session_id);
    (StatusCode::OK, Json(json!({"status": "ok"})))
}

/// POST /api/capture/insight
async fn handle_capture_insight(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CaptureInsightRequest>,
) -> (StatusCode, Json<Value>) {
    let vault_root = capture_vault_root();
    if let Err(e) = ensure_capture_dirs(&vault_root) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": format!("{}", e)})),
        );
    }

    let now = Utc::now();
    let tags = req.tags.unwrap_or_default();
    let source = req.source.unwrap_or_else(|| "claude-code".to_string());

    let tags_yaml = if tags.is_empty() {
        "[]".to_string()
    } else {
        format!(
            "[{}]",
            tags.iter()
                .map(|t| format!("\"{}\"", t))
                .collect::<Vec<_>>()
                .join(", ")
        )
    };

    let md_content = format!(
        r#"---
type: captured-insight
source: {}
tags: {}
created: {}
session_id: {}
---

# Captured Insight

{}
"#,
        source,
        tags_yaml,
        now.format("%Y-%m-%dT%H:%M:%SZ"),
        req.session_id.as_deref().unwrap_or("none"),
        req.content,
    );

    let md_filename = format!("{}.md", now.format("%Y-%m-%d_%H%M%S"));
    let md_path = vault_root.join("captured").join(&md_filename);
    if let Err(e) = std::fs::write(&md_path, &md_content) {
        log::error!("Failed to write insight markdown: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": format!("{}", e)})),
        );
    }

    // If there's a session, add to its insights list.
    if let Some(ref sid) = req.session_id {
        if let Some(mut session) = read_session_file(&vault_root, sid) {
            session.insights.push(req.content.clone());
            let _ = write_session_file(&vault_root, &session);
        }
    }

    // Emit Tauri event.
    if let Some(ref app_handle) = *state.app_handle.lock().unwrap_or_else(|e| e.into_inner()) {
        let _ = app_handle.emit("capture:insight", &json!({
            "content": req.content,
            "tags": tags,
            "source": source,
            "created_at": now.format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        }));
    }

    log::info!("Capture: insight saved to {}", md_filename);
    (
        StatusCode::OK,
        Json(json!({"status": "ok", "file": md_filename})),
    )
}

/// POST /api/capture/tool-use
async fn handle_tool_use(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<ToolUseRequest>,
) -> (StatusCode, Json<Value>) {
    let vault_root = capture_vault_root();
    if let Err(e) = ensure_capture_dirs(&vault_root) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": format!("{}", e)})),
        );
    }

    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let mut session = match read_session_file(&vault_root, &req.session_id) {
        Some(s) => s,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"status": "error", "message": "Session not found"})),
            );
        }
    };

    session.tool_uses.push(ToolUseEntry {
        tool: req.tool,
        file: req.file,
        description: req.description,
        at: now,
    });

    if let Err(e) = write_session_file(&vault_root, &session) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "message": e})),
        );
    }

    (StatusCode::OK, Json(json!({"status": "ok"})))
}

/// GET /api/capture/sessions - List all captured sessions, newest first.
async fn handle_list_sessions(
    State(_state): State<Arc<AppState>>,
) -> (StatusCode, Json<Value>) {
    let vault_root = capture_vault_root();
    let sessions_dir = vault_root.join(".cortex").join("sessions");

    if !sessions_dir.exists() {
        return (StatusCode::OK, Json(json!({"sessions": []})));
    }

    let mut sessions: Vec<Value> = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&sessions_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "json").unwrap_or(false) {
                if let Ok(data) = std::fs::read_to_string(&path) {
                    if let Ok(session) = serde_json::from_str::<SessionFile>(&data) {
                        sessions.push(json!({
                            "session_id": session.session_id,
                            "project": session.project,
                            "started_at": session.started_at,
                            "ended_at": session.ended_at,
                            "summary": session.summary,
                            "goal": session.goal,
                            "files_modified": session.files_modified,
                            "tools_used": session.tools_used,
                            "prompts_count": session.prompts_count.unwrap_or(0),
                            "key_decisions": session.key_decisions,
                            "what_worked": session.what_worked,
                            "what_failed": session.what_failed,
                        }));
                    }
                }
            }
        }
    }

    // Sort by started_at descending (newest first).
    sessions.sort_by(|a, b| {
        let a_time = a.get("started_at").and_then(|v| v.as_str()).unwrap_or("");
        let b_time = b.get("started_at").and_then(|v| v.as_str()).unwrap_or("");
        b_time.cmp(a_time)
    });

    (StatusCode::OK, Json(json!({"sessions": sessions})))
}

/// GET /api/capture/sessions/:id - Get a specific session with all details.
async fn handle_get_session(
    State(_state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> (StatusCode, Json<Value>) {
    let vault_root = capture_vault_root();

    match read_session_file(&vault_root, &id) {
        Some(session) => {
            let data = serde_json::to_value(&session).unwrap_or(json!(null));
            (StatusCode::OK, Json(data))
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({"status": "error", "message": "Session not found"})),
        ),
    }
}

/// Compute a human-readable duration string from two ISO timestamps.
fn compute_duration(started: Option<&str>, ended: Option<&str>) -> String {
    use chrono::DateTime;

    let (start, end) = match (started, ended) {
        (Some(s), Some(e)) => {
            let start = DateTime::parse_from_rfc3339(s)
                .or_else(|_| DateTime::parse_from_rfc3339(&format!("{}+00:00", s.trim_end_matches('Z'))));
            let end = DateTime::parse_from_rfc3339(e)
                .or_else(|_| DateTime::parse_from_rfc3339(&format!("{}+00:00", e.trim_end_matches('Z'))));
            match (start, end) {
                (Ok(s), Ok(e)) => (s, e),
                _ => return "unknown".to_string(),
            }
        }
        _ => return "unknown".to_string(),
    };

    let duration = end.signed_duration_since(start);
    let total_minutes = duration.num_minutes();
    if total_minutes < 60 {
        format!("{}m", total_minutes)
    } else {
        let hours = total_minutes / 60;
        let minutes = total_minutes % 60;
        if minutes == 0 {
            format!("{}h", hours)
        } else {
            format!("{}h {}m", hours, minutes)
        }
    }
}

/// Start the MCP HTTP server on port 3847.
pub async fn start_mcp_server(state: Arc<AppState>) -> anyhow::Result<()> {
    let app = Router::new()
        .route("/mcp", post(handle_mcp))
        .route("/api/capture/session-start", post(handle_session_start))
        .route("/api/capture/session-end", post(handle_session_end))
        .route("/api/capture/insight", post(handle_capture_insight))
        .route("/api/capture/tool-use", post(handle_tool_use))
        .route("/api/capture/sessions", get(handle_list_sessions))
        .route("/api/capture/sessions/{id}", get(handle_get_session))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3847").await?;
    log::info!("MCP server listening on http://127.0.0.1:3847/mcp");
    log::info!("Capture API available at http://127.0.0.1:3847/api/capture/*");

    axum::serve(listener, app).await?;

    Ok(())
}
