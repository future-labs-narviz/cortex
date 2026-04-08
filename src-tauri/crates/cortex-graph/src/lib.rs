//! Cortex Graph - Link indexing, backlinks, and graph operations.

pub mod index;
pub mod link_parser;
pub mod types;

/// Initialize the cortex-graph crate.
pub fn init() {
    log::info!("cortex-graph initialized");
}
