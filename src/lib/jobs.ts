import { z } from "zod";

import { generatedScriptLineSchema } from "@/lib/scriptGen";
import { getObjectJson, presignedGet, presignedPut } from "@/lib/s3";

export const speakerSchema = z.object({
  label: z.string().min(1),
  stickerUrl: z.string().default(""),
  color: z.string().default("#ffffff"),
  position: z.enum(["top", "bottom"]).default("top"),
  modelId: z.string().optional(),
});

export const reactionStickerSchema = z.object({
  emoji: z.string(),
  x: z.number(),
  y: z.number(),
  wordId: z.string(),
  anim: z.enum(["pop-fade", "fly-in", "bounce-out"]),
});

export const editConfigSchema = z.object({
  stickerAnim: z.enum(["bounce", "slide", "float", "pulse", "shake", "static"]).default("bounce"),
  subtitleFont: z.string().default("Georgia, serif"),
  subtitleSize: z.number().default(46),
  subtitleFill: z.string().default("#f8f4ed"),
  subtitleStroke: z.string().default("#091018"),
  subtitleHighlight: z.string().default("#66e0ff"),
  subtitleY: z.number().default(70),
  bgDimOpacity: z.number().default(0.34),
  bgColorOverlay: z.string().nullable().default("#0b1630"),
  bgBlendMode: z.string().default("screen"),
  speakerLayout: z.enum(["top-bottom", "left-right"]).default("top-bottom"),
  stickerSizeA: z.number().default(150),
  stickerSizeB: z.number().default(150),
  stickerShape: z.enum(["circle", "rounded-square", "hexagon"]).default("circle"),
  introAnim: z.enum(["none", "zoom-in", "slide-up", "fade"]).default("fade"),
  animSpeed: z.number().default(1),
  showProgressBar: z.boolean().default(true),
  ctaText: z.string().nullable().default(null),
  ctaStartSec: z.number().default(0),
  reactionStickers: z.array(reactionStickerSchema).default([]),
});

const defaultEditConfig: z.infer<typeof editConfigSchema> = {
  stickerAnim: "bounce",
  subtitleFont: "Georgia, serif",
  subtitleSize: 46,
  subtitleFill: "#f8f4ed",
  subtitleStroke: "#091018",
  subtitleHighlight: "#66e0ff",
  subtitleY: 70,
  bgDimOpacity: 0.34,
  bgColorOverlay: "#0b1630",
  bgBlendMode: "screen",
  speakerLayout: "top-bottom",
  stickerSizeA: 150,
  stickerSizeB: 150,
  stickerShape: "circle",
  introAnim: "fade",
  animSpeed: 1,
  showProgressBar: true,
  ctaText: null,
  ctaStartSec: 0,
  reactionStickers: [],
};

export const createJobInputSchema = z.object({
  scriptLines: z.array(generatedScriptLineSchema).min(1),
  voiceMode: z.enum(["colab", "fish-api"]),
  backgroundUrl: z.string().default(""),
  subtitleStyle: z
    .enum([
      "pop-highlight",
      "word-fade",
      "karaoke",
      "sentence-reveal",
      "typewriter",
      "pill-word",
      "cinematic-shadow",
      "outline-bold",
    ])
    .default("pop-highlight"),
  resolution: z.enum(["720p", "480p"]).default("720p"),
  speakerA: speakerSchema,
  speakerB: speakerSchema,
  editConfig: editConfigSchema.default(defaultEditConfig),
});

const apiVoiceMapSchema = z.record(z.string(), z.unknown());

const requestedCreateJobSchema = z.object({
  topic: z.string().min(1),
  duoId: z.string().min(1),
  scriptLines: z.array(generatedScriptLineSchema).min(1),
  voiceMap: apiVoiceMapSchema,
  subtitleStyleId: z.string().min(1),
  backgroundUrl: z.string().url().or(z.literal("")).optional().nullable(),
  editConfig: z.record(z.string(), z.unknown()).default({}),
  resolution: z.enum(["720p", "480p"]).optional(),
});

const legacyCreateJobSchema = createJobInputSchema.extend({
  topic: z.string().optional(),
  duoId: z.string().optional(),
});

export const appRouterCreateJobSchema = z.union([requestedCreateJobSchema, legacyCreateJobSchema]);

export type NormalizedCreateJobInput = {
  topic: string;
  duoId: string;
  scriptLines: z.infer<typeof generatedScriptLineSchema>[];
  voiceMap: Record<string, unknown>;
  subtitleStyleId: string;
  backgroundUrl: string;
  editConfig: Record<string, unknown>;
  resolution: "720p" | "480p";
};

export const normalizeCreateJobInput = (input: z.input<typeof appRouterCreateJobSchema>): NormalizedCreateJobInput => {
  const parsed = appRouterCreateJobSchema.parse(input);

  if ("voiceMap" in parsed) {
    return {
      topic: parsed.topic,
      duoId: parsed.duoId,
      scriptLines: parsed.scriptLines,
      voiceMap: parsed.voiceMap,
      subtitleStyleId: parsed.subtitleStyleId,
      backgroundUrl: parsed.backgroundUrl ?? "",
      editConfig: parsed.editConfig,
      resolution: parsed.resolution ?? "720p",
    };
  }

  return {
    topic: parsed.topic ?? "",
    duoId: parsed.duoId ?? "custom",
    scriptLines: parsed.scriptLines,
    voiceMap: {
      mode: parsed.voiceMode,
      speakerA: parsed.speakerA,
      speakerB: parsed.speakerB,
    },
    subtitleStyleId: parsed.subtitleStyle,
    backgroundUrl: parsed.backgroundUrl,
    editConfig: parsed.editConfig,
    resolution: parsed.resolution,
  };
};

export const buildPresignedVoiceUrls = async (bucket: string, jobId: string, region?: string) => {
  const lineKeys = {} as Record<string, string>;
  const linePuts = {} as Record<string, string>;

  return {
    keys: {
      lines: lineKeys,
      master: `audio/${jobId}/master.wav`,
      transcript: `transcripts/${jobId}/words.json`,
    },
    puts: {
      lines: linePuts,
      master: await presignedPut({ bucket, key: `audio/${jobId}/master.wav`, contentType: "audio/wav", region }),
      transcript: await presignedPut({ bucket, key: `transcripts/${jobId}/words.json`, contentType: "application/json", region }),
    },
  };
};

export const addLinePresignedUrl = async (
  bucket: string,
  jobId: string,
  lineId: string,
  region?: string,
) => {
  const key = `audio/${jobId}/${lineId}.wav`;
  const url = await presignedPut({ bucket, key, contentType: "audio/wav", region });
  return { key, url };
};

export const buildJobPresignedOutputs = async ({
  bucket,
  jobId,
  lineIds,
  region,
}: {
  bucket: string;
  jobId: string;
  lineIds: string[];
  region?: string;
}) => {
  const voice = await buildPresignedVoiceUrls(bucket, jobId, region);
  const audioFiles: Record<string, { key: string; url: string }> = {};

  for (const lineId of lineIds) {
    const line = await addLinePresignedUrl(bucket, jobId, lineId, region);
    audioFiles[lineId] = line;
  }

  const finalVideoKey = `videos/${jobId}/final.mp4`;
  const finalVideoUrl = await presignedPut({
    bucket,
    key: finalVideoKey,
    contentType: "video/mp4",
    region,
  });

  return {
    keys: {
      audioFiles: Object.fromEntries(Object.entries(audioFiles).map(([lineId, value]) => [lineId, value.key])),
      masterAudio: voice.keys.master,
      transcriptJson: voice.keys.transcript,
      finalVideo: finalVideoKey,
    },
    urls: {
      audioFiles: Object.fromEntries(Object.entries(audioFiles).map(([lineId, value]) => [lineId, value.url])),
      masterAudio: voice.puts.master,
      transcriptJson: voice.puts.transcript,
      finalVideo: finalVideoUrl,
    },
  };
};

const asRecord = (value: unknown) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

export const getSpeakerConfigsFromVoiceMap = (voiceMap: Record<string, unknown>) => {
  const speakerA = asRecord(voiceMap.speakerA ?? voiceMap.A);
  const speakerB = asRecord(voiceMap.speakerB ?? voiceMap.B);

  return {
    speakerA,
    speakerB,
  };
};

export type HydratedWordTiming = {
  id?: string;
  word: string;
  start: number;
  end: number;
  speaker: "A" | "B";
};

export const hydrateScriptLineTimings = (
  scriptLines: Array<{ id?: string; speaker: "A" | "B"; text: string }>,
  wordTimings: HydratedWordTiming[],
) => {
  let cursor = 0;

  return scriptLines.map((line, index) => {
    const expectedWordCount = line.text.trim().split(/\s+/).filter(Boolean).length;
    const matchingWords = wordTimings.slice(cursor).filter((word) => word.speaker === line.speaker).slice(0, expectedWordCount || 1);

    if (matchingWords.length > 0) {
      cursor += matchingWords.length;
      return {
        id: line.id ?? `line_${String(index + 1).padStart(3, "0")}`,
        speaker: line.speaker,
        text: line.text,
        startSec: matchingWords[0].start,
        endSec: matchingWords[matchingWords.length - 1].end,
      };
    }

    const previousEnd = index === 0 ? 0 : wordTimings[Math.max(0, cursor - 1)]?.end ?? 0;
    return {
      id: line.id ?? `line_${String(index + 1).padStart(3, "0")}`,
      speaker: line.speaker,
      text: line.text,
      startSec: previousEnd,
      endSec: previousEnd + 1.5,
    };
  });
};

export const buildRenderInputProps = async ({
  bucket,
  region,
  backgroundUrl,
  subtitleStyle,
  editConfig,
  speakerA,
  speakerB,
  scriptLines,
  s3AudioKeys,
  transcriptKey,
  resolution,
}: {
  bucket: string;
  region?: string;
  backgroundUrl: string | null;
  subtitleStyle: string | null;
  editConfig: Record<string, unknown>;
  speakerA: Record<string, unknown>;
  speakerB: Record<string, unknown>;
  scriptLines: Array<{ id?: string; speaker: "A" | "B"; text: string }>;
  s3AudioKeys: Record<string, string>;
  transcriptKey: string | null;
  resolution: "720p" | "480p";
}) => {
  const audioKey = s3AudioKeys.master ?? Object.values(s3AudioKeys)[0] ?? "";
  const wordTimings = transcriptKey ? await getObjectJson<HydratedWordTiming[]>({ bucket, key: transcriptKey, region }) : [];
  const hydratedLines = hydrateScriptLineTimings(scriptLines, wordTimings);

  return {
    audioSrc: audioKey ? await presignedGet({ bucket, key: audioKey, region, expiresIn: 3600 }) : "",
    backgroundSrc: backgroundUrl ?? "",
    wordTimings,
    scriptLines: hydratedLines,
    speakerA,
    speakerB,
    subtitleStyle: subtitleStyle ?? "pop-highlight",
    editConfig,
    resolution,
  };
};

export const getJobPhase = (status: string, stage: string | null, progressPct: number) => {
  switch (status) {
    case "pending":
      return { label: "Pending", userMessage: "Your job is queued and waiting to start.", progressPct };
    case "voice_processing":
      return { label: "Voice", userMessage: stage ?? "Generating voice tracks and transcript.", progressPct };
    case "voice_done":
      return { label: "Voice Complete", userMessage: "Voice assets are ready. Starting render.", progressPct };
    case "rendering":
      return { label: "Rendering", userMessage: stage ?? "Rendering the final video with Remotion Lambda.", progressPct };
    case "done":
      return { label: "Done", userMessage: "Your video is ready.", progressPct };
    default:
      return { label: "Failed", userMessage: stage ?? "This job needs attention.", progressPct };
  }
};
