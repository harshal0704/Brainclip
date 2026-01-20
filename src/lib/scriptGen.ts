import OpenAI from "openai";
import { z } from "zod";

import { AppError } from "@/lib/errors";

const emotions = ["neutral", "happy", "sad", "angry", "surprised", "excited", "whispering", "shouting"] as const;

export const scriptRequestSchema = z.object({
  topic: z.string().min(3),
  speakerAPersona: z.string().min(1),
  speakerBPersona: z.string().min(1),
  tone: z.string().min(2),
  language: z.string().min(1).default("en"),
  tempA: z.number().min(0).max(2).default(0.7),
  tempB: z.number().min(0).max(2).default(0.7),
});

export const generatedScriptLineSchema = z.object({
  id: z.string().regex(/^line_\d{3}$/),
  speaker: z.enum(["A", "B"]),
  text: z.string().min(1),
  emotion: z.enum(emotions),
  speaking_rate: z.number().min(0.75).max(1.25),
  pause_ms: z.number().int().min(150).max(800),
  temperature: z.number().min(0).max(2),
  chunk_length: z.literal(200),
  normalize: z.literal(true),
});

export const generateScriptParamsSchema = scriptRequestSchema.extend({
  llmApiKey: z.string().min(1),
  llmModel: z.string().min(1),
  llmBaseUrl: z.string().url().optional().default("https://api.openai.com/v1"),
});

export type ScriptRequest = z.infer<typeof scriptRequestSchema>;
export type ScriptLine = z.infer<typeof generatedScriptLineSchema>;
export type GenerateScriptParams = z.infer<typeof generateScriptParamsSchema>;

const SYSTEM_PROMPT = `You are a short-form video script writer specialising in engaging duo dialogue reels.
Generate a natural conversation between Speaker A and Speaker B on the given topic.
Output ONLY a valid JSON array of ScriptLine objects. No markdown, no code fences, no preamble, no explanation.

Each object in the array must include EXACTLY these fields:
- id: line_001 through line_020
- speaker: A or B
- text: natural spoken line, 8-25 words, contractions allowed
- emotion: one of neutral, happy, sad, angry, surprised, excited, whispering, shouting
- speaking_rate: float 0.75-1.25
- pause_ms: integer 150-800
- temperature: use the speaker default temperature provided by the user message
- chunk_length: always 200
- normalize: always true

Writing rules:
1. Total lines: 14-20.
2. Alternate speakers. No speaker has 3 or more consecutive lines.
3. Line 1 is a hook: surprising fact, bold claim, or curiosity question.
4. Lines 1-3 should feel fast. Last 2 lines should slow down to 0.82-0.88.
5. Keep the language natural, memorable, and spoken aloud.
6. End with a closing thought that invites the viewer to react, think, or share.
7. Never include profanity, copyrighted quotes, or medical or legal advice.
8. Return only the raw JSON array.`;

const rawLineSchema = z.record(z.string(), z.unknown());
const rawResponseSchema = z.array(rawLineSchema);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toWordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const splitLongLine = (text: string, maxWords: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return [text.trim()];
  }

  const parts: string[] = [];

  for (let index = 0; index < words.length; index += maxWords) {
    parts.push(words.slice(index, index + maxWords).join(" "));
  }

  return parts;
};

const stripJsonWrapper = (raw: string) => {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");

  if (start === -1 || end === -1 || end < start) {
    throw new AppError(
      "llm_invalid_json",
      "LLM response did not contain a JSON array",
      "Script generation failed because the model did not return valid JSON.",
      502,
    );
  }

  return raw.slice(start, end + 1);
};

const getDefaultSpeakingRate = (index: number, total: number) => {
  if (index >= total - 2) {
    return 0.85;
  }

  if (index < 3) {
    return 1.1;
  }

  return 1;
};

const normalizeScriptLines = (input: unknown, params: GenerateScriptParams): ScriptLine[] => {
  const parsed = rawResponseSchema.parse(input);
  const expanded: ScriptLine[] = [];

  for (const [index, rawLine] of parsed.entries()) {
    const speaker = rawLine.speaker === "B" ? "B" : "A";
    const text = typeof rawLine.text === "string" ? rawLine.text.trim() : "";

    if (!text) {
      throw new AppError("llm_invalid_line", `Line ${index + 1} is missing text`, "Script generation returned an invalid line.", 502);
    }

    const emotion = typeof rawLine.emotion === "string" && emotions.includes(rawLine.emotion as (typeof emotions)[number])
      ? (rawLine.emotion as (typeof emotions)[number])
      : "neutral";

    const pauseMs = typeof rawLine.pause_ms === "number" ? Math.round(clamp(rawLine.pause_ms, 150, 800)) : 250;
    const speakingRate = typeof rawLine.speaking_rate === "number" ? clamp(rawLine.speaking_rate, 0.75, 1.25) : 1;
    const temperature = speaker === "A" ? params.tempA : params.tempB;

    for (const splitText of splitLongLine(text, 30)) {
      expanded.push({
        id: `line_${String(expanded.length + 1).padStart(3, "0")}`,
        speaker,
        text: splitText,
        emotion,
        speaking_rate: speakingRate,
        pause_ms: pauseMs,
        temperature,
        chunk_length: 200,
        normalize: true,
      });
    }
  }

  if (expanded.length < 12 || expanded.length > 20) {
    throw new AppError(
      "llm_invalid_line_count",
      `Script contains ${expanded.length} lines after normalization`,
      "Script generation returned the wrong number of lines. Please try again.",
      502,
    );
  }

  const normalized = expanded.map((line, index, lines) => ({
    ...line,
    id: `line_${String(index + 1).padStart(3, "0")}`,
    speaking_rate: getDefaultSpeakingRate(index, lines.length) === 0.85
      ? 0.85
      : clamp(line.speaking_rate || getDefaultSpeakingRate(index, lines.length), 0.75, 1.25),
  }));

  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index]?.speaker === normalized[index - 1]?.speaker) {
      throw new AppError(
        "llm_invalid_speaker_order",
        "Script lines do not alternate speakers",
        "Script generation returned invalid speaker alternation. Please try again.",
        502,
      );
    }
  }

  for (const [index, line] of normalized.entries()) {
    if (toWordCount(line.text) > 30) {
      throw new AppError(
        "llm_line_too_long",
        `Line ${index + 1} still exceeds 30 words`,
        "Script generation returned a line that is too long. Please try again.",
        502,
      );
    }

    generatedScriptLineSchema.parse(line);
  }

  return normalized;
};

const callLlm = async (params: GenerateScriptParams, temperature = 0.7, retryInstruction?: string) => {
  const client = new OpenAI({
    apiKey: params.llmApiKey,
    baseURL: params.llmBaseUrl,
  });

  const response = await client.chat.completions.create({
    model: params.llmModel,
    temperature,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          retryInstruction ?? "",
          `Topic: ${params.topic}`,
          `Speaker A persona: ${params.speakerAPersona}`,
          `Speaker B persona: ${params.speakerBPersona}`,
          `Tone: ${params.tone}`,
          `Language: ${params.language}`,
          `Speaker A default temperature: ${params.tempA}`,
          `Speaker B default temperature: ${params.tempB}`,
        ].filter(Boolean).join("\n"),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new AppError("llm_empty_response", "LLM returned an empty response", "Script generation returned no content.", 502);
  }

  return content;
};

export async function generateScript(input: GenerateScriptParams): Promise<ScriptLine[]> {
  const params = generateScriptParamsSchema.parse(input);

  const attempt = async (temperature: number, retryInstruction?: string) => {
    const rawContent = await callLlm(params, temperature, retryInstruction);
    const stripped = stripJsonWrapper(rawContent);
    return normalizeScriptLines(JSON.parse(stripped), params);
  };

  try {
    return await attempt(0.7);
  } catch (error) {
    if (error instanceof AppError) {
      if (["llm_invalid_json", "llm_invalid_line_count", "llm_invalid_speaker_order", "llm_line_too_long", "llm_invalid_line"].includes(error.code)) {
        try {
          return await attempt(0.8, "Your previous response was invalid. Output ONLY the raw JSON array and follow every schema rule exactly.");
        } catch (retryError) {
          if (retryError instanceof AppError) {
            throw retryError;
          }
          throw retryError;
        }
      }

      throw error;
    }

    if (error instanceof SyntaxError) {
      try {
        return await attempt(0.8, "Your previous response was malformed. Output ONLY the raw JSON array and no extra text.");
      } catch {
        throw new AppError("llm_invalid_json", error.message, "Script generation failed because the model returned malformed JSON.", 502);
      }
    }

    throw new AppError(
      "llm_failed",
      error instanceof Error ? error.message : "Unknown LLM error",
      "Script generation failed. Please try a different topic or model.",
      502,
    );
  }
}
