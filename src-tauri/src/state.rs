//! Centralized application state for Tauri.

use cortex_core::vault::Vault;
use cortex_core::watcher::{FileWatcher, VaultEvent};
use cortex_graph::index::LinkIndex;
use cortex_kg::TypedKnowledgeGraph;
use cortex_search::indexer::SearchIndex;
use cortex_voice::VoicePipeline;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, RwLock};
use tauri::AppHandle;
use tokio::sync::broadcast;

/// Shared application state managed by Tauri.
pub struct AppState {
    /// The currently open vault (None if no vault is open).
    pub vault: Mutex<Option<Vault>>,
    /// File watcher for the current vault (None if no vault is open).
    pub watcher: Mutex<Option<FileWatcher>>,
    /// Broadcast sender for vault file events.
    pub vault_event_tx: broadcast::Sender<VaultEvent>,
    /// Full-text search index for the current vault.
    pub search_index: Mutex<Option<SearchIndex>>,
    /// Link index for backlinks, graph, and tags.
    pub link_index: RwLock<Option<LinkIndex>>,
    /// Voice pipeline for recording and transcription.
    pub voice_pipeline: Mutex<Option<VoicePipeline>>,
    /// Whether the MCP server is currently running.
    pub mcp_running: AtomicBool,
    /// The Tauri app handle, set during setup so the MCP server can emit events.
    pub app_handle: Mutex<Option<AppHandle>>,
    /// Claude-powered typed knowledge graph.
    pub knowledge_graph: RwLock<Option<TypedKnowledgeGraph>>,
}

impl AppState {
    /// Create a new AppState with a broadcast channel for vault events.
    pub fn new() -> Self {
        let (tx, _rx) = broadcast::channel(256);
        Self {
            vault: Mutex::new(None),
            watcher: Mutex::new(None),
            vault_event_tx: tx,
            search_index: Mutex::new(None),
            link_index: RwLock::new(None),
            voice_pipeline: Mutex::new(None),
            mcp_running: AtomicBool::new(false),
            app_handle: Mutex::new(None),
            knowledge_graph: RwLock::new(None),
        }
    }

    /// Check if the MCP server is running.
    pub fn is_mcp_running(&self) -> bool {
        self.mcp_running.load(Ordering::Relaxed)
    }

    /// Set the MCP running status.
    pub fn set_mcp_running(&self, running: bool) {
        self.mcp_running.store(running, Ordering::Relaxed);
    }
}
