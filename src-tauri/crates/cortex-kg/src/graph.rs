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
}
