# Audio_Transcription Frontend (React + TypeScript + Vite + Tailwind CSS)

A modern Microsoft Word-inspired document editor featuring real-time speech dictation, rich-text formatting ribbon, and persistent document storage.

## Key Features

- **Microsoft Word Ribbon Interface**: Home, Insert, Layout, Review, and View tabs styled authentically.
- **Dictate / Voice Typing (Centerpiece)**:
  - Real-time continuous speech dictation using Web Speech API or Python Flask backend.
  - Spoken punctuation parsing (period, full stop, comma, question mark, new line, etc.).
  - Live microphone volume waveform visualizer.
  - Multi-language support: English (US & India), Tamil (India), Hindi (India), Spanish, French, and German.
- **Audio File Transcription**: Upload pre-recorded audio (.wav, .mp3, .m4a, .webm) to transcribe via the Flask backend.
- **Document Management**: Auto-saving to persistent SQLite database, document renaming, and library management.
- **Rich-Text Canvas**: Tables, Images, Links, Quotes, Headings, and Print Layout margins.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Set the backend API URL (defaults to `http://localhost:5000` or proxied through Vite):
```env
VITE_API_BASE_URL=http://localhost:5000
```

### 3. Run Development Server
```bash
npm run dev
```

The application will start at `http://localhost:3000`.

### 4. Build for Production
```bash
npm run build
```
