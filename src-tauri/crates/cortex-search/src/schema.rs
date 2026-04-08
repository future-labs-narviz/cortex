//! Tantivy schema definition for the search index.

use tantivy::schema::*;

/// Build the Tantivy schema used for indexing vault notes.
///
/// Fields:
/// - `path`: The relative file path (stored, not tokenized — used for exact lookup).
/// - `title`: The note title (full-text searchable and stored).
/// - `content`: The full note body (full-text searchable and stored).
/// - `tags`: Space-separated tags (full-text searchable and stored).
pub fn build_schema() -> Schema {
    let mut builder = Schema::builder();
    builder.add_text_field("path", STRING | STORED);
    builder.add_text_field("title", TEXT | STORED);
    builder.add_text_field("content", TEXT | STORED);
    builder.add_text_field("tags", TEXT | STORED);
    builder.build()
}
