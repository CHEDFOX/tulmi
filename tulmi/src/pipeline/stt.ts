/**
 * Speech-to-text via Groq's Whisper API.
 */
import Groq, { toFile } from "groq-sdk";
import { getConfig } from "../config.js";
import type { AudioFormat, LanguageHint } from "../../../shared/types/api.js";

let client: Groq | null = null;
function groq(): Groq {
  if (!client) client = new Groq({ apiKey: getConfig().GROQ_API_KEY });
  return client;
}

/** Map our language hint to a Whisper ISO-639-1 code (or undefined = auto-detect). */
function whisperLanguage(hint: LanguageHint | undefined): string | undefined {
  switch (hint) {
    case "hi":
      return "hi";
    case "en":
      return "en";
    // "hinglish" + "auto" → let Whisper auto-detect; it handles code-switching
    // far better than being pinned to one language.
    default:
      return undefined;
  }
}

export interface SttResult {
  text: string;
  /** Audio length in seconds, used for usage metering. */
  durationSeconds: number;
}

export interface SttInput {
  audio: Buffer;
  format: AudioFormat;
  language?: LanguageHint;
}

/**
 * Transcribe an audio buffer. Uses verbose_json so we get the audio duration
 * back for metering.
 */
export async function transcribe(input: SttInput): Promise<SttResult> {
  const cfg = getConfig();
  const file = await toFile(input.audio, `audio.${input.format}`);

  const res = (await groq().audio.transcriptions.create({
    file,
    model: cfg.GROQ_STT_MODEL,
    language: whisperLanguage(input.language),
    response_format: "verbose_json",
    // A gentle prompt nudges Whisper toward correct spelling of code-switched
    // Hindi/English without forcing translation.
    prompt: "Mixed Hindi and English (Hinglish) is expected.",
  })) as { text: string; duration?: number };

  return {
    text: (res.text ?? "").trim(),
    durationSeconds: typeof res.duration === "number" ? res.duration : 0,
  };
}
