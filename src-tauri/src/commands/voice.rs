//! Voice recording Tauri commands.

use crate::state::AppState;
use cortex_voice::audio::list_input_devices;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct AudioDeviceInfo {
    pub name: String,
    pub is_default: bool,
}

/// Start recording audio via the voice pipeline.
#[tauri::command]
#[specta::specta]
pub async fn voice_start_recording(
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let mut pipeline_guard = state
        .voice_pipeline
        .lock()
        .map_err(|e| format!("Failed to lock voice pipeline: {e}"))?;

    let pipeline = pipeline_guard.get_or_insert_with(|| {
        cortex_voice::VoicePipeline::new(cortex_voice::VoiceConfig::default())
    });

    pipeline.start_recording().map_err(|e| e.to_string())
}

/// Stop recording and return the path to the saved WAV file.
#[tauri::command]
#[specta::specta]
pub async fn voice_stop_recording(
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let mut pipeline_guard = state
        .voice_pipeline
        .lock()
        .map_err(|e| format!("Failed to lock voice pipeline: {e}"))?;

    let pipeline = pipeline_guard
        .as_mut()
        .ok_or_else(|| "Voice pipeline not initialized".to_string())?;

    let samples = pipeline.stop_recording().map_err(|e| e.to_string())?;

    // Save to a temporary WAV file
    let tmp_dir = std::env::temp_dir().join("cortex-voice");
    std::fs::create_dir_all(&tmp_dir)
        .map_err(|e| format!("Failed to create temp dir: {e}"))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let wav_path = tmp_dir.join(format!("recording_{timestamp}.wav"));

    pipeline
        .save_recording(&samples, &wav_path)
        .map_err(|e| e.to_string())?;

    Ok(wav_path.to_string_lossy().to_string())
}

/// Cancel the current recording without saving.
#[tauri::command]
#[specta::specta]
pub async fn voice_cancel_recording(
    state: State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let mut pipeline_guard = state
        .voice_pipeline
        .lock()
        .map_err(|e| format!("Failed to lock voice pipeline: {e}"))?;

    if let Some(pipeline) = pipeline_guard.as_mut() {
        pipeline.cancel_recording().map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// List available audio input devices.
#[tauri::command]
#[specta::specta]
pub async fn voice_get_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    let devices = list_input_devices().map_err(|e| e.to_string())?;

    Ok(devices
        .into_iter()
        .map(|d| AudioDeviceInfo {
            name: d.name,
            is_default: d.is_default,
        })
        .collect())
}

/// Check if the voice pipeline is currently recording.
#[tauri::command]
#[specta::specta]
pub async fn voice_is_recording(
    state: State<'_, Arc<AppState>>,
) -> Result<bool, String> {
    let pipeline_guard = state
        .voice_pipeline
        .lock()
        .map_err(|e| format!("Failed to lock voice pipeline: {e}"))?;

    Ok(pipeline_guard
        .as_ref()
        .map(|p| p.is_recording())
        .unwrap_or(false))
}
