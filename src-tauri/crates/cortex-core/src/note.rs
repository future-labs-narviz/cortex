//! Note parsing - handles YAML frontmatter extraction and note construction.

use crate::types::{Frontmatter, Note};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;

/// Raw frontmatter as deserialized from YAML, before normalization.
#[derive(Debug, Deserialize)]
struct RawFrontmatter {
    title: Option<String>,
    tags: Option<Vec<String>>,
    aliases: Option<Vec<String>>,
    created: Option<String>,
    modified: Option<String>,
    #[serde(flatten)]
    extra: HashMap<String, serde_yaml::Value>,
}

/// Convert a serde_yaml::Value into a JSON string for storage.
fn yaml_value_to_string(val: &serde_yaml::Value) -> String {
    match val {
        serde_yaml::Value::String(s) => s.clone(),
        other => serde_yaml::to_string(other).unwrap_or_default().trim().to_string(),
    }
}

/// Parse YAML frontmatter from the raw content of a note.
///
/// Frontmatter is expected between `---\n` delimiters at the very start of the file.
pub fn parse_frontmatter(raw_content: &str) -> Option<Frontmatter> {
    if !raw_content.starts_with("---\n") && !raw_content.starts_with("---\r\n") {
        return None;
    }

    // Find the closing delimiter.
    let after_first = if raw_content.starts_with("---\r\n") {
        5
    } else {
        4
    };
    let rest = &raw_content[after_first..];
    let end = rest.find("\n---").map(|i| i)?;
    let yaml_str = &rest[..end];

    let raw: RawFrontmatter = serde_yaml::from_str(yaml_str).ok()?;

    let extra: HashMap<String, String> = raw
        .extra
        .iter()
        .map(|(k, v)| (k.clone(), yaml_value_to_string(v)))
        .collect();

    Some(Frontmatter {
        title: raw.title,
        tags: raw.tags.unwrap_or_default(),
        aliases: raw.aliases.unwrap_or_default(),
        created: raw.created,
        modified: raw.modified,
        extra,
    })
}

/// Parse a note from a relative path and raw file content.
pub fn parse_note(relative_path: &str, raw_content: &str) -> Note {
    let title = Path::new(relative_path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    let frontmatter = parse_frontmatter(raw_content);

    Note {
        path: relative_path.to_string(),
        title,
        content: raw_content.to_string(),
        frontmatter,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_frontmatter() {
        let content = "---\ntitle: Hello\ntags:\n  - rust\n  - tauri\n---\n# Hello\nBody text.";
        let fm = parse_frontmatter(content).unwrap();
        assert_eq!(fm.title, Some("Hello".to_string()));
        assert_eq!(fm.tags, vec!["rust", "tauri"]);
    }

    #[test]
    fn test_no_frontmatter() {
        let content = "# Just a heading\nSome body.";
        assert!(parse_frontmatter(content).is_none());
    }

    #[test]
    fn test_parse_note() {
        let note = parse_note("folder/my-note.md", "---\ntitle: Test\n---\nContent");
        assert_eq!(note.title, "my-note");
        assert_eq!(note.path, "folder/my-note.md");
        assert!(note.frontmatter.is_some());
    }
}
