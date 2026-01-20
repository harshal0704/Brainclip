import { z } from "zod";

import { AppError } from "@/lib/errors";
import { presignedGet, presignedPut, deleteObject, headObject, putObjectFromBuffer } from "@/lib/s3";

// Supported audio formats
export const SUPPORTED_AUDIO_FORMATS = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/ogg", "audio/webm", "audio/m4a", "audio/aac"] as const;
export const MAX_VOICE_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MIN_VOICE_DURATION_SEC = 3;
export const MAX_VOICE_DURATION_SEC = 300; // 5 minutes
export const IDEAL_VOICE_DURATION_SEC = 30; // Ideal for voice cloning

export const voiceUploadSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  language: z.string().default("en"),
  gender: z.enum(["male", "female", "neutral"]).optional(),
  tone: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(10).default([]),
  recommendedEmotion: z.string().default("neutral"),
  recommendedRate: z.number().min(0.5).max(2.0).default(1.0),
});

export type VoiceUploadInput = z.infer<typeof voiceUploadSchema>;

export const voiceUpdateSchema = voiceUploadSchema.partial().extend({
  isFavorite: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export type VoiceUpdateInput = z.infer<typeof voiceUpdateSchema>;

type AudioMetadata = {
  durationSec: number;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  format: string;
};

const readAscii = (view: DataView, offset: number, length: number) => {
  let output = "";
  for (let index = 0; index < length; index += 1) {
    output += String.fromCharCode(view.getUint8(offset + index));
  }
  return output;
};

/**
 * Parse WAV file to extract audio metadata
 */
export const parseWavMetadata = (buffer: Buffer): AudioMetadata => {
  const uint8 = new Uint8Array(buffer);
  const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);

  if (readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WAVE") {
    throw new AppError("invalid_wav", "Not a valid WAV file", "The uploaded file is not a valid WAV audio file.", 400);
  }

  let cursor = 12;
  let sampleRate = 44100;
  let channels = 1;
  let bitsPerSample = 16;
  let dataSize = 0;

  while (cursor + 8 <= view.byteLength) {
    const chunkId = readAscii(view, cursor, 4);
    const chunkSize = view.getUint32(cursor + 4, true);

    if (chunkId === "fmt ") {
      channels = view.getUint16(cursor + 10, true);
      sampleRate = view.getUint32(cursor + 12, true);
      bitsPerSample = view.getUint16(cursor + 22, true);
    }

    if (chunkId === "data") {
      dataSize = chunkSize;
    }

    cursor += 8 + chunkSize + (chunkSize % 2);
  }

  const bytesPerFrame = channels * (bitsPerSample / 8);
  const durationSec = dataSize / (sampleRate * bytesPerFrame);

  return {
    durationSec,
    sampleRate,
    channels,
    bitsPerSample,
    format: "wav",
  };
};

/**
 * Validate audio file for voice cloning requirements
 */
export const validateAudioForCloning = (metadata: AudioMetadata) => {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (metadata.durationSec < MIN_VOICE_DURATION_SEC) {
    issues.push(`Audio is too short (${metadata.durationSec.toFixed(1)}s). Minimum ${MIN_VOICE_DURATION_SEC}s required.`);
  }

  if (metadata.durationSec > MAX_VOICE_DURATION_SEC) {
    issues.push(`Audio is too long (${metadata.durationSec.toFixed(1)}s). Maximum ${MAX_VOICE_DURATION_SEC}s allowed.`);
  }

  if (metadata.sampleRate < 16000) {
    warnings.push(`Sample rate (${metadata.sampleRate}Hz) is below recommended 16kHz+. Quality may be reduced.`);
  }

  if (metadata.durationSec < IDEAL_VOICE_DURATION_SEC) {
    warnings.push(`For best voice cloning results, use ${IDEAL_VOICE_DURATION_SEC}+ seconds of clear speech.`);
  }

  return { issues, warnings, valid: issues.length === 0 };
};

/**
 * Generate S3 keys for voice assets
 */
export const generateVoiceS3Keys = (userId: string, voiceId: string) => ({
  referenceAudio: `voices/${voiceId}/reference.wav`,
  previewAudio: `voices/${voiceId}/preview.wav`,
  metadata: `voices/${voiceId}/metadata.json`,
});

/**
 * Generate presigned URLs for voice upload
 */
export const generateVoiceUploadUrls = async ({
  bucket,
  userId,
  voiceId,
  region,
}: {
  bucket: string;
  userId: string;
  voiceId: string;
  region?: string;
}) => {
  const keys = generateVoiceS3Keys(userId, voiceId);

  const [referenceUploadUrl, previewUploadUrl] = await Promise.all([
    presignedPut({
      bucket,
      key: keys.referenceAudio,
      expiresIn: 3600, // 1 hour
      contentType: "audio/wav",
      region,
    }),
    presignedPut({
      bucket,
      key: keys.previewAudio,
      expiresIn: 3600,
      contentType: "audio/wav",
      region,
    }),
  ]);

  return {
    keys,
    urls: {
      referenceUpload: referenceUploadUrl,
      previewUpload: previewUploadUrl,
    },
  };
};

/**
 * Generate presigned download URLs for voice playback
 */
export const generateVoiceDownloadUrls = async ({
  bucket,
  referenceKey,
  previewKey,
  region,
}: {
  bucket: string;
  referenceKey?: string | null;
  previewKey?: string | null;
  region?: string;
}) => {
  const urls: { reference?: string; preview?: string } = {};

  if (referenceKey) {
    urls.reference = await presignedGet({
      bucket,
      key: referenceKey,
      expiresIn: 3600,
      region,
    });
  }

  if (previewKey) {
    urls.preview = await presignedGet({
      bucket,
      key: previewKey,
      expiresIn: 3600,
      region,
    });
  }

  return urls;
};

/**
 * Delete voice assets from S3
 */
export const deleteVoiceAssets = async ({
  bucket,
  referenceKey,
  previewKey,
  region,
}: {
  bucket: string;
  referenceKey?: string | null;
  previewKey?: string | null;
  region?: string;
}) => {
  const deletions: Promise<void>[] = [];

  if (referenceKey) {
    deletions.push(deleteObject({ bucket, key: referenceKey, region }));
  }

  if (previewKey) {
    deletions.push(deleteObject({ bucket, key: previewKey, region }));
  }

  await Promise.allSettled(deletions);
};

/**
 * Check if voice reference audio exists in S3
 */
export const checkVoiceAudioExists = async ({
  bucket,
  key,
  region,
}: {
  bucket: string;
  key: string;
  region?: string;
}) => {
  try {
    await headObject({ bucket, key, region });
    return true;
  } catch {
    return false;
  }
};

/**
 * Fish.audio voice cloning API integration
 */
export const cloneVoiceWithFishAudio = async ({
  referenceAudioUrl,
  name,
  description,
  apiKey,
}: {
  referenceAudioUrl: string;
  name: string;
  description?: string;
  apiKey: string;
}) => {
  // Fetch the reference audio
  const audioResponse = await fetch(referenceAudioUrl);
  if (!audioResponse.ok) {
    throw new AppError("audio_fetch_failed", "Failed to fetch reference audio", "Could not retrieve your uploaded audio. Please try again.", 500);
  }

  const audioBlob = await audioResponse.blob();

  // Create FormData for Fish.audio API
  const formData = new FormData();
  formData.append("audio", audioBlob, "reference.wav");
  formData.append("name", name);
  if (description) {
    formData.append("description", description);
  }

  // Call Fish.audio clone endpoint
  const response = await fetch("https://api.fish.audio/v1/voice/clone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    
    if (response.status === 401) {
      throw new AppError("fish_auth_failed", errorText, "Your Fish.audio API key is invalid.", 401);
    }
    
    if (response.status === 429) {
      throw new AppError("fish_rate_limited", errorText, "Fish.audio is rate limiting requests. Please try again later.", 429);
    }

    throw new AppError("fish_clone_failed", errorText, "Voice cloning failed. Please try a different audio sample.", 502);
  }

  const result = await response.json();

  return {
    modelId: result.id || result.model_id,
    status: "ready",
  };
};

/**
 * Generate a short preview audio clip from reference
 * This creates a 5-10 second trimmed version for quick playback
 */
export const generatePreviewFromReference = (referenceBuffer: Buffer, maxDurationSec = 10): Buffer => {
  const metadata = parseWavMetadata(referenceBuffer);
  const bytesPerSecond = metadata.sampleRate * metadata.channels * (metadata.bitsPerSample / 8);
  const headerSize = 44;
  
  // If already short enough, return as-is
  if (metadata.durationSec <= maxDurationSec) {
    return referenceBuffer;
  }

  // Calculate bytes for preview duration
  const previewBytes = Math.floor(maxDurationSec * bytesPerSecond);
  const totalSize = headerSize + previewBytes;

  // Create new buffer with truncated audio
  const preview = Buffer.alloc(totalSize);
  
  // Copy header
  referenceBuffer.copy(preview, 0, 0, headerSize);
  
  // Update data chunk size in header
  const view = new DataView(preview.buffer, preview.byteOffset, preview.byteLength);
  view.setUint32(4, totalSize - 8, true); // RIFF chunk size
  view.setUint32(40, previewBytes, true); // data chunk size
  
  // Copy audio data
  referenceBuffer.copy(preview, headerSize, headerSize, headerSize + previewBytes);

  return preview;
};

/**
 * Normalize audio to consistent format (16-bit, 44.1kHz, mono)
 * This is a simplified version - full implementation would use ffmpeg
 */
export const normalizeAudioFormat = async (buffer: Buffer): Promise<Buffer> => {
  // For now, just validate it's a proper WAV
  // Full normalization would require ffmpeg or similar
  const metadata = parseWavMetadata(buffer);
  
  if (metadata.format !== "wav") {
    throw new AppError("unsupported_format", "Only WAV files are currently supported", "Please upload a WAV audio file.", 400);
  }

  return buffer;
};
