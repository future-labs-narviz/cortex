//! File watcher - monitors the vault directory for changes and emits events.

use anyhow::Result;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;
use tokio::sync::Mutex;

/// Events emitted when files change in the vault.
#[derive(Debug, Clone)]
pub enum VaultEvent {
    /// A new .md file was created.
    Created(String),
    /// An existing .md file was modified.
    Modified(String),
    /// A .md file was deleted.
    Deleted(String),
    /// A .md file was renamed (old path, new path).
    Renamed(String, String),
}

/// Watches the vault directory for file system changes.
pub struct FileWatcher {
    _watcher: RecommendedWatcher,
    /// Handle to the debounce task so we can abort it on stop.
    _debounce_handle: tokio::task::JoinHandle<()>,
}

impl FileWatcher {
    /// Create a new file watcher on the given vault path.
    ///
    /// Events for `.md` files (excluding the `.cortex/` directory) are debounced
    /// by 300ms and sent on the provided broadcast channel.
    pub fn new(
        vault_path: PathBuf,
        tx: broadcast::Sender<VaultEvent>,
    ) -> Result<Self> {
        let (raw_tx, raw_rx) = tokio::sync::mpsc::unbounded_channel::<Event>();
        let vault_path_clone = vault_path.clone();

        let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
            if let Ok(event) = res {
                let _ = raw_tx.send(event);
            }
        })?;

        watcher.watch(&vault_path, RecursiveMode::Recursive)?;

        // Spawn a debounce task that collects events and emits them after 300ms of quiet.
        let debounce_handle = tokio::spawn(Self::debounce_loop(
            raw_rx,
            tx,
            vault_path_clone,
        ));

        Ok(Self {
            _watcher: watcher,
            _debounce_handle: debounce_handle,
        })
    }

    /// Convert an absolute path to a vault-relative path string.
    fn to_relative(vault_path: &Path, abs_path: &Path) -> Option<String> {
        abs_path
            .strip_prefix(vault_path)
            .ok()
            .map(|p| p.to_string_lossy().to_string())
    }

    /// Returns true if the path is a markdown file and not inside .cortex/.
    fn is_relevant(vault_path: &Path, path: &Path) -> bool {
        let rel = match path.strip_prefix(vault_path) {
            Ok(r) => r,
            Err(_) => return false,
        };
        let rel_str = rel.to_string_lossy();
        if rel_str.starts_with(".cortex") {
            return false;
        }
        path.extension().is_some_and(|ext| ext == "md")
    }

    /// Debounce loop: collects raw notify events and emits VaultEvents after 300ms of quiet.
    async fn debounce_loop(
        mut raw_rx: tokio::sync::mpsc::UnboundedReceiver<Event>,
        tx: broadcast::Sender<VaultEvent>,
        vault_path: PathBuf,
    ) {
        use std::collections::HashMap;

        let pending: Arc<Mutex<HashMap<String, VaultEvent>>> =
            Arc::new(Mutex::new(HashMap::new()));
        let debounce_duration = Duration::from_millis(300);

        loop {
            let event = match raw_rx.recv().await {
                Some(e) => e,
                None => break, // channel closed
            };

            // Process each path in the event.
            for path in &event.paths {
                if !Self::is_relevant(&vault_path, path) {
                    continue;
                }
                let rel = match Self::to_relative(&vault_path, path) {
                    Some(r) => r,
                    None => continue,
                };

                let vault_event = match event.kind {
                    EventKind::Create(_) => VaultEvent::Created(rel.clone()),
                    EventKind::Modify(_) => VaultEvent::Modified(rel.clone()),
                    EventKind::Remove(_) => VaultEvent::Deleted(rel.clone()),
                    _ => continue,
                };

                let mut map = pending.lock().await;
                map.insert(rel, vault_event);
            }

            // Handle rename events (notify sends two paths for renames).
            if matches!(event.kind, EventKind::Modify(notify::event::ModifyKind::Name(_))) {
                if event.paths.len() == 2 {
                    let old = &event.paths[0];
                    let new = &event.paths[1];
                    if Self::is_relevant(&vault_path, old) || Self::is_relevant(&vault_path, new) {
                        if let (Some(old_rel), Some(new_rel)) = (
                            Self::to_relative(&vault_path, old),
                            Self::to_relative(&vault_path, new),
                        ) {
                            let mut map = pending.lock().await;
                            // Remove any individual create/modify for these paths.
                            map.remove(&old_rel);
                            map.remove(&new_rel);
                            map.insert(
                                format!("rename:{}:{}", old_rel, new_rel),
                                VaultEvent::Renamed(old_rel, new_rel),
                            );
                        }
                    }
                }
            }

            // Drain pending events after debounce period of no new events.
            let pending_clone = pending.clone();
            let tx_clone = tx.clone();
            // Try to drain: wait for debounce_duration with no more events.
            loop {
                match tokio::time::timeout(debounce_duration, raw_rx.recv()).await {
                    Ok(Some(next_event)) => {
                        // Another event came in, process it too.
                        for path in &next_event.paths {
                            if !Self::is_relevant(&vault_path, path) {
                                continue;
                            }
                            let rel = match Self::to_relative(&vault_path, path) {
                                Some(r) => r,
                                None => continue,
                            };
                            let vault_event = match next_event.kind {
                                EventKind::Create(_) => VaultEvent::Created(rel.clone()),
                                EventKind::Modify(_) => VaultEvent::Modified(rel.clone()),
                                EventKind::Remove(_) => VaultEvent::Deleted(rel.clone()),
                                _ => continue,
                            };
                            let mut map = pending_clone.lock().await;
                            map.insert(rel, vault_event);
                        }
                    }
                    Ok(None) => {
                        // Channel closed.
                        return;
                    }
                    Err(_) => {
                        // Timeout: debounce period passed, flush pending events.
                        let mut map = pending_clone.lock().await;
                        for (_key, event) in map.drain() {
                            let _ = tx_clone.send(event);
                        }
                        break;
                    }
                }
            }
        }
    }

    /// Stop the file watcher.
    pub fn stop(&mut self) {
        self._debounce_handle.abort();
    }
}
