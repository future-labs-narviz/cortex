//! Daily notes and template Tauri commands.

use crate::state::AppState;
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

/// Metadata about a template file.
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct TemplateInfo {
    pub name: String,
    pub preview: String,
}

/// Default template files to create when the templates directory is first initialized.
const DEFAULT_TEMPLATES: &[(&str, &str)] = &[
    (
        "Note.md",
        "---\ntitle: {{title}}\ncreated: {{datetime}}\ntags: []\n---\n\n# {{title}}\n",
    ),
    (
        "Meeting.md",
        "---\ntitle: \"Meeting: {{title}}\"\ndate: {{date}}\ntype: meeting\ntags: [meeting]\n---\n\n# Meeting: {{title}}\n\n**Date:** {{date}}\n**Attendees:** \n\n## Agenda\n\n\n## Notes\n\n\n## Action Items\n- [ ] \n",
    ),
    (
        "Decision.md",
        "---\ntitle: \"Decision: {{title}}\"\ndate: {{date}}\ntype: decision\ntags: [decision]\n---\n\n# Decision: {{title}}\n\n## Context\nWhat is the issue we're deciding on?\n\n## Options Considered\n1. \n2. \n3. \n\n## Decision\nWhat did we decide and why?\n\n## Consequences\nWhat are the implications?\n",
    ),
];

/// Ensure the `.cortex/templates/` directory exists and has default templates.
fn ensure_templates(vault_root: &std::path::Path) -> Result<(), String> {
    let templates_dir = vault_root.join(".cortex").join("templates");
    std::fs::create_dir_all(&templates_dir).map_err(|e| e.to_string())?;

    // Only seed defaults if the directory is empty.
    let is_empty = std::fs::read_dir(&templates_dir)
        .map_err(|e| e.to_string())?
        .next()
        .is_none();

    if is_empty {
        for (name, content) in DEFAULT_TEMPLATES {
            let path = templates_dir.join(name);
            std::fs::write(&path, content).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

/// Create or open today's daily note. Returns the relative path inside the vault.
#[tauri::command]
#[specta::specta]
pub async fn create_daily_note(state: State<'_, Arc<AppState>>) -> Result<String, String> {
    let vault_guard = state.vault.lock().map_err(|e| e.to_string())?;
    let vault = vault_guard
        .as_ref()
        .ok_or_else(|| "No vault is currently open".to_string())?;
    let vault_root = vault.root().to_path_buf();

    // Ensure templates are seeded.
    ensure_templates(&vault_root)?;

    let today = Local::now();
    let date_str = today.format("%Y-%m-%d").to_string();
    let relative_path = format!("daily/{}.md", date_str);
    let full_path = vault_root.join(&relative_path);

    if full_path.exists() {
        return Ok(relative_path);
    }

    // Create the daily directory.
    std::fs::create_dir_all(vault_root.join("daily")).map_err(|e| e.to_string())?;

    let human_date = today.format("%B %-d, %Y").to_string();
    let content = format!(
        "---\ntype: daily\ndate: {}\ntags: [daily]\n---\n\n# {}\n\n## Tasks\n- [ ] \n\n## Notes\n\n\n## Reflections\n\n",
        date_str, human_date
    );

    vault
        .write_note(&relative_path, &content)
        .map_err(|e| e.to_string())?;

    Ok(relative_path)
}

/// List all templates from `.cortex/templates/`.
#[tauri::command]
#[specta::specta]
pub async fn list_templates(state: State<'_, Arc<AppState>>) -> Result<Vec<TemplateInfo>, String> {
    let vault_guard = state.vault.lock().map_err(|e| e.to_string())?;
    let vault = vault_guard
        .as_ref()
        .ok_or_else(|| "No vault is currently open".to_string())?;
    let vault_root = vault.root().to_path_buf();

    ensure_templates(&vault_root)?;

    let templates_dir = vault_root.join(".cortex").join("templates");
    let mut templates = Vec::new();

    if templates_dir.exists() {
        for entry in std::fs::read_dir(&templates_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "md") {
                let name = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
                let preview: String = content.chars().take(100).collect();
                templates.push(TemplateInfo { name, preview });
            }
        }
    }

    templates.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(templates)
}

/// Create a new note from a named template. Returns the relative path of the created note.
#[tauri::command]
#[specta::specta]
pub async fn create_from_template(
    template_name: String,
    title: String,
    folder: Option<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let vault_guard = state.vault.lock().map_err(|e| e.to_string())?;
    let vault = vault_guard
        .as_ref()
        .ok_or_else(|| "No vault is currently open".to_string())?;
    let vault_root = vault.root().to_path_buf();

    let template_path = vault_root
        .join(".cortex")
        .join("templates")
        .join(format!("{}.md", template_name));

    if !template_path.exists() {
        return Err(format!("Template not found: {}", template_name));
    }

    let template_content =
        std::fs::read_to_string(&template_path).map_err(|e| e.to_string())?;

    let now = Local::now();
    let content = template_content
        .replace("{{title}}", &title)
        .replace("{{date}}", &now.format("%Y-%m-%d").to_string())
        .replace("{{time}}", &now.format("%H:%M:%S").to_string())
        .replace("{{datetime}}", &now.format("%Y-%m-%dT%H:%M:%S").to_string());

    // Build relative path.
    let safe_title: String = title
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let filename = format!("{}.md", safe_title.trim());

    let relative_path = match folder {
        Some(ref f) => {
            let folder_path = vault_root.join(f);
            std::fs::create_dir_all(&folder_path).map_err(|e| e.to_string())?;
            format!("{}/{}", f, filename)
        }
        None => filename,
    };

    let full_path = vault_root.join(&relative_path);
    if full_path.exists() {
        return Err(format!("Note already exists: {}", relative_path));
    }

    vault
        .write_note(&relative_path, &content)
        .map_err(|e| e.to_string())?;

    Ok(relative_path)
}
