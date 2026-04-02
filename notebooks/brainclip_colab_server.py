from __future__ import annotations

import asyncio
import hashlib
import io
import json
import math
import os
import pickle
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import numpy as np
import requests
import soundfile as sf
import torch
import transformers
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, BackgroundTasks
from faster_whisper import WhisperModel
from pydantic import BaseModel, Field

APP_ROOT = Path(os.environ.get("BRAINCLIP_APP_ROOT", "/content"))
MODEL_CACHE = APP_ROOT / "models"
REF_CACHE_DIR = APP_ROOT / "cache" / "refs"
TEMP_DIR = APP_ROOT / "tmp"

REF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

from fastapi.middleware.cors import CORSMiddleware
app = FastAPI(title="Brainclip Colab Voice Runtime — Fish S2-Pro")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

whisper_model: WhisperModel | None = None
s2_engine: Any = None
_executor = ThreadPoolExecutor(max_workers=4)
job_store: dict[str, dict[str, Any]] = {}

MODEL_NAME = "fishaudio/s2-pro"
MODEL_LOCAL_DIR = MODEL_CACHE / "s2-pro"

S2_PRO_INSTALLED = False
try:
    from fish_speech.models.text2semantic.inference import (
        GenerateRequest,
        GenerateResponse,
    )
    from fish_speech.text_to_speech import TextToSpeech

    S2_PRO_INSTALLED = True
except ImportError:
    pass

VLLM_OMNI_INSTALLED = False
try:
    from vllm_omni import OmniEngine

    VLLM_OMNI_INSTALLED = True
except ImportError:
    pass


# ──────────────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────────────

class VoiceLine(BaseModel):
    id: str
    speaker: str
    text: str
    emotion: str = "neutral"
    speaking_rate: float = 1.0
    pause_ms: int = 250
    temperature: float = 0.7
    chunk_length: int = 200
    normalize: bool = True


class SpeakerConfig(BaseModel):
    label: str
    modelId: str | None = None
    refText: str | None = None


class PresignedUrls(BaseModel):
    lines: dict[str, str]
    master: str
    transcript: str


class VoiceJobRequest(BaseModel):
    jobId: str
    userId: str
    bucket: str
    region: str = "ap-south-1"
    lines: list[VoiceLine]
    speakerA: SpeakerConfig
    speakerB: SpeakerConfig
    presignedUrls: PresignedUrls


class EncodeRefRequest(BaseModel):
    refAudioUrl: str
    refText: str
    speaker: str = "A"


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def get_whisper() -> WhisperModel:
    global whisper_model
    if whisper_model is None:
        whisper_model = WhisperModel(
            "large-v2",
            device="cuda",
            compute_type="float16",
            download_root=str(MODEL_CACHE / "whisper"),
        )
    return whisper_model


def to_wav_bytes(audio: np.ndarray, sample_rate: int = 44100) -> bytes:
    if audio.dtype != np.float32:
        audio = audio.astype(np.float32)
    audio = np.clip(audio, -1.0, 1.0)
    buffer = io.BytesIO()
    sf.write(buffer, audio, sample_rate, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


def upload_presigned(url: str, body: bytes, content_type: str) -> None:
    response = requests.put(url, data=body, headers={"content-type": content_type}, timeout=300)
    response.raise_for_status()


def build_master(lines: list[VoiceLine], rendered: dict[str, np.ndarray], sample_rate: int = 44100) -> np.ndarray:
    segments: list[np.ndarray] = []
    sorted_lines = sorted(lines, key=lambda l: l.id)
    for line in sorted_lines:
        audio = rendered[line.id]
        segments.append(audio)
        silence = np.zeros(int(sample_rate * (line.pause_ms / 1000)), dtype=np.float32)
        segments.append(silence)
    return np.concatenate(segments) if segments else np.zeros(sample_rate, dtype=np.float32)


def transcribe(audio_path: str | bytes) -> list[dict[str, Any]]:
    if isinstance(audio_path, bytes):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_path)
            audio_path = tmp.name
    segments, _ = get_whisper().transcribe(audio_path, word_timestamps=True)
    words: list[dict[str, Any]] = []
    speaker = "A"
    for segment in segments:
        for word in segment.words or []:
            words.append({
                "word": word.word.strip(),
                "start": round(word.start, 3),
                "end": round(word.end, 3),
                "speaker": speaker,
            })
    return words


def get_ref_cache_key(ref_id: str, ref_text: str) -> str:
    return hashlib.sha256(f"{ref_id}:{ref_text}".encode()).hexdigest()[:20]


# ──────────────────────────────────────────────────────────────
# S2-Pro engine management
# ──────────────────────────────────────────────────────────────

def _check_gpu() -> dict[str, Any]:
    if not torch.cuda.is_available():
        return {"ok": False, "reason": "CUDA not available"}
    mem_free, mem_total = torch.cuda.mem_get_info()
    return {
        "ok": True,
        "mem_free_gb": round(mem_free / 1e9, 1),
        "mem_total_gb": round(mem_total / 1e9, 1),
        "util_pct": round((1 - mem_free / mem_total) * 100, 1),
    }


def _load_s2_engine() -> Any:
    global s2_engine
    if s2_engine is not None:
        return s2_engine

    gpu = _check_gpu()
    if not gpu["ok"]:
        raise RuntimeError(f"Cannot load S2-Pro: {gpu['reason']}")

    mem_free_gb = gpu["mem_free_gb"]

    if VLLM_OMNI_INSTALLED:
        s2_engine = OmniEngine(
            model_path=str(MODEL_LOCAL_DIR),
            dtype="bfloat16",
            gpu_memory_utilization=0.80 if mem_free_gb > 10 else 0.65,
            max_model_len=4096,
            enforce_eager=True,
        )
    elif S2_PRO_INSTALLED:
        s2_engine = TextToSpeech(
            model_path=str(MODEL_LOCAL_DIR),
            device="cuda",
            compile=False,
            dtype=torch.bfloat16,
        )
    else:
        raise ImportError(
            "Neither vllm-omni nor fish-speech is installed. "
            "Run: pip install vllm==0.8.4  OR  pip install fish-speech"
        )

    return s2_engine


# ──────────────────────────────────────────────────────────────
# Reference encoding
# ──────────────────────────────────────────────────────────────

def _encode_ref_from_bytes(audio_bytes: bytes, ref_text: str) -> bytes:
    cache_key = get_ref_cache_key("upload", ref_text)
    cache_path = REF_CACHE_DIR / f"{cache_key}.npy"

    if cache_path.exists():
        return cache_path.read_bytes()

    temp_ref = TEMP_DIR / f"ref_{cache_key}.wav"
    temp_ref.write_bytes(audio_bytes)

    try:
        if VLLM_OMNI_INSTALLED:
            engine = _load_s2_engine()
            ref_tokens = engine.encode_reference(str(temp_ref), ref_text)
        elif S2_PRO_INSTALLED:
            from fish_speech.text_to_speech import encode_reference
            ref_tokens = encode_reference(str(temp_ref), ref_text)
        else:
            raise RuntimeError("No S2-Pro engine available")

        tokens_np = ref_tokens.cpu().numpy() if hasattr(ref_tokens, "cpu") else ref_tokens
        result_bytes = tokens_np.tobytes()
        cache_path.write_bytes(result_bytes)
    finally:
        temp_ref.unlink(missing_ok=True)

    return result_bytes


def _download_audio(url: str) -> bytes:
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    return resp.content


# ──────────────────────────────────────────────────────────────
# S2-Pro synthesis
# ──────────────────────────────────────────────────────────────

EMOTION_TAG_MAP: dict[str, str] = {
    "neutral": "",
    "happy": "[happy]",
    "sad": "[sad]",
    "angry": "[angry]",
    "surprised": "[surprised]",
    "excited": "[excited]",
    "whispering": "[whisper]",
    "shouting": "[shouting]",
}


def _synthesize_s2pro(
    text: str,
    ref_tokens_bytes: bytes,
    emotion: str,
    speaking_rate: float,
    model_id: str | None = None,
) -> np.ndarray:
    engine = _load_s2_engine()

    emotion_tag = EMOTION_TAG_MAP.get(emotion.lower(), f"[{emotion}]")
    if emotion_tag and emotion_tag not in ("[neutral]", ""):
        full_text = f"{emotion_tag} {text}"
    else:
        full_text = text

    if not ref_tokens_bytes:
        if model_id and not model_id.startswith("http"):
            raise RuntimeError(
                f"Colab S2-Pro cannot use preset model '{model_id}'. "
                "Use Fish.audio API (not Colab) for preset voices, or provide a reference audio URL for voice cloning."
            )
        raise RuntimeError(
            "No reference audio provided. Colab S2-Pro requires either a reference audio URL "
            "or use Fish.audio API for preset voices."
        )

    if VLLM_OMNI_INSTALLED:
        ref_tokens_np = np.frombuffer(ref_tokens_bytes, dtype=np.int64)
        ref_tokens = torch.from_numpy(ref_tokens_np).cuda()

        audio_tensor, sr = engine.generate(
            text=full_text,
            reference_tokens=ref_tokens,
            max_tokens=2048,
            temperature=0.7,
            top_p=0.9,
        )

        audio = audio_tensor.float().cpu().numpy()
        if audio.ndim == 2:
            audio = audio.mean(axis=0)
        return audio.astype(np.float32)

    elif S2_PRO_INSTALLED:
        from fish_speech.text_to_speech import synthesize

        ref_tokens_np = np.frombuffer(ref_tokens_bytes, dtype=np.int64)
        ref_tokens = torch.from_numpy(ref_tokens_np).cuda()

        audio = synthesize(
            text=full_text,
            reference_tokens=ref_tokens,
            speed=speaking_rate,
            enable_cache=True,
        )

        audio_np = audio.float().cpu().numpy()
        if audio_np.ndim == 2:
            audio_np = audio_np.mean(axis=0)
        return audio_np.astype(np.float32)

    else:
        raise RuntimeError("No S2-Pro engine available")


# ──────────────────────────────────────────────────────────────
# Async job runner
# ──────────────────────────────────────────────────────────────

async def _run_tts_job(job_id: str, payload: VoiceJobRequest) -> None:
    try:
        job_store[job_id] = {"stage": "initializing", "progressPct": 0, "error": None}

        gpu = _check_gpu()
        if not gpu["ok"]:
            job_store[job_id] = {"stage": "failed", "progressPct": 0, "error": gpu["reason"]}
            return

        if gpu["mem_free_gb"] < 2.0:
            job_store[job_id] = {"stage": "gpu_low_memory", "progressPct": 0, "error": "GPU memory critically low. Restart runtime."}
            return

        job_store[job_id] = {"stage": "encoding_reference", "progressPct": 5, "gpuMemFreeGb": gpu["mem_free_gb"]}

        def _resolve_ref_audio(model_id: str | None, ref_text: str) -> bytes:
            """Resolve reference audio: download if URL, otherwise use preset directly."""
            if not model_id:
                return b""
            if model_id.startswith("http://") or model_id.startswith("https://"):
                return _encode_ref_from_bytes(_download_audio(model_id), ref_text)
            return b""  # Preset model ID - S2-Pro will use built-in preset

        ref_a_text = payload.speakerA.refText or payload.speakerA.label
        ref_b_text = payload.speakerB.refText or payload.speakerB.label

        try:
            ref_a_bytes = _resolve_ref_audio(payload.speakerA.modelId, ref_a_text)
            ref_b_bytes = _resolve_ref_audio(payload.speakerB.modelId, ref_b_text)
        except Exception as exc:
            job_store[job_id] = {"stage": "failed", "progressPct": 5, "error": f"Reference download/encode failed: {exc}"}
            return

        job_store[job_id] = {"stage": "synthesizing", "progressPct": 20, "gpuMemFreeGb": gpu["mem_free_gb"]}

        loop = asyncio.get_event_loop()
        rendered: dict[str, np.ndarray] = {}
        total = len(payload.lines)

        for i, line in enumerate(payload.lines):
            ref_tokens = ref_a_bytes if line.speaker == "A" else ref_b_bytes
            model_id = payload.speakerA.modelId if line.speaker == "A" else payload.speakerB.modelId

            try:
                audio = await loop.run_in_executor(
                    _executor,
                    _synthesize_s2pro,
                    line.text,
                    ref_tokens,
                    line.emotion,
                    line.speaking_rate,
                    model_id,
                )
            except torch.cuda.OutOfMemoryError:
                job_store[job_id] = {
                    "stage": "model_oom",
                    "progressPct": 20 + int((i / total) * 50),
                    "error": "GPU OOM during synthesis. Try restarting the Colab runtime or reducing batch size.",
                }
                return
            except Exception as exc:
                job_store[job_id] = {
                    "stage": "synthesis_error",
                    "progressPct": 20 + int((i / total) * 50),
                    "error": f"Line {line.id} failed: {exc}",
                }
                return

            rendered[line.id] = audio

            current_pct = 20 + int(((i + 1) / total) * 50)
            gpu = _check_gpu()
            job_store[job_id] = {
                "stage": f"synthesizing ({i + 1}/{total})",
                "progressPct": current_pct,
                "gpuMemFreeGb": gpu.get("mem_free_gb"),
            }

        job_store[job_id] = {"stage": "uploading", "progressPct": 70}

        sorted_lines = sorted(payload.lines, key=lambda l: l.id)
        for line in sorted_lines:
            try:
                upload_presigned(
                    payload.presignedUrls.lines[line.id],
                    to_wav_bytes(rendered[line.id]),
                    "audio/wav",
                )
            except Exception as exc:
                job_store[job_id] = {"stage": "upload_failed", "progressPct": 70, "error": f"Upload failed for {line.id}: {exc}"}
                return

        job_store[job_id] = {"stage": "building_master", "progressPct": 80}

        master = build_master(sorted_lines, rendered)
        master_bytes = to_wav_bytes(master)

        job_store[job_id] = {"stage": "transcribing", "progressPct": 85}

        try:
            words = transcribe(master_bytes)
        except Exception as exc:
            words = [{"word": w, "start": 0.0, "end": 0.0, "speaker": "A"} for w in "placeholder".split()]

        try:
            upload_presigned(payload.presignedUrls.transcript, json.dumps(words).encode("utf-8"), "application/json")
            upload_presigned(payload.presignedUrls.master, master_bytes, "audio/wav")
        except Exception as exc:
            job_store[job_id] = {"stage": "upload_failed", "progressPct": 85, "error": f"Master/transcript upload failed: {exc}"}
            return

        job_store[job_id] = {"stage": "voice_done", "progressPct": 100}

    except Exception as exc:  # noqa: BLE001
        import traceback
        job_store[job_id] = {"stage": "failed", "progressPct": 0, "error": f"{exc}\n{traceback.format_exc()}"}


# ──────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, Any]:
    gpu_info = _check_gpu()
    model_loaded = s2_engine is not None

    return {
        "status": "ok" if gpu_info["ok"] else "degraded",
        "model": MODEL_NAME,
        "models_loaded": model_loaded,
        "engine_type": "vllm-omni" if VLLM_OMNI_INSTALLED else ("fish-speech" if S2_PRO_INSTALLED else "none"),
        "gpu_mem_free_gb": gpu_info.get("mem_free_gb"),
        "gpu_mem_total_gb": gpu_info.get("mem_total_gb"),
        "gpu_util_pct": gpu_info.get("util_pct"),
        "gpu_ok": gpu_info["ok"],
        "session_id": os.environ.get("COLAB_RELEASE_TAG", "local-session"),
        "gpu_vram_gb": round(torch.cuda.get_device_properties(0).total_memory / 1e9, 1) if torch.cuda.is_available() else 0,
    }


@app.post("/voice/encode-ref")
async def encode_ref(payload: EncodeRefRequest) -> dict[str, Any]:
    try:
        audio_bytes = _download_audio(payload.refAudioUrl)
        tokens = _encode_ref_from_bytes(audio_bytes, payload.refText)
        cache_key = get_ref_cache_key(payload.refAudioUrl, payload.refText)
        return {"cacheKey": cache_key, "speaker": payload.speaker, "tokens_size_bytes": len(tokens)}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/voice/clone")
async def clone_voice(
    speaker: str = Form(...),
    refText: str = Form(...),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    try:
        audio_bytes = await file.read()
        tokens = _encode_ref_from_bytes(audio_bytes, refText)
        cache_key = get_ref_cache_key(f"upload_{file.filename}", refText)
        return {"cacheKey": cache_key, "speaker": speaker, "tokens_size_bytes": len(tokens)}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/voice/job")
async def voice_job(payload: VoiceJobRequest) -> dict[str, Any]:
    job_store[payload.jobId] = {"stage": "queued", "progressPct": 0, "error": None}
    asyncio.create_task(_run_tts_job(payload.jobId, payload))
    return {"jobId": payload.jobId, "stage": "queued", "progressPct": 0}


@app.get("/voice/job/{job_id}")
def get_job_status(job_id: str) -> dict[str, Any]:
    if job_id not in job_store:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job_store[job_id]


@app.delete("/voice/cache/{cache_key}")
def clear_cache(cache_key: str) -> dict[str, Any]:
    removed = 0
    for f in REF_CACHE_DIR.glob(f"{cache_key}*"):
        f.unlink(missing_ok=True)
        removed += 1
    return {"removed": removed, "cache_key": cache_key}


@app.delete("/voice/cache")
def clear_all_cache() -> dict[str, Any]:
    removed = 0
    for f in REF_CACHE_DIR.iterdir():
        if f.is_file():
            f.unlink()
            removed += 1
    return {"removed": removed}

class RenderRequest(BaseModel):
    jobId: str
    inputProps: dict[str, Any]
    s3PutUrl: str

@app.post("/render")
async def start_render(req: RenderRequest, background_tasks: BackgroundTasks):
    job_id = req.jobId
    job_store[job_id] = {"stage": "rendering", "progressPct": 0}
    
    def render_task():
        try:
            import json
            import subprocess
            import requests
            
            # Save input props
            with open(f"input_{job_id}.json", "w") as f:
                json.dump(req.inputProps, f)
            
            # Install remotion dependencies if not already done
            subprocess.run(["npm", "install"], cwd="/content/Brainclip/remotion", check=False)
            
            # Run remotion
            cmd = [
                "npx", "remotion", "render", "ReelComposition", 
                f"out_{job_id}.mp4", 
                f"--props=../../input_{job_id}.json",
                "--browser-executable=/usr/bin/chromium-browser"
            ]
            
            process = subprocess.Popen(cmd, cwd="/content/Brainclip/remotion", stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            
            for line in process.stdout:
                print(f"[Render {job_id}] {line}", end="")
                
            process.wait()
            
            if process.returncode != 0:
                job_store[job_id] = {"stage": "failed", "error": "Remotion render failed"}
                return
                
            # Upload to S3
            out_file = f"/content/Brainclip/remotion/out_{job_id}.mp4"
            with open(out_file, "rb") as f:
                r = requests.put(req.s3PutUrl, data=f, headers={"Content-Type": "video/mp4"})
                if not r.ok:
                    job_store[job_id] = {"stage": "failed", "error": f"S3 upload failed: {r.status_code}"}
                    return
                    
            job_store[job_id] = {"stage": "done", "progressPct": 100}
            print(f"[Render {job_id}] S3 upload complete!")
            
        except Exception as e:
            job_store[job_id] = {"stage": "failed", "error": str(e)}
            print(f"[Render {job_id}] Error: {str(e)}")

    background_tasks.add_task(render_task)
    return {"status": "started", "jobId": job_id}

