/**
 * Tulmi backend HTTP/WS server.
 *
 *   GET  /healthz                 → liveness
 *   POST /v1/transcribe-clean     → voice: multipart audio → cleaned text
 *   WS   /v1/stream               → voice (live): audio frames up, text down
 *   POST /v1/refine               → typing: text → polished text (autocorrect)
 *   POST /v1/draft                → screen: screen content + intent → reply
 *   POST /v1/speak                → voice out: text → spoken audio (TTS)
 *   GET  /v1/personality          → read the user's saved style profile
 *   PUT  /v1/personality          → save the user's style profile
 *
 * Every output is shaped by the user's personality + the target-app context,
 * resolved here on the backend (the app just sends the inputs).
 */
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { getConfig, VERSION } from "./config.js";
import { resolveUser } from "./auth/supabase.js";
import { recordUsage } from "./usage/metering.js";
import { runPipeline, runPipelineStream } from "./pipeline/index.js";
import { clean, draftReply } from "./pipeline/cleanup.js";
import { synthesize } from "./pipeline/tts.js";
import {
  getPersonality,
  savePersonality,
  resolvePersonality,
} from "./personality/store.js";
import type {
  AudioFormat,
  ClientMessage,
  DraftRequest,
  DraftResponse,
  HealthResponse,
  LanguageHint,
  Personality,
  PersonalityResponse,
  RefineRequest,
  RefineResponse,
  ServerMessage,
  SpeakRequest,
  TargetAppHint,
} from "../../shared/types/api.js";
import { WS_PATH } from "../../shared/types/api.js";

const cfg = getConfig();

const app = Fastify({
  logger: true,
  bodyLimit: 50 * 1024 * 1024, // 50 MB — generous ceiling for an audio clip
});

await app.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});
await app.register(websocket);

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

// --- Health -----------------------------------------------------------------

app.get("/healthz", async (): Promise<HealthResponse> => {
  return { status: "ok", service: "tulmi-backend", version: VERSION };
});

// --- Voice (REST): one-shot transcribe + clean ------------------------------

const ALLOWED_FORMATS: AudioFormat[] = [
  "wav",
  "m4a",
  "webm",
  "mp3",
  "ogg",
  "flac",
];

function formatFromFilename(name: string | undefined): AudioFormat | null {
  const ext = name?.split(".").pop()?.toLowerCase() as AudioFormat | undefined;
  return ext && ALLOWED_FORMATS.includes(ext) ? ext : null;
}

app.post("/v1/transcribe-clean", async (req, reply) => {
  const user = await resolveUser(req.headers["authorization"]);
  if (!user) {
    return reply.code(401).send({ code: "unauthorized", message: "Missing or invalid token" });
  }

  let audio: Buffer | null = null;
  let format: AudioFormat | null = null;
  let targetApp: TargetAppHint | undefined;
  let language: LanguageHint | undefined;
  let personalityOverride: Personality | undefined;

  // Iterate multipart parts: one file ("audio") + optional text fields.
  for await (const part of req.parts()) {
    if (part.type === "file") {
      format = formatFromFilename(part.filename) ?? "m4a";
      audio = await part.toBuffer();
    } else if (part.fieldname === "targetApp") {
      targetApp = String(part.value);
    } else if (part.fieldname === "language") {
      language = String(part.value) as LanguageHint;
    } else if (part.fieldname === "personality") {
      try {
        personalityOverride = JSON.parse(String(part.value)) as Personality;
      } catch {
        /* ignore malformed personality field */
      }
    }
  }

  if (!audio || !format) {
    return reply.code(400).send({ code: "bad_request", message: "Missing 'audio' file" });
  }

  try {
    const personality = await resolvePersonality(user.id, personalityOverride);
    const result = await runPipeline({ audio, format, targetApp, language, personality });
    await recordUsage({ userId: user.id, source: "rest", ...result.usage });
    return reply.send(result);
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ code: "internal", message: "Pipeline failed" });
  }
});

// --- Typing (REST): refine typed text ---------------------------------------

app.post("/v1/refine", async (req, reply) => {
  const user = await resolveUser(req.headers["authorization"]);
  if (!user) {
    return reply.code(401).send({ code: "unauthorized", message: "Missing or invalid token" });
  }

  const body = (req.body ?? {}) as RefineRequest;
  if (!body.text || !body.text.trim()) {
    return reply.code(400).send({ code: "bad_request", message: "Missing 'text'" });
  }

  try {
    const personality = await resolvePersonality(user.id, body.personality);
    const refinedText = await clean(body.text, {
      targetApp: body.targetApp,
      language: body.language,
      personality,
    });
    const usage = {
      audioSeconds: 0,
      words: countWords(refinedText),
      model: cfg.CLEANUP_MODEL,
    };
    await recordUsage({ userId: user.id, source: "rest", ...usage });
    const res: RefineResponse = { refinedText, usage };
    return reply.send(res);
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ code: "cleanup_failed", message: "Refine failed" });
  }
});

// --- Screen (REST): draft a personalized reply ------------------------------

app.post("/v1/draft", async (req, reply) => {
  const user = await resolveUser(req.headers["authorization"]);
  if (!user) {
    return reply.code(401).send({ code: "unauthorized", message: "Missing or invalid token" });
  }

  const body = (req.body ?? {}) as DraftRequest;
  if (!body.intent || !body.intent.trim()) {
    return reply.code(400).send({ code: "bad_request", message: "Missing 'intent'" });
  }

  try {
    const personality = await resolvePersonality(user.id, body.personality);
    const draftText = await draftReply(
      body.screenContent ?? "",
      body.intent,
      { targetApp: body.targetApp, language: body.language, personality },
      body.recipient,
    );
    const usage = {
      audioSeconds: 0,
      words: countWords(draftText),
      model: cfg.CLEANUP_MODEL,
    };
    await recordUsage({ userId: user.id, source: "rest", ...usage });
    const res: DraftResponse = { draftText, usage };
    return reply.send(res);
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ code: "cleanup_failed", message: "Draft failed" });
  }
});

// --- Text-to-speech (REST): text → spoken audio -----------------------------

app.post("/v1/speak", async (req, reply) => {
  const user = await resolveUser(req.headers["authorization"]);
  if (!user) {
    return reply.code(401).send({ code: "unauthorized", message: "Missing or invalid token" });
  }

  const body = (req.body ?? {}) as SpeakRequest;
  if (!body.text || !body.text.trim()) {
    return reply.code(400).send({ code: "bad_request", message: "Missing 'text'" });
  }

  try {
    const { audio, contentType } = await synthesize({
      text: body.text,
      voice: body.voice,
      format: body.format,
      instructions: body.instructions,
    });
    await recordUsage({
      userId: user.id,
      source: "rest",
      audioSeconds: 0,
      words: countWords(body.text),
      model: cfg.OPENAI_TTS_MODEL,
    });
    return reply.header("content-type", contentType).send(audio);
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ code: "internal", message: "TTS failed" });
  }
});

// --- Personality (REST): read / save the user's style profile ---------------

app.get("/v1/personality", async (req, reply) => {
  const user = await resolveUser(req.headers["authorization"]);
  if (!user) {
    return reply.code(401).send({ code: "unauthorized", message: "Missing or invalid token" });
  }
  const personality = await getPersonality(user.id);
  const res: PersonalityResponse = { personality };
  return reply.send(res);
});

app.put("/v1/personality", async (req, reply) => {
  const user = await resolveUser(req.headers["authorization"]);
  if (!user) {
    return reply.code(401).send({ code: "unauthorized", message: "Missing or invalid token" });
  }
  const personality = (req.body ?? {}) as Personality;
  try {
    await savePersonality(user.id, personality);
    const res: PersonalityResponse = { personality };
    return reply.send(res);
  } catch (err) {
    req.log.error(err);
    return reply.code(500).send({ code: "internal", message: "Failed to save personality" });
  }
});

// --- Voice (WebSocket): live streaming --------------------------------------

app.register(async (instance) => {
  instance.get(WS_PATH, { websocket: true }, (socket, req) => {
    const send = (msg: ServerMessage) => socket.send(JSON.stringify(msg));

    let started = false;
    let format: AudioFormat = "webm";
    let targetApp: TargetAppHint | undefined;
    let language: LanguageHint | undefined;
    let personalityOverride: Personality | undefined;
    const chunks: Buffer[] = [];
    let userId: string | null = null;

    // Verify auth on connect (header carried through the upgrade request).
    resolveUser(req.headers["authorization"]).then((user) => {
      if (!user) {
        send({ type: "error", code: "unauthorized", message: "Missing or invalid token" });
        socket.close();
        return;
      }
      userId = user.id;
    });

    socket.on("message", async (data: Buffer, isBinary: boolean) => {
      // Binary frame → audio chunk.
      if (isBinary) {
        if (started) chunks.push(data);
        return;
      }

      // Text frame → control message.
      let msg: ClientMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        send({ type: "error", code: "bad_request", message: "Invalid JSON control frame" });
        return;
      }

      if (msg.type === "start") {
        started = true;
        format = msg.format;
        targetApp = msg.targetApp;
        language = msg.language;
        personalityOverride = msg.personality;
        send({ type: "ready" });
        return;
      }

      if (msg.type === "end") {
        if (!userId) {
          send({ type: "error", code: "unauthorized", message: "Not authenticated" });
          return;
        }
        if (chunks.length === 0) {
          send({ type: "error", code: "bad_request", message: "No audio received" });
          return;
        }
        const audio = Buffer.concat(chunks);
        try {
          const personality = await resolvePersonality(userId, personalityOverride);
          for await (const ev of runPipelineStream({
            audio,
            format,
            targetApp,
            language,
            personality,
          })) {
            send(ev);
            if (ev.type === "done") {
              await recordUsage({ userId, source: "stream", ...ev.usage });
            }
          }
        } catch (err) {
          req.log.error(err);
          send({ type: "error", code: "internal", message: "Pipeline failed" });
        } finally {
          socket.close();
        }
      }
    });
  });
});

// --- Boot -------------------------------------------------------------------

try {
  await app.listen({ port: cfg.PORT, host: cfg.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
