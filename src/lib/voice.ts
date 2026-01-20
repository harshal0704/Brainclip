import { z } from "zod";

import { AppError } from "@/lib/errors";

const generatedLineSchema = z.object({
  id: z.string(),
  speaker: z.enum(["A", "B"]),
  text: z.string().min(1),
  emotion: z.string().default("neutral"),
  speaking_rate: z.number().default(1),
  pause_ms: z.number().int().nonnegative().default(250),
  temperature: z.number().default(0.7),
  chunk_length: z.number().int().default(200),
  normalize: z.boolean().default(true),
});

const jobSpeakerConfigSchema = z.object({
  label: z.string(),
  color: z.string().default("#ffffff"),
  stickerUrl: z.string().default(""),
  position: z.enum(["top", "bottom"]).default("top"),
  modelId: z.string().optional(),
});

const presignedUrlsSchema = z.object({
  lines: z.record(z.string(), z.string().url()),
  master: z.string().url(),
  transcript: z.string().url(),
});

export const voiceJobSchema = z.object({
  jobId: z.string().uuid(),
  userId: z.string().uuid(),
  bucket: z.string(),
  region: z.string().default("ap-south-1"),
  colabUrl: z.string().url().optional(),
  lines: z.array(generatedLineSchema).min(1),
  speakerA: jobSpeakerConfigSchema,
  speakerB: jobSpeakerConfigSchema,
  presignedUrls: presignedUrlsSchema,
});

export type VoiceJob = z.infer<typeof voiceJobSchema>;
export type PresignedVoiceUrls = z.infer<typeof presignedUrlsSchema>;

const uploadToPresignedUrl = async (url: string, body: BodyInit, contentType: string) => {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": contentType,
    },
    body,
  });

  if (!response.ok) {
    throw new AppError("s3_upload_failed", `Failed PUT to presigned URL: ${response.status}`, "Uploading generated assets failed. Please try again.", 502);
  }
};

type WavMeta = {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  pcmData: Uint8Array;
  durationSec: number;
};

const readAscii = (view: DataView, offset: number, length: number) => {
  let output = "";
  for (let index = 0; index < length; index += 1) {
    output += String.fromCharCode(view.getUint8(offset + index));
  }
  return output;
};

const parseWav = (buffer: Buffer) => {
  const uint8 = new Uint8Array(buffer);
  const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);

  if (readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WAVE") {
    throw new AppError("wav_invalid", "Fish API did not return a valid WAV file", "The generated audio could not be processed as WAV.", 502);
  }

  let cursor = 12;
  let sampleRate = 44100;
  let channels = 1;
  let bitsPerSample = 16;
  let pcmData: Uint8Array | null = null;

  while (cursor + 8 <= view.byteLength) {
    const chunkId = readAscii(view, cursor, 4);
    const chunkSize = view.getUint32(cursor + 4, true);
    const chunkDataStart = cursor + 8;

    if (chunkId === "fmt ") {
      channels = view.getUint16(chunkDataStart + 2, true);
      sampleRate = view.getUint32(chunkDataStart + 4, true);
      bitsPerSample = view.getUint16(chunkDataStart + 14, true);
    }

    if (chunkId === "data") {
      pcmData = uint8.slice(chunkDataStart, chunkDataStart + chunkSize);
    }

    cursor += 8 + chunkSize + (chunkSize % 2);
  }

  if (!pcmData) {
    throw new AppError("wav_missing_data", "WAV file is missing a data chunk", "The generated audio did not include playable PCM data.", 502);
  }

  const bytesPerFrame = channels * (bitsPerSample / 8);
  const durationSec = pcmData.length / (sampleRate * bytesPerFrame);

  return { sampleRate, channels, bitsPerSample, pcmData, durationSec } satisfies WavMeta;
};

const buildWav = (meta: Pick<WavMeta, "sampleRate" | "channels" | "bitsPerSample">, chunks: Uint8Array[]) => {
  const bytesPerFrame = meta.channels * (meta.bitsPerSample / 8);
  const totalPcmBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const wav = new Uint8Array(44 + totalPcmBytes);
  const view = new DataView(wav.buffer);

  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + totalPcmBytes, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, meta.channels, true);
  view.setUint32(24, meta.sampleRate, true);
  view.setUint32(28, meta.sampleRate * bytesPerFrame, true);
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, meta.bitsPerSample, true);
  writeAscii(36, "data");
  view.setUint32(40, totalPcmBytes, true);

  let offset = 44;
  for (const chunk of chunks) {
    wav.set(chunk, offset);
    offset += chunk.length;
  }

  return wav;
};

const createSilence = (meta: Pick<WavMeta, "sampleRate" | "channels" | "bitsPerSample">, pauseMs: number) => {
  const bytesPerFrame = meta.channels * (meta.bitsPerSample / 8);
  const frameCount = Math.max(0, Math.round((pauseMs / 1000) * meta.sampleRate));
  return new Uint8Array(frameCount * bytesPerFrame);
};

const buildSyntheticTranscript = (lines: VoiceJob["lines"], durations: number[]) => {
  const wordTimings: Array<{ id: string; word: string; start: number; end: number; speaker: "A" | "B" }> = [];
  const scriptLines: Array<{ id: string; speaker: "A" | "B"; text: string; startSec: number; endSec: number }> = [];

  let cursor = 0;

  lines.forEach((line, lineIndex) => {
    const words = line.text.trim().split(/\s+/).filter(Boolean);
    const duration = durations[lineIndex] ?? 0;
    const wordDuration = duration / Math.max(words.length, 1);
    const startSec = cursor;

    words.forEach((word, index) => {
      const start = cursor + index * wordDuration;
      const end = start + wordDuration;
      wordTimings.push({
        id: `${line.id}-word-${index + 1}`,
        word,
        start,
        end,
        speaker: line.speaker,
      });
    });
    cursor += duration;
    scriptLines.push({
      id: line.id,
      speaker: line.speaker,
      text: line.text,
      startSec,
      endSec: cursor,
    });

    cursor += line.pause_ms / 1000;
  });

  return { wordTimings, scriptLines };
};

const fetchFishAudio = async (body: Record<string, unknown>, apiKey: string) => {
  const delays = [1000, 2000, 4000];

  for (let attempt = 0; attempt < delays.length + 1; attempt += 1) {
    const response = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return Buffer.from(await response.arrayBuffer());
    }

    if (response.status === 429 && attempt < delays.length) {
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      continue;
    }

    const errorBody = await response.text();
    const userMessage = response.status === 401 ? "Your Fish.audio API key is invalid." : "Fish.audio could not generate the voice lines.";
    throw new AppError("fish_api_failed", errorBody || `Fish API failed with status ${response.status}`, userMessage, 502);
  }

  throw new AppError("fish_api_failed", "Fish API rate-limited all retries", "Fish.audio is rate limiting requests right now. Please try again shortly.", 429);
};

export const synthesizeFishAudioLine = async ({
  text,
  voiceId,
  emotion,
  speakingRate,
  apiKey,
}: {
  text: string;
  voiceId: string;
  emotion?: string;
  speakingRate?: number;
  apiKey: string;
}) => {
  return fetchFishAudio(
    {
      model_id: voiceId,
      text,
      format: "wav",
      emotion,
      speaking_rate: speakingRate ?? 1,
      chunk_length: 200,
      normalize: true,
    },
    apiKey,
  );
};

export async function dispatchColabVoiceJob(job: VoiceJob, presignedUrls: PresignedVoiceUrls) {
  const payload = voiceJobSchema.parse({ ...job, presignedUrls });

  if (!payload.colabUrl) {
    throw new AppError("colab_missing", "User has no configured Colab URL", "Add your Colab voice endpoint in settings first.", 400);
  }

  const response = await fetch(new URL("/voice/job", payload.colabUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AppError("colab_dispatch_failed", body || `Colab dispatch failed with status ${response.status}`, "Your Colab session appears offline or rejected the job.", 502);
  }

  return response.json();
}

export async function dispatchFishApiVoiceJob(job: VoiceJob, userFishKey: string) {
  const payload = voiceJobSchema.parse(job);

  if (!userFishKey) {
    throw new AppError("fish_key_missing", "Missing Fish.audio API key", "Add your Fish.audio API key in settings first.", 400);
  }

  let wavMeta: Pick<WavMeta, "sampleRate" | "channels" | "bitsPerSample"> | null = null;
  const masterChunks: Uint8Array[] = [];
  const durations: number[] = [];

  for (const line of payload.lines) {
    const speakerConfig = line.speaker === "A" ? payload.speakerA : payload.speakerB;

    if (!speakerConfig.modelId) {
      throw new AppError(
        "fish_model_missing",
        `Missing Fish model for speaker ${line.speaker}`,
        `Speaker ${line.speaker} is missing a Fish.audio model. Update your voice settings and try again.`,
        400,
      );
    }

    const audioBuffer = await fetchFishAudio(
      {
        model_id: speakerConfig.modelId,
        text: line.text,
        format: "wav",
        chunk_length: line.chunk_length,
        normalize: line.normalize,
        speaking_rate: line.speaking_rate,
        temperature: line.temperature,
      },
      userFishKey,
    );

    const parsedWav = parseWav(audioBuffer);

    if (!wavMeta) {
      wavMeta = {
        sampleRate: parsedWav.sampleRate,
        channels: parsedWav.channels,
        bitsPerSample: parsedWav.bitsPerSample,
      };
    }

    if (
      wavMeta.sampleRate !== parsedWav.sampleRate ||
      wavMeta.channels !== parsedWav.channels ||
      wavMeta.bitsPerSample !== parsedWav.bitsPerSample
    ) {
      throw new AppError("wav_incompatible", "Fish API returned WAV files with mismatched formats", "Generated voice lines used incompatible audio formats.", 502);
    }

    masterChunks.push(parsedWav.pcmData, createSilence(wavMeta, line.pause_ms));
    durations.push(parsedWav.durationSec);

    await uploadToPresignedUrl(payload.presignedUrls.lines[line.id], new Uint8Array(audioBuffer), "audio/wav");
  }

  const transcript = buildSyntheticTranscript(payload.lines, durations);
  await uploadToPresignedUrl(payload.presignedUrls.transcript, JSON.stringify(transcript.wordTimings), "application/json");

  if (wavMeta) {
    const masterWav = buildWav(wavMeta, masterChunks);
    await uploadToPresignedUrl(payload.presignedUrls.master, masterWav, "audio/wav");
  }

  return {
    stage: "voice_done",
    progressPct: 100,
    transcript,
  };
}
