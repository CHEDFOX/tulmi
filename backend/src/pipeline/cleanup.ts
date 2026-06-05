/**
 * Cleanup stage: turn a raw transcript into polished, insert-ready text via an
 * OpenRouter chat model (default: anthropic/claude-haiku-4.5, swappable via env).
 *
 * The system prompt is loaded from shared/prompts/cleanup.<version>.md and has
 * its {{TARGET_APP}} / {{LANGUAGE}} placeholders filled per request.
 */
import OpenAI from "openai";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getConfig } from "../config.js";
import type { CleanupOptions } from "../../../shared/types/api.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let client: OpenAI | null = null;
function openrouter(): OpenAI {
  if (!client) {
    const cfg = getConfig();
    client = new OpenAI({
      apiKey: cfg.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": cfg.OPENROUTER_APP_URL,
        "X-Title": cfg.OPENROUTER_APP_NAME,
      },
    });
  }
  return client;
}

// --- Prompt loading (cached per version) -----------------------------------

const promptCache = new Map<string, string>();

function loadPromptTemplate(): string {
  const version = getConfig().CLEANUP_PROMPT_VERSION;
  const cached = promptCache.get(version);
  if (cached) return cached;

  const file = `cleanup.${version}.md`;
  // Resolve the prompt across layouts: dev (src/) vs built (dist/), plus an
  // explicit override and a cwd-relative fallback. First existing wins.
  const candidates = [
    process.env.FLOW_SHARED_DIR &&
      resolve(process.env.FLOW_SHARED_DIR, "prompts", file),
    resolve(__dirname, "..", "..", "..", "shared", "prompts", file), // backend/src/pipeline → repo/shared
    resolve(__dirname, "..", "..", "..", "..", "shared", "prompts", file), // dist/backend/src/pipeline → repo/shared
    resolve(process.cwd(), "..", "shared", "prompts", file), // run from backend/
    resolve(process.cwd(), "shared", "prompts", file), // run from repo root
  ].filter(Boolean) as string[];

  const path = candidates.find((p) => existsSync(p));
  if (!path) {
    throw new Error(
      `Could not find cleanup prompt "${file}". Looked in:\n` +
        candidates.map((p) => `  - ${p}`).join("\n") +
        `\nSet FLOW_SHARED_DIR to the shared/ directory if it lives elsewhere.`,
    );
  }

  const raw = readFileSync(path, "utf8");
  promptCache.set(version, raw);
  return raw;
}

function buildSystemPrompt(opts: CleanupOptions): string {
  const targetApp = opts.targetApp?.trim() || "Generic";
  const language = opts.language ?? "auto";
  return loadPromptTemplate()
    .replaceAll("{{TARGET_APP}}", targetApp)
    .replaceAll("{{LANGUAGE}}", language);
}

// --- Cleanup calls ----------------------------------------------------------

const TEMPERATURE = 0.2; // low: we want faithful cleanup, not creativity

/** Non-streaming cleanup. Returns the full polished text. */
export async function clean(
  transcript: string,
  opts: CleanupOptions = {},
): Promise<string> {
  if (!transcript.trim()) return "";
  const cfg = getConfig();

  const res = await openrouter().chat.completions.create({
    model: cfg.CLEANUP_MODEL,
    temperature: TEMPERATURE,
    messages: [
      { role: "system", content: buildSystemPrompt(opts) },
      { role: "user", content: transcript },
    ],
  });

  return (res.choices[0]?.message?.content ?? "").trim();
}

/**
 * Streaming cleanup. Yields cleaned text deltas as they arrive so the client
 * can show text appearing live.
 */
export async function* cleanStream(
  transcript: string,
  opts: CleanupOptions = {},
): AsyncGenerator<string, void, unknown> {
  if (!transcript.trim()) return;
  const cfg = getConfig();

  const stream = await openrouter().chat.completions.create({
    model: cfg.CLEANUP_MODEL,
    temperature: TEMPERATURE,
    stream: true,
    messages: [
      { role: "system", content: buildSystemPrompt(opts) },
      { role: "user", content: transcript },
    ],
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
