"""
Brainclip Colab Voice + Render Runtime — Fish S2-Pro
====================================================
FastAPI backend that runs on Google Colab with GPU.

Capabilities:
  • Voice synthesis via Fish S2-Pro (vllm-omni or fish-speech backend)
  • Word-level transcription via Faster-Whisper large-v2
  • Video rendering via Remotion + headless Chromium
  • Reference audio encoding & caching for voice cloning

Environment variables:
  BRAINCLIP_APP_ROOT  — base directory (default: /content)
"""
from __future__ import annotations

import asyncio
import hashlib
import io
import json
import os
import subprocess
import tempfile
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import numpy as np
import requests
import soundfile as sf
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from pydantic import BaseModel, Field

# ──────────────────────────────────────────────────────────────
# Patch asyncio for Colab (Colab already runs an event loop)
# ──────────────────────────────────────────────────────────────
try:
    import nest_asyncio
    nest_asyncio.apply()
except ImportError:
    pass

# ──────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────
APP_ROOT = Path(os.environ.get("BRAINCLIP_APP_ROOT", "/content"))
MODEL_CACHE = APP_ROOT / "models"
REF_CACHE_DIR = APP_ROOT / "cache" / "refs"
TEMP_DIR = APP_ROOT / "tmp"
REMOTION_DIR = APP_ROOT / "remotion"
RENDER_WORK_DIR = APP_ROOT / "render_work"

for _d in (REF_CACHE_DIR, TEMP_DIR, RENDER_WORK_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ──────────────────────────────────────────────────────────────
# FastAPI app
# ──────────────────────────────────────────────────────────────
app = FastAPI(title="Brainclip Colab Runtime — Fish S2-Pro")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────
# Global state
# ──────────────────────────────────────────────────────────────
whisper_model: WhisperModel | None = None
s2_engine: Any = None
_executor = ThreadPoolExecutor(max_workers=4)
job_store: dict[str, dict[str, Any]] = {}

MODEL_NAME = "fishaudio/s2-pro"
MODEL_LOCAL_DIR = MODEL_CACHE / "s2-pro"

# ──────────────────────────────────────────────────────────────
# TTS engine detection (try both backends at import time)
# ──────────────────────────────────────────────────────────────
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

ENGINE_NAME = (
    "vllm-omni" if VLLM_OMNI_INSTALLED
    else "fish-speech" if S2_PRO_INSTALLED
    else "none"
)


# ──────────────────────────────────────────────────────────────
# Pydantic models
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


class RenderRequest(BaseModel):
    jobId: str
    inputProps: dict[str, Any]
    s3PutUrl: str


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def get_whisper() -> WhisperModel:
    """Lazy-load Whisper model on first use."""
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
    """Convert float32 numpy audio to WAV bytes."""
    if audio.dtype != np.float32:
        audio = audio.astype(np.float32)
    audio = np.clip(audio, -1.0, 1.0)
    buffer = io.BytesIO()
    sf.write(buffer, audio, sample_rate, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


def upload_presigned(url: str, body: bytes, content_type: str) -> None:
    """Upload bytes to a presigned S3 PUT URL."""
    response = requests.put(
        url, data=body,
        headers={"content-type": content_type},
        timeout=300,
    )
    response.raise_for_status()


def build_master(
    lines: list[VoiceLine],
    rendered: dict[str, np.ndarray],
    sample_rate: int = 44100,
) -> np.ndarray:
    """Concatenate rendered audio segments with silence gaps."""
    segments: list[np.ndarray] = []
    for line in sorted(lines, key=lambda l: l.id):
        segments.append(rendered[line.id])
        silence = np.zeros(
            int(sample_rate * (line.pause_ms / 1000)),
            dtype=np.float32,
        )
        segments.append(silence)
    return np.concatenate(segments) if segments else np.zeros(sample_rate, dtype=np.float32)


def transcribe(audio_data: str | bytes) -> list[dict[str, Any]]:
    """Transcribe audio with word-level timestamps."""
    tmp_path = None
    try:
        if isinstance(audio_data, bytes):
            fd, tmp_path = tempfile.mkstemp(suffix=".wav")
            os.write(fd, audio_data)
            os.close(fd)
            audio_data = tmp_path

        segments, _ = get_whisper().transcribe(audio_data, word_timestamps=True)
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
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def get_ref_cache_key(ref_id: str, ref_text: str) -> str:
    return hashlib.sha256(f"{ref_id}:{ref_text}".encode()).hexdigest()[:20]


def _download_audio(url: str) -> bytes:
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    return resp.content


# ──────────────────────────────────────────────────────────────
# GPU check
# ──────────────────────────────────────────────────────────────

def _check_gpu() -> dict[str, Any]:
    if not torch.cuda.is_available():
        return {"ok": False, "reason": "CUDA not available"}
    try:
        mem_free, mem_total = torch.cuda.mem_get_info()
        return {
            "ok": True,
            "mem_free_gb": round(mem_free / 1e9, 1),
            "mem_total_gb": round(mem_total / 1e9, 1),
            "util_pct": round((1 - mem_free / mem_total) * 100, 1),
        }
    except Exception as exc:
        return {"ok": False, "reason": f"GPU query failed: {exc}"}


# ──────────────────────────────────────────────────────────────
# S2-Pro engine management
# ──────────────────────────────────────────────────────────────

def _load_s2_engine() -> Any:
    """Load S2-Pro engine (lazy, cached globally)."""
    global s2_engine
    if s2_engine is not None:
        return s2_engine

    gpu = _check_gpu()
    if not gpu["ok"]:
        raise RuntimeError(f"Cannot load S2-Pro: {gpu['reason']}")

    mem_free_gb = gpu["mem_free_gb"]

    if VLLM_OMNI_INSTALLED:
        print(f"[Engine] Loading vLLM-Omni engine (VRAM free: {mem_free_gb:.1f} GB)")
        s2_engine = OmniEngine(
            model_path=str(MODEL_LOCAL_DIR),
            dtype="bfloat16",
            gpu_memory_utilization=0.80 if mem_free_gb > 10 else 0.65,
            max_model_len=4096,
            enforce_eager=True,
        )
    elif S2_PRO_INSTALLED:
        print(f"[Engine] Loading Fish-Speech engine (VRAM free: {mem_free_gb:.1f} GB)")
        s2_engine = TextToSpeech(
            model_path=str(MODEL_LOCAL_DIR),
            device="cuda",
            compile=False,
            dtype=torch.bfloat16,
        )
    else:
        raise ImportError(
            "Neither vllm-omni nor fish-speech is installed. "
            "Run: pip install vllm-omni  OR  pip install fish-speech"
        )

    print("[Engine] ✅ S2-Pro engine loaded successfully")
    return s2_engine


# ──────────────────────────────────────────────────────────────
# Reference encoding
# ──────────────────────────────────────────────────────────────

def _encode_ref_from_bytes(audio_bytes: bytes, ref_text: str) -> bytes:
    """Encode reference audio into speaker tokens (cached on disk)."""
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
        return result_bytes
    finally:
        temp_ref.unlink(missing_ok=True)


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
    """Synthesize one line of speech using S2-Pro."""
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
                "Use Fish.audio API (not Colab) for preset voices, "
                "or provide a reference audio URL for voice cloning."
            )
        raise RuntimeError(
            "No reference audio provided. Colab S2-Pro requires either "
            "a reference audio URL or use Fish.audio API for preset voices."
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
# Async TTS job runner
# ──────────────────────────────────────────────────────────────

async def _run_tts_job(job_id: str, payload: VoiceJobRequest) -> None:
    """Full TTS pipeline: encode refs → synthesize → upload → transcribe."""
    try:
        job_store[job_id] = {"stage": "initializing", "progressPct": 0, "error": None}

        gpu = _check_gpu()
        if not gpu["ok"]:
            job_store[job_id] = {"stage": "failed", "progressPct": 0, "error": gpu["reason"]}
            return

        if gpu["mem_free_gb"] < 2.0:
            job_store[job_id] = {
                "stage": "gpu_low_memory", "progressPct": 0,
                "error": "GPU memory critically low. Restart Colab runtime.",
            }
            return

        job_store[job_id] = {
            "stage": "encoding_reference", "progressPct": 5,
            "gpuMemFreeGb": gpu["mem_free_gb"],
        }

        # ── Resolve reference audio ──
        def _resolve_ref_audio(model_id: str | None, ref_text: str) -> bytes:
            if not model_id:
                return b""
            if model_id.startswith("http://") or model_id.startswith("https://"):
                return _encode_ref_from_bytes(_download_audio(model_id), ref_text)
            return b""

        ref_a_text = payload.speakerA.refText or payload.speakerA.label
        ref_b_text = payload.speakerB.refText or payload.speakerB.label

        try:
            ref_a_bytes = _resolve_ref_audio(payload.speakerA.modelId, ref_a_text)
            ref_b_bytes = _resolve_ref_audio(payload.speakerB.modelId, ref_b_text)
        except Exception as exc:
            job_store[job_id] = {
                "stage": "failed", "progressPct": 5,
                "error": f"Reference download/encode failed: {exc}",
            }
            return

        job_store[job_id] = {
            "stage": "synthesizing", "progressPct": 20,
            "gpuMemFreeGb": gpu["mem_free_gb"],
        }

        # ── Synthesize each line ──
        loop = asyncio.get_running_loop()
        rendered: dict[str, np.ndarray] = {}
        total = len(payload.lines)

        for i, line in enumerate(payload.lines):
            ref_tokens = ref_a_bytes if line.speaker == "A" else ref_b_bytes
            model_id = (
                payload.speakerA.modelId if line.speaker == "A"
                else payload.speakerB.modelId
            )

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
                    "error": "GPU OOM during synthesis. Restart the Colab runtime.",
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

        # ── Upload individual lines ──
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
                job_store[job_id] = {
                    "stage": "upload_failed", "progressPct": 70,
                    "error": f"Upload failed for {line.id}: {exc}",
                }
                return

        # ── Build & upload master ──
        job_store[job_id] = {"stage": "building_master", "progressPct": 80}
        master = build_master(sorted_lines, rendered)
        master_bytes = to_wav_bytes(master)

        # ── Transcribe ──
        job_store[job_id] = {"stage": "transcribing", "progressPct": 85}
        try:
            words = transcribe(master_bytes)
        except Exception:
            # Fallback: empty transcript rather than crashing the job
            words = []

        # ── Upload master + transcript ──
        try:
            upload_presigned(
                payload.presignedUrls.transcript,
                json.dumps(words).encode("utf-8"),
                "application/json",
            )
            upload_presigned(payload.presignedUrls.master, master_bytes, "audio/wav")
        except Exception as exc:
            job_store[job_id] = {
                "stage": "upload_failed", "progressPct": 85,
                "error": f"Master/transcript upload failed: {exc}",
            }
            return

        job_store[job_id] = {"stage": "voice_done", "progressPct": 100}

    except Exception as exc:
        job_store[job_id] = {
            "stage": "failed", "progressPct": 0,
            "error": f"{exc}\n{traceback.format_exc()}",
        }


# ──────────────────────────────────────────────────────────────
# Render task runner
# ──────────────────────────────────────────────────────────────

def _find_remotion_dir() -> Path:
    """Find the remotion directory — handles both clone layouts."""
    candidates = [
        APP_ROOT / "remotion",                  # direct clone into /content
        APP_ROOT / "Brainclip" / "remotion",    # nested clone
    ]
    for d in candidates:
        if (d / "index.tsx").exists() or (d / "ReelComposition.tsx").exists():
            return d
    # Fallback
    return candidates[0]


def _run_render_task(job_id: str, input_props: dict, s3_put_url: str) -> None:
    """Background task: Remotion render → S3 upload."""
    try:
        remotion_dir = _find_remotion_dir()
        job_store[job_id] = {"stage": "rendering", "progressPct": 10}

        # Write input props to a stable location
        props_file = RENDER_WORK_DIR / f"input_{job_id}.json"
        out_file = RENDER_WORK_DIR / f"out_{job_id}.mp4"

        with open(props_file, "w") as f:
            json.dump(input_props, f)

        # Ensure npm dependencies are installed
        if not (remotion_dir / "node_modules").exists():
            print(f"[Render {job_id}] Installing npm dependencies in {remotion_dir}")
            subprocess.run(
                ["npm", "install"],
                cwd=str(remotion_dir),
                check=False,
                capture_output=True,
                timeout=120,
            )

        # Determine chromium path
        chromium = "/usr/bin/chromium-browser"
        if not os.path.exists(chromium):
            chromium = "/usr/bin/chromium"
        if not os.path.exists(chromium):
            chromium = "/usr/bin/google-chrome-stable"

        # Build render command
        cmd = [
            "npx", "remotion", "render",
            "ReelComposition",
            str(out_file),
            f"--props={props_file}",
            f"--browser-executable={chromium}",
            "--gl=swiftshader",
            "--timeout=120000",
        ]

        print(f"[Render {job_id}] Command: {' '.join(cmd)}")
        print(f"[Render {job_id}] CWD: {remotion_dir}")

        job_store[job_id] = {"stage": "rendering", "progressPct": 20}

        process = subprocess.Popen(
            cmd,
            cwd=str(remotion_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        for line in process.stdout:
            line = line.strip()
            if line:
                print(f"[Render {job_id}] {line}")
                # Try to extract progress from Remotion output
                if "%" in line:
                    try:
                        pct_str = line.split("%")[0].split()[-1]
                        pct = int(float(pct_str))
                        job_store[job_id] = {
                            "stage": f"rendering ({pct}%)",
                            "progressPct": 20 + int(pct * 0.6),
                        }
                    except (ValueError, IndexError):
                        pass

        process.wait()

        if process.returncode != 0:
            job_store[job_id] = {
                "stage": "failed",
                "error": f"Remotion render failed (exit code {process.returncode}). Check server logs.",
            }
            return

        if not out_file.exists():
            job_store[job_id] = {
                "stage": "failed",
                "error": f"Render output file not found at {out_file}",
            }
            return

        # Upload to S3
        job_store[job_id] = {"stage": "uploading_video", "progressPct": 85}
        file_size_mb = out_file.stat().st_size / (1024 * 1024)
        print(f"[Render {job_id}] Uploading {file_size_mb:.1f} MB to S3...")

        with open(out_file, "rb") as f:
            r = requests.put(
                s3_put_url,
                data=f,
                headers={"Content-Type": "video/mp4"},
                timeout=600,
            )
            if not r.ok:
                job_store[job_id] = {
                    "stage": "failed",
                    "error": f"S3 upload failed: HTTP {r.status_code}",
                }
                return

        job_store[job_id] = {"stage": "done", "progressPct": 100}
        print(f"[Render {job_id}] ✅ Complete! ({file_size_mb:.1f} MB uploaded)")

        # Cleanup temp files
        props_file.unlink(missing_ok=True)
        out_file.unlink(missing_ok=True)

    except Exception as e:
        job_store[job_id] = {"stage": "failed", "error": str(e)}
        print(f"[Render {job_id}] ❌ Error: {e}\n{traceback.format_exc()}")


# ──────────────────────────────────────────────────────────────
# Routes — Health
# ──────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict[str, Any]:
    gpu_info = _check_gpu()
    model_loaded = s2_engine is not None

    result: dict[str, Any] = {
        "status": "ok" if gpu_info["ok"] else "degraded",
        "model": MODEL_NAME,
        "models_loaded": model_loaded,
        "engine_type": ENGINE_NAME,
        "gpu_ok": gpu_info["ok"],
        "gpu_mem_free_gb": gpu_info.get("mem_free_gb"),
        "gpu_mem_total_gb": gpu_info.get("mem_total_gb"),
        "gpu_util_pct": gpu_info.get("util_pct"),
        "session_id": os.environ.get("COLAB_RELEASE_TAG", "local-session"),
    }

    # Safe GPU VRAM query (don't crash if no GPU)
    if torch.cuda.is_available():
        try:
            result["gpu_vram_gb"] = round(
                torch.cuda.get_device_properties(0).total_memory / 1e9, 1
            )
            result["gpu_name"] = torch.cuda.get_device_properties(0).name
        except Exception:
            result["gpu_vram_gb"] = 0
            result["gpu_name"] = "unknown"
    else:
        result["gpu_vram_gb"] = 0
        result["gpu_name"] = "none"

    # Report remotion availability
    remotion_dir = _find_remotion_dir()
    result["remotion_ready"] = (remotion_dir / "node_modules").exists()
    result["remotion_dir"] = str(remotion_dir)

    return result


# ──────────────────────────────────────────────────────────────
# Routes — Voice
# ──────────────────────────────────────────────────────────────

@app.post("/voice/encode-ref")
async def encode_ref(payload: EncodeRefRequest) -> dict[str, Any]:
    try:
        audio_bytes = _download_audio(payload.refAudioUrl)
        tokens = _encode_ref_from_bytes(audio_bytes, payload.refText)
        cache_key = get_ref_cache_key(payload.refAudioUrl, payload.refText)
        return {
            "cacheKey": cache_key,
            "speaker": payload.speaker,
            "tokens_size_bytes": len(tokens),
        }
    except Exception as exc:
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
        return {
            "cacheKey": cache_key,
            "speaker": speaker,
            "tokens_size_bytes": len(tokens),
        }
    except Exception as exc:
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


# ──────────────────────────────────────────────────────────────
# Routes — Render
# ──────────────────────────────────────────────────────────────

@app.post("/render")
async def start_render(req: RenderRequest, background_tasks: BackgroundTasks):
    job_id = req.jobId
    job_store[job_id] = {"stage": "queued_render", "progressPct": 0}
    background_tasks.add_task(_run_render_task, job_id, req.inputProps, req.s3PutUrl)
    return {"status": "started", "jobId": job_id}


@app.get("/render/job/{job_id}")
def get_render_status(job_id: str) -> dict[str, Any]:
    """Alias for checking render job progress."""
    if job_id not in job_store:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job_store[job_id]


# ──────────────────────────────────────────────────────────────
# Startup event
# ──────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Log startup info and verify engine availability."""
    print("=" * 60)
    print("  🧠 Brainclip Colab Runtime")
    print("=" * 60)
    print(f"  Engine       : {ENGINE_NAME}")
    print(f"  App root     : {APP_ROOT}")
    print(f"  Model dir    : {MODEL_LOCAL_DIR}")
    print(f"  Remotion dir : {_find_remotion_dir()}")

    gpu = _check_gpu()
    if gpu["ok"]:
        print(f"  GPU VRAM     : {gpu['mem_free_gb']:.1f} / {gpu['mem_total_gb']:.1f} GB free")
        if torch.cuda.is_available():
            print(f"  GPU name     : {torch.cuda.get_device_properties(0).name}")
    else:
        print(f"  GPU          : ⚠️  {gpu.get('reason', 'unavailable')}")

    if ENGINE_NAME == "none":
        print("")
        print("  ⚠️  No TTS engine detected!")
        print("  Install one:  pip install vllm-omni  OR  pip install fish-speech")
    print("=" * 60)
