# Voice Clone

Local Gradio app for:

- voice cloning with Qwen3-TTS
- speech-to-text transcription with `faster-whisper`
- saving reusable voice profiles
- converting uploaded audio or video into editable text before synthesis

## Features

- Upload or record a reference voice clip
- Auto-transcribe the reference clip
- Save voice profiles as `.wav` + `.txt`
- Generate new speech using the saved voice style
- Upload audio or video and transcribe it into readable text
- Copy transcript text into:
  - the reference transcript field
  - the target text field
- Automatically falls back to the next free local port if `7860` is busy
- Loads heavy models on demand so only one large model stays in memory at a time

## Tech Stack

- Python
- Gradio
- Qwen3-TTS
- faster-whisper
- PyTorch
- soundfile

## Project Structure

```text
Voice-Clone/
├── app.py
├── requirements.txt
├── README.md
├── plan.md
├── prd.md
├── cloudflare_setup.md
└── saved_voices/
    ├── *.wav
    └── *.txt
```

## Requirements

- Python 3.9+ recommended
- Apple Silicon Mac, CPU, or CUDA GPU
- Internet access on first model download

Notes:

- Qwen3-TTS runs on `mps` on Apple Silicon when available
- `faster-whisper` currently runs on CPU fallback in this app on macOS
- first use of a selected Whisper model size downloads model files from Hugging Face

## Installation

Create and activate a virtual environment, then install dependencies:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run

Start the app with:

```bash
./venv/bin/python app.py
```

The app will print something like:

```bash
Starting Gradio Web Server on http://127.0.0.1:7860
```

If `7860` is already in use, it will automatically try `7861`, `7862`, and so on.

## How To Use

### 1. Create or load a voice profile
- Upload or record a reference audio clip
- Type the exact transcript, or click `Transcribe Reference`
- Enter a profile name
- Click `Save Voice Profile`

### 2. Generate new speech
- Enter text in `Target Text to Synthesize`
- Click `Generate`

### 3. Transcribe source media
- Upload an audio or video file
- Choose an ASR model size
- Click `Transcribe Media`
- Copy the transcript into the reference transcript or target text box if needed

## Saved Voice Profiles

Each saved voice profile uses:

- `saved_voices/<name>.wav`
- `saved_voices/<name>.txt`

The `.wav` file stores the reference audio.
The `.txt` file stores the matching transcript.

## ASR Model Sizes

Available transcription sizes:

- `tiny`
- `base`
- `small`
- `medium`
- `large-v3`
- `turbo`

Recommendation:

- use `base` or `tiny` on a Mac if memory pressure is high
- use larger models only if you need better transcription quality and your machine can handle it

## Memory Behavior

This app is optimized to reduce system freezing:

- Qwen TTS is not loaded at startup
- Whisper is not kept in memory after transcription
- the app unloads the ASR model before loading TTS
- the app unloads the TTS model before loading ASR

This is important on Apple Silicon because both models can otherwise consume large amounts of unified memory.

## Transcript Formatting

Transcription output is cleaned for readability:

- repeated whitespace is normalized
- a new line is inserted after sentence-ending punctuation

## Troubleshooting

### Port already in use
No action is usually needed. The app automatically picks the next free port.

### Mac becomes slow or hangs
- use ASR model `tiny` or `base`
- transcribe shorter clips
- close other heavy apps
- avoid repeated large transcription + generation jobs without a pause

### First transcription is slow
This is normal if the Whisper model is being downloaded for the first time.

### Reference transcript quality affects voice cloning
For best results, make sure the reference transcript exactly matches what is spoken in the reference audio.

## Notes

- Generated audio currently plays in the UI as WAV-style audio output
- transcript text remains editable before synthesis
- `plan.md` contains the broader roadmap for future improvements

## Future Improvements

- MP3 export
- transcript `.txt` export
- subtitle export
- optional low-memory mode toggle
- backend swap support for Qwen ASR
