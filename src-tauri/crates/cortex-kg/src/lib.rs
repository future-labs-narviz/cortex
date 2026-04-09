pub mod graph;
pub mod types;

pub use graph::TypedKnowledgeGraph;
pub use types::*;

pub fn init() {
    log::info!("cortex-kg initialized");
}
