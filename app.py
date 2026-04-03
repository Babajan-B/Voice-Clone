import gradio as gr
import torch
import soundfile as sf
import numpy as np
import os
import re
import socket
import tempfile
import shutil
import gc
from qwen_tts import Qwen3TTSModel

try:
    from faster_whisper import WhisperModel
    FASTER_WHISPER_IMPORT_ERROR = None
except Exception as e:
    WhisperModel = None
    FASTER_WHISPER_IMPORT_ERROR = e

# Detect device
if torch.cuda.is_available():
    device = "cuda:0"
elif torch.backends.mps.is_available():
    device = "mps"
else:
    device = "cpu"

print(f"Using device: {device}")

MODEL_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
SAVED_VOICES_DIR = os.path.abspath("saved_voices")
ASR_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
model = None
ASR_MODEL = None
ASR_MODEL_CONFIG = None
ASR_MODEL_CHOICES = ["tiny", "base", "small", "medium", "large-v3", "turbo"]
ASR_LANGUAGE_CHOICES = ["Auto", "en", "ar", "de", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh"]

os.makedirs(SAVED_VOICES_DIR, exist_ok=True)

def release_torch_memory():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        try:
            torch.mps.empty_cache()
        except Exception:
            pass

def unload_tts_model():
    global model
    if model is not None:
        model = None
        release_torch_memory()
        print("Released Qwen TTS model from memory.")

def unload_asr_model():
    global ASR_MODEL, ASR_MODEL_CONFIG
    if ASR_MODEL is not None:
        ASR_MODEL = None
        ASR_MODEL_CONFIG = None
        release_torch_memory()
        print("Released faster-whisper model from memory.")

def get_tts_model(progress=None):
    global model
    if model is not None:
        return model

    unload_asr_model()
    if progress is not None:
        progress(0.1, desc="Loading Qwen TTS model...")

    try:
        model_dtype = torch.bfloat16 if device != "cpu" else torch.float32
        attn_impl = "flash_attention_2" if device.startswith("cuda") else "eager"
        model = Qwen3TTSModel.from_pretrained(
            MODEL_ID,
            device_map=device,
            dtype=model_dtype,
            attn_implementation=attn_impl
        )
        print(f"Successfully loaded '{MODEL_ID}' on {device}")
        return model
    except Exception as e:
        model = None
        raise RuntimeError(f"Model could not be loaded: {e}")

def get_asr_compute_type_candidates():
    if ASR_DEVICE == "cuda":
        return ["float16", "int8_float16"]
    return ["int8", "float32"]

def get_asr_model(model_size):
    global ASR_MODEL, ASR_MODEL_CONFIG
    if WhisperModel is None:
        raise RuntimeError(f"faster-whisper is not available: {FASTER_WHISPER_IMPORT_ERROR}")

    unload_tts_model()

    if ASR_MODEL is not None and ASR_MODEL_CONFIG and ASR_MODEL_CONFIG[0] == model_size:
        return ASR_MODEL, ASR_MODEL_CONFIG[2]

    load_errors = []
    for compute_type in get_asr_compute_type_candidates():
        try:
            whisper_model = WhisperModel(model_size, device=ASR_DEVICE, compute_type=compute_type)
            ASR_MODEL = whisper_model
            ASR_MODEL_CONFIG = (model_size, ASR_DEVICE, compute_type)
            print(f"Loaded faster-whisper model '{model_size}' on {ASR_DEVICE} with {compute_type}.")
            return whisper_model, compute_type
        except Exception as e:
            load_errors.append(f"{compute_type}: {e}")

    raise RuntimeError("Could not load faster-whisper model. " + " | ".join(load_errors))

def get_saved_voices():
    voices = []
    if os.path.exists(SAVED_VOICES_DIR):
        for f in os.listdir(SAVED_VOICES_DIR):
            if f.endswith(".wav"):
                name = f[:-4]
                if os.path.exists(os.path.join(SAVED_VOICES_DIR, f"{name}.txt")):
                    voices.append(name)
    return sorted(voices)

def write_audio_input(audio_input, output_path):
    if isinstance(audio_input, str):
        shutil.copy2(audio_input, output_path)
        return

    if not audio_input or len(audio_input) != 2:
        raise ValueError("Unsupported audio input format.")

    sample_rate, audio_data = audio_input
    sf.write(output_path, audio_data, sample_rate)

def audio_input_to_temp_wav(audio_input):
    fd, temp_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    write_audio_input(audio_input, temp_path)
    return temp_path

def normalize_transcript_text(text):
    if not text:
        return ""
    return " ".join(text.split())

def format_transcript_text(text):
    normalized_text = normalize_transcript_text(text)
    if not normalized_text:
        return ""
    return re.sub(r'(?<=[.!?])\s+', "\n", normalized_text).strip()

def build_transcript_from_segments(segments):
    parts = []
    for segment in segments:
        segment_text = segment.text.strip()
        if segment_text:
            parts.append(segment_text)
    return format_transcript_text(" ".join(parts))

def transcribe_file_with_faster_whisper(file_path, model_size, language, progress):
    progress(0.1, desc="Loading faster-whisper...")
    whisper_model, compute_type = get_asr_model(model_size)

    progress(0.35, desc="Transcribing media...")
    segments, info = whisper_model.transcribe(
        file_path,
        beam_size=5,
        language=None if language == "Auto" else language,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    segments = list(segments)

    progress(0.85, desc="Cleaning transcript...")
    transcript = build_transcript_from_segments(segments)
    if not transcript:
        raise RuntimeError("No speech was detected in the selected media.")

    detected_language = info.language or "unknown"
    language_prob = getattr(info, "language_probability", None)
    if language_prob is None:
        status = f"Transcribed {len(segments)} segments with faster-whisper ({model_size}, {compute_type}) on {ASR_DEVICE}. Language: {detected_language}."
    else:
        status = (
            f"Transcribed {len(segments)} segments with faster-whisper "
            f"({model_size}, {compute_type}) on {ASR_DEVICE}. "
            f"Language: {detected_language} ({language_prob:.2f})."
        )

    progress(1.0, desc="Done!")
    return transcript, status

def save_voice(audio_path, text, label):
    if audio_path is None:
        return gr.update(), "Error: No audio provided."
    if not text or not text.strip():
        return gr.update(), "Error: No transcript provided."
    if not label or not label.strip():
        return gr.update(), "Error: No label provided."
        
    safe_label = "".join([c for c in label if c.isalnum() or c in (' ', '-', '_')]).strip()
    if not safe_label:
        return gr.update(), "Error: Invalid label."
    
    target_audio = os.path.join(SAVED_VOICES_DIR, f"{safe_label}.wav")
    target_text = os.path.join(SAVED_VOICES_DIR, f"{safe_label}.txt")
    
    write_audio_input(audio_path, target_audio)
    with open(target_text, "w", encoding="utf-8") as f:
        f.write(text)
        
    choices = get_saved_voices()
    return gr.update(choices=choices, value=safe_label), f"Successfully saved voice as '{safe_label}'!"

def refresh_choices():
    return gr.update(choices=get_saved_voices(), value=None)

def load_voice(label):
    if not label:
        return None, ""
        
    audio_path = os.path.join(SAVED_VOICES_DIR, f"{label}.wav")
    text_path = os.path.join(SAVED_VOICES_DIR, f"{label}.txt")
    
    text = ""
    if os.path.exists(text_path):
        with open(text_path, "r", encoding="utf-8") as f:
            text = f.read()

    if os.path.exists(audio_path):
        # Gradio 6 Audio components need (sample_rate, numpy_array) tuples, not file paths
        audio_data, sr = sf.read(audio_path, dtype='float32')
        return (sr, audio_data), text
    return None, ""

def delete_voice(label):
    if not label:
        return gr.update(), None, "", "Error: No voice selected to delete."
        
    audio_path = os.path.join(SAVED_VOICES_DIR, f"{label}.wav")
    text_path = os.path.join(SAVED_VOICES_DIR, f"{label}.txt")
    
    deleted = False
    if os.path.exists(audio_path):
        os.remove(audio_path)
        deleted = True
    if os.path.exists(text_path):
        os.remove(text_path)
        deleted = True
        
    if deleted:
        choices = get_saved_voices()
        return gr.update(choices=choices, value=None), None, "", f"Successfully deleted voice '{label}'."
    return gr.update(), None, "", "Voice not found."

def transcribe_reference_audio(ref_audio, asr_model_size, asr_language, progress=gr.Progress()):
    progress(0, desc="Preparing reference audio...")
    if ref_audio is None:
        return gr.update(), "Please provide a reference audio clip first."

    temp_ref_path = None
    try:
        temp_ref_path = audio_input_to_temp_wav(ref_audio)
        transcript, status = transcribe_file_with_faster_whisper(
            temp_ref_path,
            asr_model_size,
            asr_language,
            progress,
        )
        return transcript, status
    except Exception as e:
        return gr.update(), f"Error transcribing reference audio: {e}"
    finally:
        unload_asr_model()
        if temp_ref_path and os.path.exists(temp_ref_path):
            os.remove(temp_ref_path)

def transcribe_uploaded_media(media_path, asr_model_size, asr_language, progress=gr.Progress()):
    progress(0, desc="Preparing source media...")
    if not media_path:
        return gr.update(), "Please upload an audio or video file first."

    try:
        transcript, status = transcribe_file_with_faster_whisper(
            media_path,
            asr_model_size,
            asr_language,
            progress,
        )
        return transcript, status
    except Exception as e:
        return gr.update(), f"Error transcribing media: {e}"
    finally:
        unload_asr_model()

def copy_text_to_field(text):
    return text.strip() if text else ""

def find_available_port(preferred_port=7860, search_limit=20):
    for port in range(preferred_port, preferred_port + search_limit):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError(
        f"Could not find an open port between {preferred_port} and {preferred_port + search_limit - 1}."
    )

def clone_voice(ref_audio, ref_text, target_text, progress=gr.Progress()):
    progress(0, desc="Initializing...")
    if not ref_audio:
        return None, "Please provide a reference audio."
    
    if not ref_text or not ref_text.strip():
        return None, "Please provide the exact transcript of the reference audio."
        
    if not target_text or not target_text.strip():
        return None, "Please provide the text you want to synthesize."

    try:
        tts_model = get_tts_model(progress)

        # ref_audio is (sample_rate, numpy_array) from the Audio component
        temp_ref = audio_input_to_temp_wav(ref_audio)
        
        progress(0.3, desc="Synthesizing audio (this may take a bit)...")
        wavs, out_sr = tts_model.generate_voice_clone(
            text=target_text,
            language="Auto",
            ref_audio=temp_ref,
            ref_text=ref_text,
        )
        
        progress(0.9, desc="Saving generated file...")
        progress(1.0, desc="Done!")
        return (out_sr, wavs[0]), "Successfully generated audio!"

    except Exception as e:
        return None, f"Error generating audio: {str(e)}"
    finally:
        if 'temp_ref' in locals() and temp_ref and os.path.exists(temp_ref):
            os.remove(temp_ref)

# Define the Gradio interface
with gr.Blocks(title="Qwen3-TTS Voice Clone") as interface:
    gr.Markdown("# Qwen3-TTS Voice Clone Interface")
    gr.Markdown("Clone your voice and **save profiles** for quick access later.")
    
    with gr.Row():
        with gr.Column(scale=1):
            gr.Markdown("### 1. Select or Create Voice Profile")
            
            with gr.Group():
                with gr.Row():
                    saved_voices_dropdown = gr.Dropdown(
                        choices=get_saved_voices(), 
                        label="Load Saved Voice", 
                        info="Select a voice profile to auto-fill audio and transcript.",
                        scale=3
                    )
                    refresh_btn = gr.Button("🔄", scale=0, min_width=50)
                    delete_btn = gr.Button("🗑️", variant="stop", scale=0, min_width=50)
            
            ref_audio_input = gr.Audio(label="Reference Audio (Upload or Record)", type="numpy", sources=["microphone", "upload"])
            ref_text_input = gr.Textbox(label="Reference Transcript", placeholder="Type exactly what you said in the audio...", lines=3)
            transcribe_ref_btn = gr.Button("📝 Transcribe Reference", variant="secondary")
            
            with gr.Row():
                save_label = gr.Textbox(label="New Profile Name", placeholder="e.g. My Formal Voice", scale=2)
                save_btn = gr.Button("💾 Save Voice Profile", scale=1)
            
            save_msg = gr.Textbox(label="Status", interactive=False, lines=2)
                
        with gr.Column(scale=1):
            gr.Markdown("### 2. Synthesize New Speech")
            target_text_input = gr.Textbox(label="Target Text to Synthesize", placeholder="What do you want the AI to say?", lines=5)
            
            with gr.Row():
                generate_btn = gr.Button("🔊 Generate", variant="secondary", size="lg")
                save_gen_btn = gr.Button("💾🔊 Save & Generate", variant="primary", size="lg")
            
            output_audio = gr.Audio(label="Generated Audio Output", type="numpy")
            output_msg = gr.Textbox(label="Generation Log and Status", interactive=False, lines=2)

    with gr.Row():
        with gr.Column():
            gr.Markdown("### 3. Transcribe Source Media")
            source_media_input = gr.File(
                label="Source Audio or Video",
                type="filepath",
                file_count="single",
            )
            with gr.Row():
                asr_model_input = gr.Dropdown(
                    choices=ASR_MODEL_CHOICES,
                    value="base",
                    label="ASR Model Size",
                )
                asr_language_input = gr.Dropdown(
                    choices=ASR_LANGUAGE_CHOICES,
                    value="Auto",
                    label="ASR Language",
                )
            transcribe_media_btn = gr.Button("📝 Transcribe Media", variant="primary")
            transcript_output = gr.Textbox(
                label="Transcript",
                placeholder="Transcribed text will appear here...",
                lines=8,
            )
            with gr.Row():
                use_as_ref_btn = gr.Button("Use as Reference Transcript")
                use_as_target_btn = gr.Button("Use as Target Text")
            transcript_msg = gr.Textbox(
                label="Transcription Status",
                interactive=False,
                lines=2,
            )
            
    # Wirings
    saved_voices_dropdown.change(
        fn=load_voice,
        inputs=[saved_voices_dropdown],
        outputs=[ref_audio_input, ref_text_input]
    )
    
    refresh_btn.click(
        fn=refresh_choices,
        inputs=[],
        outputs=[saved_voices_dropdown]
    )
    
    save_btn.click(
        fn=save_voice,
        inputs=[ref_audio_input, ref_text_input, save_label],
        outputs=[saved_voices_dropdown, save_msg]
    ).then(
        fn=refresh_choices,
        inputs=[],
        outputs=[saved_voices_dropdown]
    )
    
    delete_btn.click(
        fn=delete_voice,
        inputs=[saved_voices_dropdown],
        outputs=[saved_voices_dropdown, ref_audio_input, ref_text_input, save_msg]
    )
    
    generate_btn.click(
        fn=clone_voice,
        inputs=[ref_audio_input, ref_text_input, target_text_input],
        outputs=[output_audio, output_msg]
    )

    transcribe_ref_btn.click(
        fn=transcribe_reference_audio,
        inputs=[ref_audio_input, asr_model_input, asr_language_input],
        outputs=[ref_text_input, save_msg]
    )

    transcribe_media_btn.click(
        fn=transcribe_uploaded_media,
        inputs=[source_media_input, asr_model_input, asr_language_input],
        outputs=[transcript_output, transcript_msg]
    )

    use_as_ref_btn.click(
        fn=copy_text_to_field,
        inputs=[transcript_output],
        outputs=[ref_text_input]
    )

    use_as_target_btn.click(
        fn=copy_text_to_field,
        inputs=[transcript_output],
        outputs=[target_text_input]
    )

    save_gen_btn.click(
        fn=save_voice,
        inputs=[ref_audio_input, ref_text_input, save_label],
        outputs=[saved_voices_dropdown, save_msg]
    ).then(
        fn=refresh_choices,
        inputs=[],
        outputs=[saved_voices_dropdown]
    ).then(
        fn=clone_voice,
        inputs=[ref_audio_input, ref_text_input, target_text_input],
        outputs=[output_audio, output_msg]
    )

if __name__ == "__main__":
    launch_port = find_available_port()
    print("Models will be loaded on demand to reduce memory pressure.")
    print("Only one heavy model stays loaded at a time.")
    print(f"Starting Gradio Web Server on http://127.0.0.1:{launch_port}")
    interface.launch(
        server_name="127.0.0.1",
        server_port=launch_port,
        share=False,
        allowed_paths=[SAVED_VOICES_DIR],
        theme=gr.themes.Soft(),
    )
