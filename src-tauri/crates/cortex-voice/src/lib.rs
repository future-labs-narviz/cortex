//! Cortex Voice - Voice-to-text engine extracted from Handy.
//!
//! Provides audio recording, VAD (voice activity detection), resampling,
//! and a pipeline that ties them together. Transcription is currently
//! stubbed and will be implemented in a future wave.

pub mod audio;
pub mod config;
pub mod constants;
pub mod events;
pub mod pipeline;
pub mod vad;

pub use audio::{
    is_microphone_access_denied, is_no_input_device_error, list_input_devices, list_output_devices,
    read_wav_samples, save_wav_file, AudioRecorder, CpalDeviceInfo,
};
pub use config::VoiceConfig;
pub use events::VoiceEvent;
pub use pipeline::VoicePipeline;
pub use vad::{SileroVad, SmoothedVad, VoiceActivityDetector};

/// Returns the appropriate CPAL host for the current platform.
/// On Linux, uses ALSA host. On other platforms, uses the default host.
pub fn get_cpal_host() -> cpal::Host {
    #[cfg(target_os = "linux")]
    {
        cpal::host_from_id(cpal::HostId::Alsa).unwrap_or_else(|_| cpal::default_host())
    }
    #[cfg(not(target_os = "linux"))]
    {
        cpal::default_host()
    }
}

/// Initialize the cortex-voice crate.
pub fn init() {
    log::info!("cortex-voice initialized");
}
