//! Types for search results.

use serde::{Deserialize, Serialize};

/// A single search result returned from a full-text query.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SearchResult {
    /// Relative file path within the vault.
    pub path: String,
    /// Note title (derived from filename).
    pub title: String,
    /// Matching text snippet with surrounding context.
    pub snippet: String,
    /// Relevance score from the search engine.
    pub score: f64,
}
