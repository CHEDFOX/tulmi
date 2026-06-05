/**
 * Flow — API contract (source of truth).
 *
 * This file defines the shape of every request/response between the clients
 * (Android keyboard, later iOS) and the backend. Keep it framework-free so it
 * can be imported by the backend directly and mirrored by the Android app.
 */

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

/** Audio container the client is sending. */
export type AudioFormat = "wav" | "m4a" | "webm" | "mp3" | "ogg" | "flac";

/**
 * Language hint for transcription + cleanup.
 * - "auto"     : let the model detect (default; best for spontaneous speech)
 * - "hi"       : primarily Hindi
 * - "en"       : primarily English
 * - "hinglish" : explicit Hindi/English code-switching
 */
export type LanguageHint = "auto" | "hi" | "en" | "hinglish";

/**
 * What the user is typing into, used to adapt tone/format.
 * Free-form on the wire (any app name), but these are the ones we tune for.
 */
export type TargetAppHint =
  | "WhatsApp"
  | "Slack"
  | "Gmail"
  | "Email"
  | "Messages"
  | "Notes"
  | "Search"
  | "Code"
  | "Generic"
  | (string & {});

/** Usage we record per request for metering / free-tier enforcement. */
export interface UsageRecord {
  /** Length of audio processed, in seconds (the primary meter). */
  audioSeconds: number;
  /** Word count of the cleaned output (secondary meter). */
  words: number;
  /** Cleanup model that produced the output, e.g. "anthropic/claude-haiku-4.5". */
  model: string;
}

/** Options that shape a cleanup request (shared by REST + WS). */
export interface CleanupOptions {
  /** App the user is typing into; drives tone + formatting. Default "Generic". */
  targetApp?: TargetAppHint;
  /** Language hint. Default "auto". */
  language?: LanguageHint;
}

// ---------------------------------------------------------------------------
// REST: one-shot transcribe + clean  (POST /v1/transcribe-clean)
// ---------------------------------------------------------------------------
//
// Sent as multipart/form-data:
//   - field "audio": the audio file
//   - field "targetApp" (optional)
//   - field "language"  (optional)
//
// This is the simplest path: upload a whole clip, get polished text back. It is
// what the test script and early Android builds use before live streaming.

export interface TranscribeCleanResponse {
  /** The polished, insert-ready text. */
  cleanedText: string;
  /** The raw STT output, before cleanup (useful for debugging/QA). */
  transcript: string;
  usage: UsageRecord;
}

// ---------------------------------------------------------------------------
// WebSocket: live streaming  (wss://host/v1/stream)
// ---------------------------------------------------------------------------
//
// Sequence:
//   1. client → { type: "start", ... }
//   2. client → binary audio frames (raw bytes of the chosen format)
//   3. client → { type: "end" }
//   4. server → "transcript" (once), then "cleaned_delta" (many), then "done"
//   Any time → server may send "error".

export const WS_PATH = "/v1/stream";

/** Control messages the client sends (JSON). Audio itself is sent as binary frames. */
export type ClientMessage =
  | ({
      type: "start";
      format: AudioFormat;
      /** Sample rate of the audio being streamed, e.g. 16000. */
      sampleRate: number;
    } & CleanupOptions)
  | { type: "end" };

/** Messages the server sends back (JSON). */
export type ServerMessage =
  | { type: "ready" } // server accepted "start", client may begin sending audio
  | { type: "transcript"; text: string } // raw STT result
  | { type: "cleaned_delta"; text: string } // incremental cleaned tokens
  | { type: "done"; cleanedText: string; usage: UsageRecord }
  | { type: "error"; code: ErrorCode; message: string };

export type ErrorCode =
  | "unauthorized"
  | "quota_exceeded"
  | "bad_request"
  | "audio_too_long"
  | "stt_failed"
  | "cleanup_failed"
  | "internal";

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: "ok";
  service: "flow-backend";
  version: string;
}
