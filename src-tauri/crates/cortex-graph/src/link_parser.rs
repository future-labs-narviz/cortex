//! Parser for wikilinks and tags in Markdown content.

use crate::types::{Tag, WikiLink};
use regex::Regex;

/// Parse all `[[wikilinks]]` from Markdown content.
///
/// Supports `[[target]]` and `[[target|alias]]` syntax.
/// Returns a `WikiLink` for each match with the 1-based line number.
pub fn parse_wikilinks(content: &str) -> Vec<WikiLink> {
    let re = Regex::new(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]").expect("invalid wikilink regex");
    let mut links = Vec::new();

    for (line_idx, line) in content.lines().enumerate() {
        for cap in re.captures_iter(line) {
            let target = cap[1].trim().to_string();
            let alias = cap.get(2).map(|m| m.as_str().trim().to_string());
            links.push(WikiLink {
                target,
                alias,
                line: (line_idx + 1) as u32,
            });
        }
    }

    links
}

/// Parse all `#tags` from Markdown content.
///
/// Matches tags preceded by whitespace, start-of-line, or a comma.
/// Skips content inside fenced code blocks (``` ... ```).
pub fn parse_tags(content: &str) -> Vec<Tag> {
    let re = Regex::new(r"(?:^|[\s,])#([a-zA-Z0-9_/\-]+)").expect("invalid tag regex");
    let mut tags = Vec::new();
    let mut in_code_block = false;

    for (line_idx, line) in content.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block {
            continue;
        }

        for cap in re.captures_iter(line) {
            let name = cap[1].to_string();
            // Skip markdown headings (lines starting with #)
            if line.trim_start().starts_with('#') && !line.trim_start().starts_with("##") {
                // Could be a heading like "# Title" - but we matched a tag pattern.
                // Only skip if the # is the first non-whitespace character AND
                // it's followed by a space (heading syntax).
                // The regex requires whitespace/comma before #, so a heading
                // "# Title" won't match (# is first char, no preceding whitespace
                // for the tag capture). But "## heading #tag" would match #tag.
                // This is fine - we keep it.
            }
            tags.push(Tag {
                name,
                line: (line_idx + 1) as u32,
            });
        }
    }

    tags
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_wikilink() {
        let content = "See [[My Note]] for details.";
        let links = parse_wikilinks(content);
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target, "My Note");
        assert!(links[0].alias.is_none());
        assert_eq!(links[0].line, 1);
    }

    #[test]
    fn test_parse_aliased_wikilink() {
        let content = "Check [[My Note|this note]] out.";
        let links = parse_wikilinks(content);
        assert_eq!(links.len(), 1);
        assert_eq!(links[0].target, "My Note");
        assert_eq!(links[0].alias.as_deref(), Some("this note"));
    }

    #[test]
    fn test_parse_multiple_wikilinks() {
        let content = "Link to [[A]] and [[B|bee]].\nAlso [[C]].";
        let links = parse_wikilinks(content);
        assert_eq!(links.len(), 3);
        assert_eq!(links[2].line, 2);
    }

    #[test]
    fn test_parse_tags() {
        let content = "Some text #rust #programming\nMore #ideas";
        let tags = parse_tags(content);
        assert_eq!(tags.len(), 3);
        assert_eq!(tags[0].name, "rust");
        assert_eq!(tags[1].name, "programming");
        assert_eq!(tags[2].name, "ideas");
    }

    #[test]
    fn test_tags_skip_code_blocks() {
        let content = "Normal #tag\n```\n#not-a-tag\n```\nAfter #real";
        let tags = parse_tags(content);
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].name, "tag");
        assert_eq!(tags[1].name, "real");
    }
}
