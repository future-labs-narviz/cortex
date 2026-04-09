---
name: cortex
description: Search, capture, and query your Cortex knowledge graph during development sessions. Use when you need context from past work, want to capture insights, or need to find related notes.
aliases: [cx, knowledge, notes]
whenToUse: When the user asks about past decisions, needs context from their knowledge base, wants to capture an insight or decision, or references their notes/vault.
userInvocable: true
argumentHint: "<search|capture|why|related|gaps|extract|query|profile> [query]"
---

# Cortex Knowledge Integration

You have access to the user's Cortex knowledge graph via MCP tools. Use these tools to help the user leverage their accumulated knowledge during development.

## Available Actions

### Search: `/cortex search <query>`
Search the knowledge graph for relevant notes, voice transcriptions, and captured sessions.
Use the `cortex/search` MCP tool.

### Capture: `/cortex capture`
Capture the current context, insight, or decision to the knowledge graph.
Ask the user what they'd like to capture, then use the `cortex/capture` MCP tool with appropriate tags.

### Why: `/cortex why <topic>`
Explain why something was built a certain way by searching for decision records and session captures.
Use `cortex/search` with the topic, then `cortex/get-context` for deeper context.

### Related: `/cortex related <file-or-topic>`
Find notes related to a specific file or topic.
Use the `cortex/list-related` MCP tool.

### Gaps: `/cortex gaps`
Identify knowledge gaps - topics that have been worked on but not documented.
Use `cortex/list-tags` to see what's documented, compare with recent git activity.

### Extract: `/cortex extract`
Build the typed knowledge graph by extracting entities and relations from vault notes.

Steps:
1. Call `cortex/get-unprocessed-notes` to find notes needing extraction
2. For each note (batch up to 10 at a time):
   a. Call `cortex/get-note` to read its content
   b. Extract entities: identify Person, Project, Technology, Decision, Pattern, Organization, Concept entities central to the note
   c. Extract relations: identify how entities connect using short verb predicates
   d. Call `cortex/store-entities` with the extracted entities for that note
   e. Call `cortex/store-relations` with the extracted relations for that note
3. After all notes processed, look for duplicate entities that should be merged:
   - Same concept with different surface forms (e.g., "JWT tokens" and "JSON Web Tokens" → "JWT")
   - Call `cortex/resolve-entity` for each merge
4. Report: "Extracted X entities and Y relations from Z notes"

Entity extraction guidelines:
- Entity types: Person, Project, Technology, Decision, Pattern, Organization, Concept
- Only extract entities CENTRAL to the note — skip incidental mentions
- Write a one-sentence description grounded in the note for each entity
- Predicates: short verb phrases ("decided", "built_with", "depends_on", "supersedes", "extracted_from", "caused", "led_to", "part_of", "used_by")
- Every relation must connect two entities from the same note
- For Decision entities, include what was decided and why
- For Pattern entities, include when to use and when not to use

### Query: `/cortex query <question>`
Ask a multi-hop question over the knowledge graph.

Steps:
1. Call `cortex/query-graph` with the topic to get the relevant subgraph as triples
2. Reason over the returned triples to answer the user's question
3. Cite specific triples and source notes in your answer

### Profile: `/cortex profile <entity>`
Get a detailed profile of an entity.

Steps:
1. Call `cortex/entity-profile` with the entity name
2. Present the entity's type, description, relations, and source notes

## Behavior Guidelines

1. When the user starts a new feature, proactively check if Cortex has relevant context using `cortex/get-context`
2. After completing a significant task, suggest capturing the key decisions and what worked/failed
3. When debugging, search for similar past issues in the knowledge graph
4. Format captured insights with clear tags for easy retrieval later
5. Always cite the source note path when referencing knowledge from Cortex
