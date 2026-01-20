import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { customVoices } from "@/db/schema";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";
import { putObjectFromBuffer } from "@/lib/s3";
import { requireUserFromRequest } from "@/lib/session";
import {
  voiceUploadSchema,
  generateVoiceS3Keys,
  parseWavMetadata,
  validateAudioForCloning,
  generatePreviewFromReference,
  MAX_VOICE_FILE_SIZE,
  SUPPORTED_AUDIO_FORMATS,
} from "@/lib/voiceUpload";

/**
 * POST /api/voices/upload
 * Direct upload endpoint - accepts multipart form data with audio file
 * This is an alternative to the presigned URL flow for simpler integrations
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);

    if (!user.s3Bucket) {
      throw new AppError(
        "bucket_missing",
        "User has no S3 bucket",
        "Your storage bucket is not provisioned. Sign out and back in.",
        400,
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const metadataJson = formData.get("metadata") as string | null;

    if (!audioFile) {
      throw new AppError(
        "no_audio_file",
        "No audio file provided",
        "Please select an audio file to upload.",
        400,
      );
    }

    // Validate file type
    if (!SUPPORTED_AUDIO_FORMATS.includes(audioFile.type as typeof SUPPORTED_AUDIO_FORMATS[number])) {
      throw new AppError(
        "invalid_file_type",
        `Unsupported file type: ${audioFile.type}`,
        `Supported formats: WAV, MP3, OGG, WebM, M4A, AAC`,
        400,
      );
    }

    // Validate file size
    if (audioFile.size > MAX_VOICE_FILE_SIZE) {
      throw new AppError(
        "file_too_large",
        `File size ${audioFile.size} exceeds limit`,
        `Maximum file size is ${MAX_VOICE_FILE_SIZE / 1024 / 1024}MB.`,
        400,
      );
    }

    // Parse metadata
    let metadata = { name: audioFile.name.replace(/\.[^/.]+$/, "") };
    if (metadataJson) {
      try {
        const parsed = voiceUploadSchema.parse(JSON.parse(metadataJson));
        metadata = { ...metadata, ...parsed };
      } catch {
        // Use default metadata if parsing fails
      }
    }

    // Check voice limit
    const existingCount = await db
      .select({ id: customVoices.id })
      .from(customVoices)
      .where(eq(customVoices.userId, user.id));

    if (existingCount.length >= 50) {
      throw new AppError(
        "voice_limit_reached",
        "User has reached maximum voice limit",
        "You can have up to 50 custom voices. Delete some to add more.",
        400,
      );
    }

    const voiceId = crypto.randomUUID();
    const keys = generateVoiceS3Keys(user.id, voiceId);

    // Read file buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse and validate audio
    let audioMetadata;
    let validationResult = { valid: true, issues: [] as string[], warnings: [] as string[] };

    try {
      audioMetadata = parseWavMetadata(buffer);
      validationResult = validateAudioForCloning(audioMetadata);
    } catch (parseError) {
      // For non-WAV files, set default metadata
      // In production, you'd use ffprobe or similar
      audioMetadata = {
        durationSec: 0,
        sampleRate: 44100,
        channels: 1,
        bitsPerSample: 16,
        format: audioFile.type.split("/")[1] || "unknown",
      };
      validationResult.warnings.push("Audio metadata could not be fully parsed. Quality may vary.");
    }

    // Upload reference audio to S3
    await putObjectFromBuffer({
      bucket: user.s3Bucket,
      key: keys.referenceAudio,
      body: buffer,
      contentType: audioFile.type || "audio/wav",
      region: user.s3Region,
    });

    // Generate and upload preview (trimmed version)
    let previewKey = null;
    if (audioMetadata.format === "wav" && audioMetadata.durationSec > 10) {
      try {
        const previewBuffer = generatePreviewFromReference(buffer, 10);
        await putObjectFromBuffer({
          bucket: user.s3Bucket,
          key: keys.previewAudio,
          body: previewBuffer,
          contentType: "audio/wav",
          region: user.s3Region,
        });
        previewKey = keys.previewAudio;
      } catch {
        // Preview generation failed, that's okay
      }
    } else {
      previewKey = keys.referenceAudio; // Use reference as preview if short
    }

    // Create database record
    const [createdVoice] = await db
      .insert(customVoices)
      .values({
        id: voiceId,
        userId: user.id,
        name: metadata.name,
        description: "description" in metadata ? (metadata as { description?: string }).description : undefined,
        source: "upload",
        referenceAudioKey: keys.referenceAudio,
        previewAudioKey: previewKey,
        durationSec: audioMetadata.durationSec,
        sampleRate: audioMetadata.sampleRate,
        format: audioMetadata.format,
        fileSizeBytes: audioFile.size,
        language: "language" in metadata ? (metadata as { language?: string }).language : "en",
        gender: "gender" in metadata ? (metadata as { gender?: string }).gender : undefined,
        tone: "tone" in metadata ? (metadata as { tone?: string }).tone : undefined,
        tags: "tags" in metadata ? (metadata as { tags?: string[] }).tags ?? [] : [],
        recommendedEmotion: "recommendedEmotion" in metadata ? (metadata as { recommendedEmotion?: string }).recommendedEmotion : "neutral",
        recommendedRate: "recommendedRate" in metadata ? (metadata as { recommendedRate?: number }).recommendedRate : 1.0,
        fishCloneStatus: validationResult.valid ? "pending" : "invalid",
      })
      .returning();

    return NextResponse.json({
      voice: createdVoice,
      validation: validationResult,
      nextSteps: validationResult.valid
        ? {
            message: "Voice uploaded successfully! You can now clone it or use the reference audio directly.",
            cloneEndpoint: `/api/voices/custom/${voiceId}/clone`,
          }
        : {
            message: "Voice uploaded with warnings. Review the issues before cloning.",
            issues: validationResult.issues,
            warnings: validationResult.warnings,
          },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
