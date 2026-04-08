//! Cortex Search - Full-text search engine powered by Tantivy.

pub mod indexer;
pub mod query;
pub mod schema;
pub mod types;

/// Initialize the cortex-search crate.
pub fn init() {
    log::info!("cortex-search initialized");
}
