use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use anyhow::Result;
use tokio::sync::broadcast;

use crate::audio::{save_wav_file, AudioRecorder};
use crate::config::VoiceConfig;
use crate::events::VoiceEvent;

/// The main voice pipeline that ties recording, VAD, and transcription together.
pub struct VoicePipeline {
    _config: VoiceConfig,
    event_tx: broadcast::Sender<VoiceEvent>,
    is_recording: Arc<AtomicBool>,
    recorder: Option<AudioRecorder>,
    recording_start: Option<Instant>,
}

impl VoicePipeline {
    /// Create a new VoicePipeline with the given configuration.
    pub fn new(config: VoiceConfig) -> Self {
        let (event_tx, _) = broadcast::channel(64);
        Self {
            _config: config,
            event_tx,
            is_recording: Arc::new(AtomicBool::new(false)),
            recorder: None,
            recording_start: None,
        }
    }

    /// Subscribe to voice events from this pipeline.
    pub fn subscribe(&self) -> broadcast::Receiver<VoiceEvent> {
        self.event_tx.subscribe()
    }

    /// Start recording audio from the default input device.
    pub fn start_recording(&mut self) -> Result<()> {
        if self.is_recording.load(Ordering::Relaxed) {
            anyhow::bail!("Already recording");
        }

        let event_tx = self.event_tx.clone();
        let recorder = AudioRecorder::new()
            .map_err(|e| anyhow::anyhow!("Failed to create audio recorder: {e}"))?;

        let level_tx = self.event_tx.clone();
        let recorder = recorder.with_level_callback(move |levels| {
            let _ = level_tx.send(VoiceEvent::AudioLevel(levels));
        });

        let mut recorder = recorder;
        recorder
            .open(None)
            .map_err(|e| anyhow::anyhow!("Failed to open audio device: {e}"))?;

        recorder
            .start()
            .map_err(|e| anyhow::anyhow!("Failed to start recording: {e}"))?;

        self.is_recording.store(true, Ordering::Relaxed);
        self.recording_start = Some(Instant::now());
        self.recorder = Some(recorder);

        let _ = event_tx.send(VoiceEvent::RecordingStarted);
        log::info!("Voice pipeline: recording started");

        Ok(())
    }

    /// Stop recording and return the captured audio samples.
    pub fn stop_recording(&mut self) -> Result<Vec<f32>> {
        if !self.is_recording.load(Ordering::Relaxed) {
            anyhow::bail!("Not currently recording");
        }

        let samples = if let Some(ref recorder) = self.recorder {
            recorder
                .stop()
                .map_err(|e| anyhow::anyhow!("Failed to stop recording: {e}"))?
        } else {
            vec![]
        };

        let duration_ms = self
            .recording_start
            .map(|s| s.elapsed().as_millis() as u64)
            .unwrap_or(0);

        self.is_recording.store(false, Ordering::Relaxed);
        self.recording_start = None;

        let _ = self
            .event_tx
            .send(VoiceEvent::RecordingStopped { duration_ms });

        log::info!(
            "Voice pipeline: recording stopped, {} samples, {}ms",
            samples.len(),
            duration_ms
        );

        Ok(samples)
    }

    /// Cancel the current recording without returning audio.
    pub fn cancel_recording(&mut self) -> Result<()> {
        if !self.is_recording.load(Ordering::Relaxed) {
            return Ok(()); // nothing to cancel
        }

        if let Some(ref recorder) = self.recorder {
            let _ = recorder.stop(); // discard samples
        }

        self.is_recording.store(false, Ordering::Relaxed);
        self.recording_start = None;

        let _ = self
            .event_tx
            .send(VoiceEvent::RecordingStopped { duration_ms: 0 });

        log::info!("Voice pipeline: recording cancelled");
        Ok(())
    }

    /// Transcribe audio samples.
    ///
    /// This is currently a stub. Full transcription support (Whisper/Parakeet)
    /// will be added in a future wave once the transcribe-rs dependency and
    /// GPU backend selection are integrated.
    pub fn transcribe(&self, _audio: &[f32]) -> Result<String> {
        let _ = self.event_tx.send(VoiceEvent::TranscriptionStarted);

        let text =
            "Transcription not yet implemented - model loading coming in a future wave".to_string();

        let _ = self
            .event_tx
            .send(VoiceEvent::TranscriptionComplete { text: text.clone() });

        Ok(text)
    }

    /// Save audio samples to a WAV file and return the path.
    pub fn save_recording(
        &self,
        samples: &[f32],
        output_path: &std::path::Path,
    ) -> Result<()> {
        save_wav_file(output_path, samples)?;
        Ok(())
    }

    /// Check if the pipeline is currently recording.
    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::Relaxed)
    }

    /// Close the recorder and release resources.
    pub fn close(&mut self) -> Result<()> {
        if let Some(ref mut recorder) = self.recorder {
            recorder
                .close()
                .map_err(|e| anyhow::anyhow!("Failed to close recorder: {e}"))?;
        }
        self.recorder = None;
        Ok(())
    }
}

impl Drop for VoicePipeline {
    fn drop(&mut self) {
        let _ = self.close();
    }
}
