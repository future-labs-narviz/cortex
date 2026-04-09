use std::collections::{HashMap, HashSet, VecDeque};
use std::path::Path;

use anyhow::Result;
use serde::{Deserialize, Serialize};

use crate::types::*;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct TypedKnowledgeGraph {
    entities: HashMap<String, KgEntity>,
    relations: Vec<KgRelation>,
    alias_to_canonical: HashMap<String, String>,
    processed_notes: Vec<String>,
}

impl TypedKnowledgeGraph {
    pub fn new() -> Self {
        Default::default()
    }

    pub fn store_entities(&mut self, note_path: &str, entities: Vec<KgEntity>) {
        for mut entity in entities {
            let name = entity.name.clone();
            let canonical = self
                .alias_to_canonical
                .get(&name)
                .cloned()
                .unwrap_or(name.clone());
            if let Some(existing) = self.entities.get_mut(&canonical) {
                if !existing.source_notes.contains(&note_path.to_string()) {
                    existing.source_notes.push(note_path.to_string());
                }
                if entity.description.len() > existing.description.len() {
                    existing.description = entity.description;
                }
            } else {
                entity.source_notes = vec![note_path.to_string()];
                if entity.aliases.is_empty() {
                    entity.aliases = Vec::new();
                }
                self.entities.insert(name, entity);
            }
        }
        if !self.processed_notes.contains(&note_path.to_string()) {
            self.processed_notes.push(note_path.to_string());
        }
    }

    pub fn store_relations(&mut self, note_path: &str, relations: Vec<KgRelation>) {
        for mut rel in relations {
            rel.source = self.resolve_name(&rel.source);
            rel.target = self.resolve_name(&rel.target);
            rel.source_note = note_path.to_string();
            let is_dup = self.relations.iter().any(|r| {
                r.source == rel.source && r.predicate == rel.predicate && r.target == rel.target
            });
            if !is_dup {
                self.relations.push(rel);
            }
        }
    }

    pub fn resolve_entity(&mut self, canonical: &str, aliases: Vec<String>) {
        for alias in &aliases {
            self.alias_to_canonical
                .insert(alias.clone(), canonical.to_string());
            if let Some(old_entity) = self.entities.remove(alias) {
                if let Some(canonical_entity) = self.entities.get_mut(canonical) {
                    canonical_entity
                        .source_notes
                        .extend(old_entity.source_notes);
                    canonical_entity.source_notes.sort();
                    canonical_entity.source_notes.dedup();
                    if !canonical_entity.aliases.contains(alias) {
                        canonical_entity.aliases.push(alias.clone());
                    }
                }
            }
        }
        for rel in &mut self.relations {
            if let Some(canonical) = self.alias_to_canonical.get(&rel.source).cloned() {
                rel.source = canonical;
            }
            if let Some(canonical) = self.alias_to_canonical.get(&rel.target).cloned() {
                rel.target = canonical;
            }
        }
    }

    fn resolve_name(&self, name: &str) -> String {
        self.alias_to_canonical
            .get(name)
            .cloned()
            .unwrap_or_else(|| name.to_string())
    }

    pub fn get_unprocessed_notes(&self, all_note_paths: &[String]) -> Vec<String> {
        all_note_paths
            .iter()
            .filter(|p| !self.processed_notes.contains(p))
            .cloned()
            .collect()
    }

    pub fn invalidate_note(&mut self, note_path: &str) {
        self.processed_notes.retain(|p| p != note_path);
        self.relations.retain(|r| r.source_note != note_path);
        self.entities.retain(|_, e| {
            e.source_notes.retain(|s| s != note_path);
            !e.source_notes.is_empty()
        });
    }

    pub fn serialize_subgraph(&self, center: &str, hops: u32) -> String {
        let resolved_center = self.resolve_name(center);
        let mut visited: HashSet<String> = HashSet::new();
        let mut queue: VecDeque<(String, u32)> = VecDeque::new();
        queue.push_back((resolved_center.clone(), 0));
        visited.insert(resolved_center);
        let mut result_relations: Vec<&KgRelation> = Vec::new();

        while let Some((current, depth)) = queue.pop_front() {
            if depth >= hops {
                continue;
            }
            for relation in &self.relations {
                if relation.source == current {
                    result_relations.push(relation);
                    if !visited.contains(&relation.target) {
                        visited.insert(relation.target.clone());
                        queue.push_back((relation.target.clone(), depth + 1));
                    }
                }
                if relation.target == current {
                    result_relations.push(relation);
                    if !visited.contains(&relation.source) {
                        visited.insert(relation.source.clone());
                        queue.push_back((relation.source.clone(), depth + 1));
                    }
                }
            }
        }

        let mut seen: HashSet<String> = HashSet::new();
        let mut lines: Vec<String> = Vec::new();
        for rel in result_relations {
            let line = format!("({}) --[{}]--> ({})", rel.source, rel.predicate, rel.target);
            if seen.insert(line.clone()) {
                lines.push(line);
            }
        }
        lines.join("\n")
    }

    pub fn entity_profile(&self, name: &str) -> Option<KgEntityProfile> {
        let canonical = self.resolve_name(name);
        let entity = self.entities.get(&canonical)?.clone();
        let relations_out: Vec<_> = self
            .relations
            .iter()
            .filter(|r| r.source == canonical)
            .cloned()
            .collect();
        let relations_in: Vec<_> = self
            .relations
            .iter()
            .filter(|r| r.target == canonical)
            .cloned()
            .collect();
        let mention_count = entity.source_notes.len() as u32;
        Some(KgEntityProfile {
            entity,
            relations_out,
            relations_in,
            mention_count,
        })
    }

    pub fn to_graph_data(&self) -> KgGraphData {
        KgGraphData {
            entities: self.entities.values().cloned().collect(),
            relations: self.relations.clone(),
        }
    }

    pub fn search_entities(&self, query: &str) -> Vec<&KgEntity> {
        let q = query.to_lowercase();
        self.entities
            .values()
            .filter(|e| {
                e.name.to_lowercase().contains(&q) || e.description.to_lowercase().contains(&q)
            })
            .collect()
    }

    pub fn entity_count(&self) -> usize {
        self.entities.len()
    }

    pub fn relation_count(&self) -> usize {
        self.relations.len()
    }

    pub fn processed_count(&self) -> usize {
        self.processed_notes.len()
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    pub fn load(path: &Path) -> Result<Self> {
        let json = std::fs::read_to_string(path)?;
        Ok(serde_json::from_str(&json)?)
    }

    pub fn nearby_for_cwd(
        &self,
        cwd: &str,
        vault_root: &str,
        max_entities: usize,
    ) -> KgGraphData {
        let mut matched: Vec<KgEntity> = if cwd.starts_with(vault_root) {
            // cwd is inside (or equal to) the vault — match by relative subpath prefix
            let rel_subpath = if cwd == vault_root {
                String::new()
            } else {
                // Strip the vault_root prefix; handle trailing slash on vault_root
                let stripped = cwd.strip_prefix(vault_root).unwrap_or("");
                let stripped = stripped.strip_prefix('/').unwrap_or(stripped);
                stripped.to_string()
            };

            self.entities
                .values()
                .filter(|e| {
                    if rel_subpath.is_empty() {
                        // cwd == vault_root: all entities match
                        true
                    } else {
                        e.source_notes.iter().any(|note| {
                            note.starts_with(&rel_subpath)
                                || note.contains(&format!("/{}", rel_subpath))
                        })
                    }
                })
                .cloned()
                .collect()
        } else {
            // cwd is outside vault — match by basename of cwd
            let basename = Path::new(cwd)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or(cwd)
                .to_lowercase();

            self.entities
                .values()
                .filter(|e| {
                    // Check source_notes filenames
                    let note_match = e.source_notes.iter().any(|note| {
                        Path::new(note)
                            .file_name()
                            .and_then(|s| s.to_str())
                            .map(|f| f.to_lowercase().contains(&basename))
                            .unwrap_or(false)
                    });
                    note_match
                        || e.name.to_lowercase().contains(&basename)
                        || e.description.to_lowercase().contains(&basename)
                })
                .cloned()
                .collect()
        };

        // Sort by source_notes length descending, then cap
        matched.sort_by(|a, b| b.source_notes.len().cmp(&a.source_notes.len()));
        matched.truncate(max_entities);

        // Collect matched entity names into a set for relation filtering
        let matched_names: HashSet<String> = matched.iter().map(|e| e.name.clone()).collect();

        let relations = self
            .relations
            .iter()
            .filter(|r| matched_names.contains(&r.source) && matched_names.contains(&r.target))
            .cloned()
            .collect();

        KgGraphData {
            entities: matched,
            relations,
        }
    }
}

pub fn render_context_markdown(data: &KgGraphData) -> String {
    if data.entities.is_empty() {
        return String::new();
    }

    let mut out = String::from("## Cortex Knowledge Graph — relevant context\n\n### Entities\n");
    for entity in &data.entities {
        let note_count = entity.source_notes.len();
        out.push_str(&format!(
            "- **{}** ({:?}): {} (mentioned in {} note{})\n",
            entity.name,
            entity.entity_type,
            entity.description,
            note_count,
            if note_count == 1 { "" } else { "s" }
        ));
    }

    if !data.relations.is_empty() {
        out.push_str("\n### Relations\n");
        for rel in &data.relations {
            out.push_str(&format!(
                "- ({}) --[{}]--> ({})\n",
                rel.source, rel.predicate, rel.target
            ));
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{EntityType, KgEntity, KgRelation};

    fn make_entity(name: &str, source_notes: Vec<&str>, description: &str) -> KgEntity {
        KgEntity {
            name: name.to_string(),
            entity_type: EntityType::Concept,
            description: description.to_string(),
            source_notes: source_notes.into_iter().map(|s| s.to_string()).collect(),
            aliases: vec![],
        }
    }

    fn make_relation(source: &str, predicate: &str, target: &str) -> KgRelation {
        KgRelation {
            source: source.to_string(),
            predicate: predicate.to_string(),
            target: target.to_string(),
            source_note: "test.md".to_string(),
        }
    }

    fn build_graph() -> TypedKnowledgeGraph {
        let mut graph = TypedKnowledgeGraph::new();
        graph.store_entities(
            "projects/cortex/overview.md",
            vec![make_entity("Cortex", vec!["projects/cortex/overview.md"], "A PKM app")],
        );
        graph.store_entities(
            "projects/cortex/design.md",
            vec![make_entity("Cortex", vec!["projects/cortex/design.md"], "A PKM app with design")],
        );
        graph.store_entities(
            "people/alice.md",
            vec![make_entity("Alice", vec!["people/alice.md"], "A developer")],
        );
        graph.store_entities(
            "misc/random.md",
            vec![make_entity("Random", vec!["misc/random.md"], "Some random concept")],
        );
        graph.store_relations(
            "projects/cortex/overview.md",
            vec![make_relation("Cortex", "created-by", "Alice")],
        );
        graph
    }

    #[test]
    fn test_vault_prefix_match() {
        let graph = build_graph();
        let vault = "/vault";
        // Entities in "projects/cortex/" should match; "people/alice.md" should not
        let result = graph.nearby_for_cwd("/vault/projects/cortex", vault, 100);
        let names: Vec<&str> = result.entities.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"Cortex"), "Cortex entity expected for projects/cortex cwd");
        assert!(!names.contains(&"Alice"), "Alice not expected for projects/cortex cwd");
    }

    #[test]
    fn test_vault_root_returns_all() {
        let graph = build_graph();
        let vault = "/vault";
        // cwd == vault_root: all entities should be returned (up to cap)
        let result = graph.nearby_for_cwd("/vault", vault, 100);
        assert_eq!(result.entities.len(), 3, "All 3 unique entities expected when cwd == vault_root");
    }

    #[test]
    fn test_basename_fallback_outside_vault() {
        let graph = build_graph();
        let vault = "/vault";
        // cwd is outside vault, basename is "cortex" — should match Cortex entity
        let result = graph.nearby_for_cwd("/home/user/projects/cortex", vault, 100);
        let names: Vec<&str> = result.entities.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"Cortex"), "Cortex expected via basename match");
    }

    #[test]
    fn test_max_entities_cap() {
        let graph = build_graph();
        let vault = "/vault";
        // cap to 1; should return exactly 1 entity
        let result = graph.nearby_for_cwd("/vault", vault, 1);
        assert_eq!(result.entities.len(), 1, "max_entities cap of 1 should be respected");
    }

    #[test]
    fn test_empty_graph() {
        let graph = TypedKnowledgeGraph::new();
        let result = graph.nearby_for_cwd("/vault/projects/foo", "/vault", 100);
        assert!(result.entities.is_empty(), "Empty graph should return no entities");
        assert!(result.relations.is_empty(), "Empty graph should return no relations");
    }

    #[test]
    fn test_relations_filtered_to_matched_entities() {
        let graph = build_graph();
        let vault = "/vault";
        // Only projects/cortex matches — Cortex is in matched, Alice is not
        let result = graph.nearby_for_cwd("/vault/projects/cortex", vault, 100);
        // The relation Cortex->Alice should NOT appear since Alice is not matched
        for rel in &result.relations {
            assert!(
                result.entities.iter().any(|e| e.name == rel.source),
                "relation source must be in matched entities"
            );
            assert!(
                result.entities.iter().any(|e| e.name == rel.target),
                "relation target must be in matched entities"
            );
        }
    }

    #[test]
    fn test_render_context_markdown_empty() {
        let data = KgGraphData { entities: vec![], relations: vec![] };
        assert_eq!(render_context_markdown(&data), String::new());
    }

    #[test]
    fn test_render_context_markdown_output() {
        let data = KgGraphData {
            entities: vec![make_entity("Cortex", vec!["notes/cortex.md"], "A PKM app")],
            relations: vec![make_relation("Cortex", "uses", "Rust")],
        };
        let md = render_context_markdown(&data);
        assert!(md.contains("## Cortex Knowledge Graph"), "should have header");
        assert!(md.contains("**Cortex**"), "should have entity name bolded");
        assert!(md.contains("(Concept)"), "should have entity type");
        assert!(md.contains("--[uses]-->"), "should have relation");
    }
}
