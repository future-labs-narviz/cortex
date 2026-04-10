//! Centralized application state for Tauri.

use cortex_core::vault::Vault;
use cortex_core::watcher::{FileWatcher, VaultEvent};
use cortex_graph::index::LinkIndex;
use cortex_kg::TypedKnowledgeGraph;
use cortex_search::indexer::SearchIndex;
use cortex_voice::VoicePipeline;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use tauri::AppHandle;
use tauri_plugin_shell::process::CommandChild;
use tokio::sync::broadcast;
use tokio::sync::Mutex as AsyncMutex;

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
    /// Claude-powered typed knowledge graph. Wrapped in Arc so background extraction
    /// jobs (cortex-extract) can clone the handle and write back into the same lock.
    pub knowledge_graph: Arc<RwLock<Option<TypedKnowledgeGraph>>>,
    /// In-flight Phase B runs keyed by run_id, tracked so `abort_run` can
    /// SIGTERM the spawned `claude` child process.
    pub active_runs: AsyncMutex<HashMap<String, CommandChild>>,
    /// In-flight Phase B drafts keyed by draft_id, tracked so `abort_draft`
    /// can SIGTERM the spawned `claude --permission-mode plan` child.
    /// Separate from active_runs so the two cancellation flows don't
    /// collide (a draft and an execute could be in flight simultaneously
    /// with different lifecycles).
    pub active_drafts: AsyncMutex<HashMap<String, CommandChild>>,
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
            knowledge_graph: Arc::new(RwLock::new(None)),
            active_runs: AsyncMutex::new(HashMap::new()),
            active_drafts: AsyncMutex::new(HashMap::new()),
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
