//! Link index: maintains forward links, backlinks, and tag mappings for the vault.

use crate::link_parser::{parse_tags, parse_wikilinks};
use crate::types::{Backlink, GraphData, GraphEdge, GraphNode, TagInfo, WikiLink};
use anyhow::{Context, Result};
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::path::Path;

/// In-memory index of all links and tags across the vault.
pub struct LinkIndex {
    /// note_path -> outgoing wikilinks
    forward_links: HashMap<String, Vec<WikiLink>>,
    /// note_path (target, normalized) -> incoming backlinks
    backlinks: HashMap<String, Vec<Backlink>>,
    /// tag_name -> list of note paths
    tag_index: HashMap<String, Vec<String>>,
    /// note_path -> tags
    note_tags: HashMap<String, Vec<crate::types::Tag>>,
    /// note_path -> title (for display)
    note_titles: HashMap<String, String>,
    /// All known note paths (for link resolution).
    known_paths: HashSet<String>,
}

impl LinkIndex {
    /// Create an empty index.
    pub fn new() -> Self {
        Self {
            forward_links: HashMap::new(),
            backlinks: HashMap::new(),
            tag_index: HashMap::new(),
            note_tags: HashMap::new(),
            note_titles: HashMap::new(),
            known_paths: HashSet::new(),
        }
    }

    /// Build the index by scanning all `.md` files under `vault_path`.
    pub fn build_from_vault(vault_path: &Path) -> Result<Self> {
        let mut index = Self::new();

        // First pass: collect all known paths.
        for entry in walkdir::WalkDir::new(vault_path)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                !name.starts_with(".cortex") && !name.starts_with('.')
            })
        {
            let entry = entry.context("failed to walk vault directory")?;
            let path = entry.path();
            if path.is_file() && path.extension().map_or(false, |ext| ext == "md") {
                let relative = path
                    .strip_prefix(vault_path)
                    .unwrap_or(path)
                    .to_string_lossy()
                    .to_string();
                index.known_paths.insert(relative);
            }
        }

        // Second pass: parse each file.
        let paths: Vec<String> = index.known_paths.iter().cloned().collect();
        for rel_path in &paths {
            let full_path = vault_path.join(rel_path);
            let content = fs::read_to_string(&full_path)
                .with_context(|| format!("failed to read {}", rel_path))?;
            let title = Self::extract_title(rel_path, &content);
            index.update_note(rel_path, &title, &content);
        }

        log::info!(
            "LinkIndex built: {} notes, {} total forward links",
            index.known_paths.len(),
            index.forward_links.values().map(|v| v.len()).sum::<usize>()
        );

        Ok(index)
    }

    /// Return the number of indexed notes.
    pub fn note_count(&self) -> usize {
        self.known_paths.len()
    }

    /// Update the index for a single note (called on file create/modify).
    pub fn update_note(&mut self, path: &str, title: &str, content: &str) {
        // Remove old data for this note first.
        self.remove_note(path);

        // Register the note.
        self.known_paths.insert(path.to_string());
        self.note_titles.insert(path.to_string(), title.to_string());

        // Parse forward links.
        let wikilinks = parse_wikilinks(content);
        let lines: Vec<&str> = content.lines().collect();

        for link in &wikilinks {
            let target_key = self.normalize_target(&link.target);
            let context_line = if link.line > 0 && (link.line as usize) <= lines.len() {
                lines[(link.line - 1) as usize].to_string()
            } else {
                String::new()
            };

            // Add backlink to the target note.
            self.backlinks
                .entry(target_key)
                .or_default()
                .push(Backlink {
                    source_path: path.to_string(),
                    source_title: title.to_string(),
                    context: context_line,
                    line: link.line,
                });
        }

        self.forward_links
            .insert(path.to_string(), wikilinks);

        // Parse tags.
        let tags = parse_tags(content);
        for tag in &tags {
            self.tag_index
                .entry(tag.name.clone())
                .or_default()
                .push(path.to_string());
        }
        self.note_tags.insert(path.to_string(), tags);
    }

    /// Remove a note from the index entirely.
    pub fn remove_note(&mut self, path: &str) {
        // Remove forward links and their corresponding backlinks.
        if let Some(old_links) = self.forward_links.remove(path) {
            for link in &old_links {
                let target_key = self.normalize_target(&link.target);
                if let Some(bl_list) = self.backlinks.get_mut(&target_key) {
                    bl_list.retain(|bl| bl.source_path != path);
                    if bl_list.is_empty() {
                        self.backlinks.remove(&target_key);
                    }
                }
            }
        }

        // Remove tags.
        if let Some(old_tags) = self.note_tags.remove(path) {
            for tag in &old_tags {
                if let Some(paths) = self.tag_index.get_mut(&tag.name) {
                    paths.retain(|p| p != path);
                    if paths.is_empty() {
                        self.tag_index.remove(&tag.name);
                    }
                }
            }
        }

        self.note_titles.remove(path);
        self.known_paths.remove(path);
    }

    /// Get all backlinks for a note, matched by path or by note name.
    pub fn get_backlinks(&self, note_path: &str) -> Vec<Backlink> {
        let key = self.normalize_target(note_path);

        // Try the normalized path key first.
        let mut results = self.backlinks.get(&key).cloned().unwrap_or_default();

        // Also try matching by note name (stem without .md and path).
        let stem = Path::new(note_path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if stem != key {
            if let Some(bl) = self.backlinks.get(&stem) {
                for b in bl {
                    if !results.iter().any(|r| r.source_path == b.source_path && r.line == b.line) {
                        results.push(b.clone());
                    }
                }
            }
        }

        results
    }

    /// Get graph data for D3 visualization.
    ///
    /// If `center` is provided, BFS from that note up to `depth` hops.
    /// If `None`, returns the full graph.
    pub fn get_graph_data(&self, center: Option<&str>, depth: u32) -> GraphData {
        let included: HashSet<&str> = match center {
            Some(center_path) => {
                let mut visited: HashSet<&str> = HashSet::new();
                let mut queue: VecDeque<(&str, u32)> = VecDeque::new();

                // Find the center in known paths.
                let center_key = self.find_known_path(center_path);
                if let Some(start) = center_key {
                    queue.push_back((start, 0));
                    visited.insert(start);

                    while let Some((current, d)) = queue.pop_front() {
                        if d >= depth {
                            continue;
                        }
                        // Forward neighbors.
                        if let Some(links) = self.forward_links.get(current) {
                            for link in links {
                                let target_key = self.normalize_target(&link.target);
                                if let Some(resolved) = self.find_known_path(&target_key) {
                                    if visited.insert(resolved) {
                                        queue.push_back((resolved, d + 1));
                                    }
                                }
                            }
                        }
                        // Backward neighbors.
                        let norm = self.normalize_target(current);
                        if let Some(bl) = self.backlinks.get(&norm) {
                            for b in bl {
                                if let Some(resolved) = self.find_known_path(&b.source_path) {
                                    if visited.insert(resolved) {
                                        queue.push_back((resolved, d + 1));
                                    }
                                }
                            }
                        }
                    }
                }
                visited
            }
            None => self.known_paths.iter().map(|s| s.as_str()).collect(),
        };

        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        for path in &included {
            let forward_count = self
                .forward_links
                .get(*path)
                .map(|v| v.len())
                .unwrap_or(0);
            let norm = self.normalize_target(path);
            let back_count = self.backlinks.get(&norm).map(|v| v.len()).unwrap_or(0);

            let label = self
                .note_titles
                .get(*path)
                .cloned()
                .unwrap_or_else(|| path.to_string());

            nodes.push(GraphNode {
                id: path.to_string(),
                label,
                weight: (forward_count + back_count) as u32,
            });

            // Add edges for forward links whose target is in the included set.
            if let Some(links) = self.forward_links.get(*path) {
                for link in links {
                    let target_key = self.normalize_target(&link.target);
                    if let Some(resolved) = self.find_known_path(&target_key) {
                        if included.contains(resolved) {
                            edges.push(GraphEdge {
                                source: path.to_string(),
                                target: resolved.to_string(),
                            });
                        }
                    }
                }
            }
        }

        GraphData { nodes, edges }
    }

    /// Get all tags with occurrence counts, sorted by count descending.
    pub fn get_all_tags(&self) -> Vec<TagInfo> {
        let mut tags: Vec<TagInfo> = self
            .tag_index
            .iter()
            .map(|(name, paths)| TagInfo {
                name: name.clone(),
                count: paths.len() as u32,
            })
            .collect();
        tags.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.name.cmp(&b.name)));
        tags
    }

    /// Get all note paths that have the given tag.
    pub fn get_notes_by_tag(&self, tag: &str) -> Vec<String> {
        self.tag_index.get(tag).cloned().unwrap_or_default()
    }

    /// Resolve a wikilink target to a known file path.
    ///
    /// Tries exact match, then case-insensitive, then partial (stem) match.
    pub fn resolve_link(&self, target: &str) -> Option<String> {
        self.find_known_path(target).map(|s| s.to_string())
    }

    // ---- internal helpers ----

    /// Normalize a wikilink target for use as a backlinks key.
    /// Lowercases and strips `.md` extension.
    fn normalize_target(&self, target: &str) -> String {
        let t = target.trim().to_lowercase();
        t.strip_suffix(".md").unwrap_or(&t).to_string()
    }

    /// Find a known path that matches the given target.
    fn find_known_path(&self, target: &str) -> Option<&str> {
        let normalized = self.normalize_target(target);

        // Exact match.
        if let Some(p) = self.known_paths.get(&format!("{}.md", normalized)) {
            return Some(p.as_str());
        }
        if let Some(p) = self.known_paths.get(target) {
            return Some(p.as_str());
        }

        // Case-insensitive full path match.
        for p in &self.known_paths {
            if p.to_lowercase() == normalized || p.to_lowercase() == format!("{}.md", normalized) {
                return Some(p.as_str());
            }
        }

        // Stem match: target matches just the filename stem.
        for p in &self.known_paths {
            let stem = Path::new(p)
                .file_stem()
                .map(|s| s.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            if stem == normalized {
                return Some(p.as_str());
            }
        }

        None
    }

    /// Extract a title from note content (first `# Heading` or filename stem).
    fn extract_title(path: &str, content: &str) -> String {
        // Try first heading.
        for line in content.lines() {
            let trimmed = line.trim();
            if let Some(heading) = trimmed.strip_prefix("# ") {
                let title = heading.trim();
                if !title.is_empty() {
                    return title.to_string();
                }
            }
        }
        // Fall back to filename stem.
        Path::new(path)
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string())
    }
}

impl Default for LinkIndex {
    fn default() -> Self {
        Self::new()
    }
}
