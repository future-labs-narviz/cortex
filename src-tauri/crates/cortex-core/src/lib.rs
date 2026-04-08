//! Cortex Core - Vault management, file operations, and shared types.

pub mod note;
pub mod types;
pub mod vault;
pub mod watcher;

/// Initialize the cortex-core crate.
pub fn init() {
    log::info!("cortex-core initialized");
}
