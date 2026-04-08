use std::path::PathBuf;

pub struct VoiceConfig {
    pub models_dir: PathBuf,
    pub vad_model_path: PathBuf,
    pub vad_threshold: f32,
    pub selected_model: Option<String>,
    pub selected_language: String,
    pub translate_to_english: bool,
    pub custom_words: Vec<String>,
}

impl Default for VoiceConfig {
    fn default() -> Self {
        Self {
            models_dir: PathBuf::from("models"),
            vad_model_path: PathBuf::from("models/silero_vad_v4.onnx"),
            vad_threshold: 0.3,
            selected_model: None,
            selected_language: "auto".to_string(),
            translate_to_english: false,
            custom_words: vec![],
        }
    }
}
