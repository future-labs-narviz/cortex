#[derive(Debug, Clone)]
pub enum VoiceEvent {
    RecordingStarted,
    RecordingStopped { duration_ms: u64 },
    AudioLevel(Vec<f32>),
    TranscriptionStarted,
    TranscriptionComplete { text: String },
    TranscriptionError(String),
    ModelLoading { model_id: String },
    ModelLoaded { model_id: String },
    ModelUnloaded,
    DownloadProgress { model_id: String, percentage: f64, speed_mbps: f64 },
    DownloadComplete { model_id: String },
}
