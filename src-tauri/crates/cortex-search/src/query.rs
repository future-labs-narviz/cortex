//! Query execution — full-text search over the index.

use crate::indexer::SearchIndex;
use crate::types::SearchResult;
use anyhow::{Context, Result};
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::Value;
use tantivy::snippet::SnippetGenerator;
use tantivy::TantivyDocument;

impl SearchIndex {
    /// Execute a full-text search and return ranked results.
    ///
    /// Searches across `title`, `content`, and `tags` fields.
    /// Returns at most `limit` results sorted by relevance score.
    pub fn search(&self, query_str: &str, limit: usize) -> Result<Vec<SearchResult>> {
        if query_str.trim().is_empty() {
            return Ok(Vec::new());
        }

        let title_field = self.schema().get_field("title").unwrap();
        let content_field = self.schema().get_field("content").unwrap();
        let tags_field = self.schema().get_field("tags").unwrap();
        let path_field = self.schema().get_field("path").unwrap();

        let query_parser =
            QueryParser::for_index(self.index(), vec![title_field, content_field, tags_field]);

        // Use lenient parsing so typos/special chars don't cause errors.
        let query = query_parser
            .parse_query_lenient(query_str)
            .0;

        let searcher = self.reader().searcher();
        let top_docs = searcher
            .search(&query, &TopDocs::with_limit(limit))
            .with_context(|| "Search query execution failed")?;

        // Build a snippet generator for the content field.
        let snippet_generator = SnippetGenerator::create(&searcher, &query, content_field)
            .with_context(|| "Failed to create snippet generator")?;

        let mut results = Vec::with_capacity(top_docs.len());

        for (score, doc_address) in top_docs {
            let doc: TantivyDocument = searcher
                .doc(doc_address)
                .with_context(|| "Failed to retrieve document")?;

            let path = doc
                .get_first(path_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let title = doc
                .get_first(title_field)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            // Generate a snippet from the content field.
            let snippet = snippet_generator.snippet_from_doc(&doc);
            let snippet_text = snippet.to_html();
            // If snippet is empty, fall back to first ~150 chars of content.
            let snippet_text = if snippet_text.trim().is_empty() {
                let content = doc
                    .get_first(content_field)
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let truncated: String = content.chars().take(150).collect();
                if content.len() > 150 {
                    format!("{}...", truncated)
                } else {
                    truncated
                }
            } else {
                snippet_text
            };

            results.push(SearchResult {
                path,
                title,
                snippet: snippet_text,
                score: score as f64,
            });
        }

        Ok(results)
    }
}
