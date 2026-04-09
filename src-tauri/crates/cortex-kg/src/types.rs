use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, specta::Type)]
pub enum EntityType {
    Person,
    Project,
    Technology,
    Decision,
    Pattern,
    Organization,
    Concept,
}

impl std::fmt::Display for EntityType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EntityType::Person => write!(f, "Person"),
            EntityType::Project => write!(f, "Project"),
            EntityType::Technology => write!(f, "Technology"),
            EntityType::Decision => write!(f, "Decision"),
            EntityType::Pattern => write!(f, "Pattern"),
            EntityType::Organization => write!(f, "Organization"),
            EntityType::Concept => write!(f, "Concept"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct KgEntity {
    pub name: String,
    pub entity_type: EntityType,
    pub description: String,
    pub source_notes: Vec<String>,
    pub aliases: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct KgRelation {
    pub source: String,
    pub predicate: String,
    pub target: String,
    pub source_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct KgEntityProfile {
    pub entity: KgEntity,
    pub relations_out: Vec<KgRelation>,
    pub relations_in: Vec<KgRelation>,
    pub mention_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct KgGraphData {
    pub entities: Vec<KgEntity>,
    pub relations: Vec<KgRelation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct KgStats {
    pub entity_count: u32,
    pub relation_count: u32,
    pub processed_count: u32,
    pub unprocessed_count: u32,
}

// Input types for MCP store operations (what Claude Code sends)

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct StoreEntitiesInput {
    pub note_path: String,
    pub entities: Vec<KgEntity>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct StoreRelationsInput {
    pub note_path: String,
    pub relations: Vec<KgRelation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct ResolveEntityInput {
    pub canonical: String,
    pub aliases: Vec<String>,
}
