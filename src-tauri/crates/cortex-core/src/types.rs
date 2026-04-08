//! Shared types for the Cortex application.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A captured note or insight stored in the vault.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapturedNote {
    /// Unique identifier for the note.
    pub id: String,
    /// The content of the note.
    pub content: String,
    /// Tags associated with the note.
    pub tags: Vec<String>,
    /// When the note was captured.
    pub created_at: DateTime<Utc>,
}

/// A search result returned from the search engine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    /// The matching note.
    pub note: CapturedNote,
    /// Relevance score (0.0 - 1.0).
    pub score: f64,
}

/// Represents a file or directory inside the vault.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct VaultFile {
    /// Relative path from vault root.
    pub path: String,
    /// Filename or directory name.
    pub name: String,
    /// Whether this entry is a directory.
    pub is_dir: bool,
    /// Last modified time as unix timestamp.
    pub modified: f64,
    /// Children entries (for directories).
    pub children: Option<Vec<VaultFile>>,
}

/// Parsed YAML frontmatter from a note.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct Frontmatter {
    pub title: Option<String>,
    pub tags: Vec<String>,
    pub aliases: Vec<String>,
    pub created: Option<String>,
    pub modified: Option<String>,
    /// Extra frontmatter fields serialized as JSON strings.
    pub extra: HashMap<String, String>,
}

/// A note read from the vault, with parsed frontmatter.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct Note {
    /// Relative path from vault root.
    pub path: String,
    /// Title derived from filename (without .md extension).
    pub title: String,
    /// Full raw file content.
    pub content: String,
    /// Parsed frontmatter, if present.
    pub frontmatter: Option<Frontmatter>,
}

/// Data returned to the frontend when reading a note.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct NoteData {
    pub content: String,
    pub frontmatter: Option<Frontmatter>,
}
