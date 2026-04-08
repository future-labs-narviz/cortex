use anyhow::Result;
use std::path::Path;

use super::{VadFrame, VoiceActivityDetector};
use crate::constants;

const SILERO_FRAME_MS: u32 = 30;
const SILERO_FRAME_SAMPLES: usize =
    (constants::WHISPER_SAMPLE_RATE * SILERO_FRAME_MS / 1000) as usize;

/// Stub implementation of Silero VAD.
///
/// The real implementation requires vad-rs + ONNX Runtime. This stub treats all
/// audio as speech so the pipeline still works end-to-end without the heavy
/// native dependency.
pub struct SileroVad {
    threshold: f32,
}

impl SileroVad {
    pub fn new<P: AsRef<Path>>(_model_path: P, threshold: f32) -> Result<Self> {
        if !(0.0..=1.0).contains(&threshold) {
            anyhow::bail!("threshold must be between 0.0 and 1.0");
        }

        log::warn!("SileroVad: using stub implementation -- all audio treated as speech");

        Ok(Self { threshold })
    }

    /// Returns the configured threshold.
    pub fn threshold(&self) -> f32 {
        self.threshold
    }
}

impl VoiceActivityDetector for SileroVad {
    fn push_frame<'a>(&'a mut self, frame: &'a [f32]) -> Result<VadFrame<'a>> {
        if frame.len() != SILERO_FRAME_SAMPLES {
            anyhow::bail!(
                "expected {SILERO_FRAME_SAMPLES} samples, got {}",
                frame.len()
            );
        }

        // Stub: treat everything as speech
        Ok(VadFrame::Speech(frame))
    }
}
