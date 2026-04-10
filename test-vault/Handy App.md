---
title: Handy App
tags: [reference, handy, voice, speech-to-text]
created: 2026-04-06
---

# Handy App

Open-source offline speech-to-text desktop app. Source at ~/Desktop/Handy.

## What We Extracted
- Audio recorder (cpal-based) → `cortex-voice/src/audio/recorder.rs`
- Frame resampler (rubato) → `cortex-voice/src/audio/resampler.rs`
- Silero VAD → `cortex-voice/src/vad/silero.rs`
- Smoothed VAD → `cortex-voice/src/vad/smoothed.rs`
- Audio visualizer → `cortex-voice/src/audio/visualizer.rs`

## What We Couldn't Extract
- Hotkey system (different app, different shortcuts)
- Settings schema (Handy-specific)
- Model hosting URLs (points to blob.handy.computer)
- Clipboard/paste pipeline

## Key Stats
- 48 Rust files, ~9K lines
- 121 TS/TSX files, ~4.5K lines
- 15+ ML models (Whisper, Parakeet, Moonshine, etc.)
- 21 UI languages

See [[Architecture Overview]] for how cortex-voice fits in.

#reference #handy #voice
