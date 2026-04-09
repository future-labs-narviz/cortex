export interface NoteFile {
  id: string;
  name: string;
  path: string;
  extension: string;
  modified: number;
  created: number;
  size: number;
}

export interface VaultFile {
  path: string;
  name: string;
  is_dir: boolean;
  modified: number;
  children?: VaultFile[];
}

export interface NoteData {
  content: string;
  frontmatter?: Record<string, unknown>;
}

export interface VaultConfig {
  name: string;
  path: string;
  lastOpened: number;
}

export interface EditorTab {
  id: string;        // file path
  title: string;     // filename without extension
  filePath: string;
  fileName: string;
  content: string;   // current content
  savedContent: string; // last saved content (for dirty detection)
  isDirty: boolean;
}

export type SidebarPanel = "files" | "search" | "graph" | "tags" | "backlinks" | "timeline" | "calendar" | "voice" | "integrations" | "sessions";

export type Theme = "dark" | "light";

export interface McpStatus {
  connected: boolean;
  serverName: string | null;
  lastCheck: number;
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

export interface TemplateInfo {
  name: string;
  preview: string;
}

export type ButtonVariant = "primary" | "secondary" | "ghost" | "glass" | "destructive";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

// Context Capture types

export interface CapturedSession {
  session_id: string;
  project: string | null;
  started_at: string | null;
  ended_at: string | null;
  summary: string | null;
  goal: string | null;
  files_modified: string[];
  tools_used: string[];
  prompts_count: number;
  key_decisions: string[];
  what_worked: string | null;
  what_failed: string | null;
}

export interface CapturedInsight {
  id: string;
  content: string;
  tags: string[];
  source: string;
  created_at: string;
}

export interface ToolUseEntry {
  tool: string;
  file: string | null;
  description: string | null;
  at: string;
}

export interface SessionDetail extends CapturedSession {
  cwd: string | null;
  tool_uses: ToolUseEntry[];
  insights: string[];
}

// Voice types

export interface VoiceModel {
  id: string;
  name: string;
  size: string;
  accuracy: string;
  speed: string;
  languages: string;
}

export interface AudioDevice {
  name: string;
  id: string;
}

export interface VoiceNoteMetadata {
  type: "voice-note";
  created: string;
  duration: string;
  audio: string;
  tags: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  weight: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Knowledge Graph types

export type EntityType = "Person" | "Project" | "Technology" | "Decision" | "Pattern" | "Organization" | "Concept";

export interface KgEntity {
  name: string;
  entity_type: EntityType;
  description: string;
  source_notes: string[];
  aliases: string[];
}

export interface KgRelation {
  source: string;
  predicate: string;
  target: string;
  source_note: string;
}

export interface KgEntityProfile {
  entity: KgEntity;
  relations_out: KgRelation[];
  relations_in: KgRelation[];
  mention_count: number;
}

export interface KgGraphData {
  entities: KgEntity[];
  relations: KgRelation[];
}

export interface KgStats {
  entity_count: number;
  relation_count: number;
  processed_count: number;
  unprocessed_count: number;
}

export type GraphLayer = "wikilinks" | "typed" | "both";
