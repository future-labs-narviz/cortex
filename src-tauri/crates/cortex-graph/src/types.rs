//! Shared types for the cortex-graph crate.

use serde::{Deserialize, Serialize};

/// A `[[wikilink]]` or `[[target|alias]]` parsed from a note.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct WikiLink {
    /// The note name referenced.
    pub target: String,
    /// Display text if `[[target|alias]]`.
    pub alias: Option<String>,
    /// Line number where found (1-based).
    pub line: u32,
}

/// A `#tag` parsed from a note.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct Tag {
    /// Tag name without the leading `#`.
    pub name: String,
    /// Line number where found (1-based).
    pub line: u32,
}

/// A backlink: another note that links to the current note.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct Backlink {
    /// Relative path of the note containing the link.
    pub source_path: String,
    /// Title of that note.
    pub source_title: String,
    /// The line of text containing the link (for context preview).
    pub context: String,
    /// Line number in the source note.
    pub line: u32,
}

/// A node in the knowledge graph.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct GraphNode {
    /// Note path (unique identifier).
    pub id: String,
    /// Note title (display label).
    pub label: String,
    /// Number of connections (forward + backward links).
    pub weight: u32,
}

/// An edge in the knowledge graph.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct GraphEdge {
    /// Source note path.
    pub source: String,
    /// Target note path.
    pub target: String,
}

/// Full graph data for visualization.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

/// Tag information with occurrence count.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct TagInfo {
    /// Tag name without the leading `#`.
    pub name: String,
    /// How many notes have this tag.
    pub count: u32,
}
