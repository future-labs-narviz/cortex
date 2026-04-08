//! Search index management — creating, building, and updating the Tantivy index.

use crate::schema::build_schema;
use anyhow::{Context, Result};
use std::fs;
use std::path::Path;
use tantivy::schema::Schema;
use tantivy::{Index, IndexReader, IndexWriter, ReloadPolicy, Term};
use walkdir::WalkDir;

/// The Tantivy-backed search index for a vault.
pub struct SearchIndex {
    index: Index,
    reader: IndexReader,
    schema: Schema,
}

impl SearchIndex {
    /// Create or open an index at the given path.
    ///
    /// If the directory already contains a valid index it is opened;
    /// otherwise a new index is created.
    pub fn new(index_path: &Path) -> Result<Self> {
        fs::create_dir_all(index_path)
            .with_context(|| format!("Failed to create index directory: {:?}", index_path))?;

        let schema = build_schema();

        let dir = tantivy::directory::MmapDirectory::open(index_path)
            .with_context(|| format!("Failed to open mmap directory: {:?}", index_path))?;

        let index = if Index::exists(&dir)? {
            Index::open(dir).with_context(|| "Failed to open existing index")?
        } else {
            Index::create_in_dir(index_path, schema.clone())
                .with_context(|| "Failed to create new index")?
        };

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .with_context(|| "Failed to create index reader")?;

        Ok(Self {
            index,
            reader,
            schema,
        })
    }

    /// Get a reference to the schema.
    pub fn schema(&self) -> &Schema {
        &self.schema
    }

    /// Get a reference to the underlying index.
    pub fn index(&self) -> &Index {
        &self.index
    }

    /// Get a reference to the index reader.
    pub fn reader(&self) -> &IndexReader {
        &self.reader
    }

    /// Build the full index from all `.md` files in the vault.
    ///
    /// This does a full rebuild: deletes all existing documents and re-indexes everything.
    pub fn build_from_vault(&self, vault_path: &Path) -> Result<()> {
        let mut writer: IndexWriter = self
            .index
            .writer(50_000_000)
            .with_context(|| "Failed to create index writer with 50MB heap")?;

        // Clear the entire index for a fresh rebuild.
        writer.delete_all_documents()?;

        let path_field = self.schema.get_field("path").unwrap();
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();
        let tags_field = self.schema.get_field("tags").unwrap();

        for entry in WalkDir::new(vault_path)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                !name.starts_with(".cortex") && !name.starts_with('.')
            })
        {
            let entry = match entry {
                Ok(e) => e,
                Err(err) => {
                    log::warn!("Skipping entry during indexing: {}", err);
                    continue;
                }
            };

            let file_path = entry.path();
            if file_path.is_dir() {
                continue;
            }
            if file_path.extension().map_or(true, |ext| ext != "md") {
                continue;
            }

            let relative = file_path
                .strip_prefix(vault_path)
                .unwrap_or(file_path)
                .to_string_lossy()
                .to_string();

            let raw_content = match fs::read_to_string(file_path) {
                Ok(c) => c,
                Err(err) => {
                    log::warn!("Failed to read file {:?}: {}", file_path, err);
                    continue;
                }
            };

            let note = cortex_core::note::parse_note(&relative, &raw_content);

            let tags_str = note
                .frontmatter
                .as_ref()
                .map(|fm| fm.tags.join(" "))
                .unwrap_or_default();

            let mut doc = tantivy::TantivyDocument::new();
            doc.add_text(path_field, &note.path);
            doc.add_text(title_field, &note.title);
            doc.add_text(content_field, &note.content);
            doc.add_text(tags_field, &tags_str);
            writer.add_document(doc)?;
        }

        writer.commit().with_context(|| "Failed to commit index")?;

        // Reload the reader so searches see the new data.
        self.reader.reload()?;

        log::info!("Search index built from vault: {:?}", vault_path);
        Ok(())
    }

    /// Index (or re-index) a single note. Idempotent — removes any existing document
    /// with the same path before adding the new one.
    pub fn index_note(
        &self,
        path: &str,
        title: &str,
        content: &str,
        tags: &[String],
    ) -> Result<()> {
        let mut writer: IndexWriter = self
            .index
            .writer(50_000_000)
            .with_context(|| "Failed to create index writer")?;

        let path_field = self.schema.get_field("path").unwrap();
        let title_field = self.schema.get_field("title").unwrap();
        let content_field = self.schema.get_field("content").unwrap();
        let tags_field = self.schema.get_field("tags").unwrap();

        // Delete existing document with the same path.
        let term = Term::from_field_text(path_field, path);
        writer.delete_term(term);

        // Add the new document.
        let tags_str = tags.join(" ");
        let mut doc = tantivy::TantivyDocument::new();
        doc.add_text(path_field, path);
        doc.add_text(title_field, title);
        doc.add_text(content_field, content);
        doc.add_text(tags_field, &tags_str);
        writer.add_document(doc)?;

        writer.commit()?;
        self.reader.reload()?;

        log::debug!("Indexed note: {}", path);
        Ok(())
    }

    /// Remove a note from the index by its relative path.
    pub fn remove_note(&self, path: &str) -> Result<()> {
        let mut writer: IndexWriter = self
            .index
            .writer(50_000_000)
            .with_context(|| "Failed to create index writer")?;

        let path_field = self.schema.get_field("path").unwrap();
        let term = Term::from_field_text(path_field, path);
        writer.delete_term(term);
        writer.commit()?;
        self.reader.reload()?;

        log::debug!("Removed note from index: {}", path);
        Ok(())
    }
}
