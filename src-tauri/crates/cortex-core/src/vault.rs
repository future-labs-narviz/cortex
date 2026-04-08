//! Vault management - handles reading, writing, and organizing notes in the vault directory.

use crate::note::parse_note;
use crate::types::{CapturedNote, Note, VaultFile};
use anyhow::{Context, Result};
use chrono::Utc;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Manages the vault directory and all file operations.
pub struct Vault {
    /// Root path of the vault on disk.
    root: PathBuf,
}

impl Vault {
    /// Create a new Vault instance, creating the root directory and `.cortex/` metadata dir if needed.
    ///
    /// This is a convenience constructor used at app startup.
    pub fn new(root: PathBuf) -> Result<Self> {
        fs::create_dir_all(root.join("captured"))?;
        fs::create_dir_all(root.join(".cortex"))?;
        Ok(Self { root })
    }

    /// Open an existing vault directory.
    ///
    /// Validates that the directory exists and creates the `.cortex/` metadata directory if missing.
    pub fn open(path: PathBuf) -> Result<Self> {
        anyhow::ensure!(path.exists(), "Vault directory does not exist: {:?}", path);
        anyhow::ensure!(path.is_dir(), "Vault path is not a directory: {:?}", path);
        fs::create_dir_all(path.join(".cortex"))?;
        Ok(Self { root: path })
    }

    /// Create a new vault at the given path (creates the directory).
    pub fn create(path: PathBuf) -> Result<Self> {
        fs::create_dir_all(&path)
            .with_context(|| format!("Failed to create vault directory: {:?}", path))?;
        fs::create_dir_all(path.join(".cortex"))?;
        Ok(Self { root: path })
    }

    /// Return the root path of the vault.
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Return the vault path (alias for `root()`).
    pub fn vault_path(&self) -> &Path {
        &self.root
    }

    /// Recursively list all `.md` files and directories in the vault.
    ///
    /// Returns a proper tree structure where directories contain their children.
    /// Ignores the `.cortex/` metadata directory.
    pub fn list_files(&self) -> Result<Vec<VaultFile>> {
        use std::collections::HashMap;

        let mut flat = Vec::new();

        for entry in WalkDir::new(&self.root)
            .min_depth(1)
            .into_iter()
            .filter_entry(|e| {
                // Skip .cortex directory and hidden directories.
                let name = e.file_name().to_string_lossy();
                !name.starts_with('.')
            })
        {
            let entry = entry?;
            let path = entry.path();

            let name = entry.file_name().to_string_lossy().to_string();
            let is_dir = path.is_dir();

            // Only include .md files and directories.
            if !is_dir && path.extension().map_or(true, |ext| ext != "md") {
                continue;
            }

            let relative = path
                .strip_prefix(&self.root)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();

            let modified = path
                .metadata()
                .and_then(|m| m.modified())
                .map(|t| {
                    t.duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs() as f64
                })
                .unwrap_or(0.0);

            flat.push(VaultFile {
                path: relative,
                name,
                is_dir,
                modified,
                children: if is_dir { Some(Vec::new()) } else { None },
            });
        }

        // Build tree from flat list.
        flat.sort_by(|a, b| a.path.cmp(&b.path));

        let mut dir_map: HashMap<String, Vec<VaultFile>> = HashMap::new();

        // Group files by their parent directory.
        for file in flat {
            let parent = if let Some(idx) = file.path.rfind('/') {
                file.path[..idx].to_string()
            } else {
                String::new() // root level
            };
            dir_map.entry(parent).or_default().push(file);
        }

        // Recursively build tree.
        fn build_tree(path: &str, dir_map: &mut HashMap<String, Vec<VaultFile>>) -> Vec<VaultFile> {
            let mut files = dir_map.remove(path).unwrap_or_default();
            for file in &mut files {
                if file.is_dir {
                    file.children = Some(build_tree(&file.path, dir_map));
                }
            }
            // Sort: dirs first, then alphabetical.
            files.sort_by(|a, b| {
                b.is_dir
                    .cmp(&a.is_dir)
                    .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
            });
            files
        }

        Ok(build_tree("", &mut dir_map))
    }

    /// Read a note from the vault by its relative path.
    pub fn read_note(&self, relative_path: &str) -> Result<Note> {
        let full_path = self.root.join(relative_path);
        anyhow::ensure!(full_path.exists(), "Note not found: {}", relative_path);
        let content = fs::read_to_string(&full_path)
            .with_context(|| format!("Failed to read note: {}", relative_path))?;
        Ok(parse_note(relative_path, &content))
    }

    /// Write content to a note using atomic write (temp file + rename).
    pub fn write_note(&self, relative_path: &str, content: &str) -> Result<()> {
        let full_path = self.root.join(relative_path);

        // Ensure parent directory exists.
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Atomic write: write to a temp file, then rename.
        let tmp_path = full_path.with_extension("md.tmp");
        fs::write(&tmp_path, content)
            .with_context(|| format!("Failed to write temp file for: {}", relative_path))?;
        fs::rename(&tmp_path, &full_path)
            .with_context(|| format!("Failed to rename temp file for: {}", relative_path))?;

        Ok(())
    }

    /// Create a new note with the given title and optional folder.
    ///
    /// Returns the relative path of the created note.
    pub fn create_note(&self, title: &str, folder: Option<&str>) -> Result<String> {
        // Sanitize the title for use as a filename.
        let safe_title: String = title
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' { c } else { '_' })
            .collect();
        let filename = format!("{}.md", safe_title.trim());

        let relative_path = match folder {
            Some(f) => {
                let folder_path = self.root.join(f);
                fs::create_dir_all(&folder_path)?;
                format!("{}/{}", f, filename)
            }
            None => filename,
        };

        let full_path = self.root.join(&relative_path);
        anyhow::ensure!(
            !full_path.exists(),
            "Note already exists: {}",
            relative_path
        );

        // Write initial content with frontmatter.
        let now = Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        let initial_content = format!(
            "---\ntitle: {}\ncreated: {}\nmodified: {}\ntags: []\n---\n\n# {}\n",
            title, now, now, title
        );

        self.write_note(&relative_path, &initial_content)?;

        Ok(relative_path)
    }

    /// Rename (move) a note from one relative path to another.
    pub fn rename_note(&self, old_path: &str, new_path: &str) -> Result<()> {
        let old_full = self.root.join(old_path);
        let new_full = self.root.join(new_path);

        anyhow::ensure!(old_full.exists(), "Source note not found: {}", old_path);
        anyhow::ensure!(!new_full.exists(), "Destination already exists: {}", new_path);

        if let Some(parent) = new_full.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::rename(&old_full, &new_full)
            .with_context(|| format!("Failed to rename {} to {}", old_path, new_path))?;

        Ok(())
    }

    /// Delete a note by its relative path.
    pub fn delete_note(&self, relative_path: &str) -> Result<()> {
        let full_path = self.root.join(relative_path);
        anyhow::ensure!(full_path.exists(), "Note not found: {}", relative_path);
        fs::remove_file(&full_path)
            .with_context(|| format!("Failed to delete note: {}", relative_path))?;
        Ok(())
    }

    /// Create a folder inside the vault.
    pub fn create_folder(&self, relative_path: &str) -> Result<()> {
        let full_path = self.root.join(relative_path);
        fs::create_dir_all(&full_path)
            .with_context(|| format!("Failed to create folder: {}", relative_path))?;
        Ok(())
    }

    /// Capture a new note and write it to the vault (legacy MCP support).
    pub fn capture(&self, content: String, tags: Vec<String>) -> Result<CapturedNote> {
        let now = Utc::now();
        let id = format!("{}", now.format("%Y%m%d_%H%M%S_%3f"));
        let note = CapturedNote {
            id: id.clone(),
            content,
            tags,
            created_at: now,
        };

        let filename = format!("{}.json", id);
        let captured_dir = self.root.join("captured");
        fs::create_dir_all(&captured_dir)?;
        let path = captured_dir.join(filename);
        let json = serde_json::to_string_pretty(&note)?;
        fs::write(path, json)?;

        Ok(note)
    }

    /// List all captured notes (legacy MCP support).
    pub fn list_captured(&self) -> Result<Vec<CapturedNote>> {
        let captured_dir = self.root.join("captured");
        if !captured_dir.exists() {
            return Ok(vec![]);
        }

        let mut notes = Vec::new();
        for entry in fs::read_dir(captured_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().is_some_and(|ext| ext == "json") {
                let content = fs::read_to_string(&path)?;
                if let Ok(note) = serde_json::from_str::<CapturedNote>(&content) {
                    notes.push(note);
                }
            }
        }

        notes.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(notes)
    }
}
