from __future__ import annotations

import io
import json
import math
import os
from pathlib import Path
from typing import Any

import numpy as np
import requests
import soundfile as sf
from fastapi import FastAPI, HTTPException
from faster_whisper import WhisperModel
from pydantic import BaseModel, Field


APP_ROOT = Path(os.environ.get("BRAINCLIP_APP_ROOT", "/content/brainclip_runtime"))
MODEL_CACHE = APP_ROOT / "models"

app = FastAPI(title="Brainclip Colab Voice Runtime")
whisper_model: WhisperModel | None = None


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


def get_whisper() -> WhisperModel:
    global whisper_model
    if whisper_model is None:
        whisper_model = WhisperModel("large-v2", device="cuda", compute_type="float16", download_root=str(MODEL_CACHE / "whisper"))
    return whisper_model


def synthesize_placeholder(line: VoiceLine, sample_rate: int = 44100) -> np.ndarray:
    word_count = max(1, len(line.text.split()))
    duration = max(0.9, (word_count / (2.4 * max(line.speaking_rate, 0.75))))
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    base_freq = 220 if line.speaker == "A" else 180
    wave = 0.18 * np.sin(2 * math.pi * base_freq * t)
    envelope = np.minimum(1, t * 3) * np.minimum(1, (duration - t) * 3)
    return (wave * envelope).astype(np.float32)


def to_wav_bytes(audio: np.ndarray, sample_rate: int = 44100) -> bytes:
    buffer = io.BytesIO()
    sf.write(buffer, audio, sample_rate, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


def upload_presigned(url: str, body: bytes, content_type: str) -> None:
    response = requests.put(url, data=body, headers={"content-type": content_type}, timeout=120)
    response.raise_for_status()


def build_master(lines: list[VoiceLine], rendered: list[np.ndarray], sample_rate: int = 44100) -> np.ndarray:
    segments: list[np.ndarray] = []
    for line, audio in zip(lines, rendered):
      segments.append(audio)
      silence = np.zeros(int(sample_rate * (line.pause_ms / 1000)), dtype=np.float32)
      segments.append(silence)
    return np.concatenate(segments) if segments else np.zeros(sample_rate, dtype=np.float32)


def transcribe(master_path: str) -> list[dict[str, Any]]:
    segments, _ = get_whisper().transcribe(master_path, word_timestamps=True)
    words: list[dict[str, Any]] = []
    speaker = "A"
    for segment in segments:
      for word in segment.words or []:
        words.append({
          "word": word.word.strip(),
          "start": word.start,
          "end": word.end,
          "speaker": speaker,
        })
    return words


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "models_loaded": whisper_model is not None,
        "session_id": os.environ.get("COLAB_RELEASE_TAG", "local-session"),
    }


@app.post("/voice/job")
def voice_job(payload: VoiceJobRequest) -> dict[str, Any]:
    try:
        rendered = [synthesize_placeholder(line) for line in payload.lines]
        temp_dir = APP_ROOT / "tmp" / payload.jobId
        temp_dir.mkdir(parents=True, exist_ok=True)

        for line, audio in zip(payload.lines, rendered):
            upload_presigned(payload.presignedUrls.lines[line.id], to_wav_bytes(audio), "audio/wav")

        master = build_master(payload.lines, rendered)
        master_bytes = to_wav_bytes(master)
        master_path = temp_dir / "master.wav"
        master_path.write_bytes(master_bytes)
        upload_presigned(payload.presignedUrls.master, master_bytes, "audio/wav")

        words = transcribe(str(master_path))
        upload_presigned(payload.presignedUrls.transcript, json.dumps(words).encode("utf-8"), "application/json")

        return {"jobId": payload.jobId, "stage": "voice_done", "progressPct": 100}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
