/**
 * Flow backend HTTP/WS server.
 *
 *   GET  /healthz                 → liveness
 *   POST /v1/transcribe-clean     → one-shot: multipart audio → cleaned text
 *   WS   /v1/stream               → live: audio frames up, cleaned text down
 */
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { getConfig, VERSION } from "./config.js";
import { resolveUser } from "./auth/supabase.js";
import { recordUsage } from "./usage/metering.js";
import { runPipeline, runPipelineStream } from "./pipeline/index.js";
import type {
  AudioFormat,
  ClientMessage,
  HealthResponse,
  LanguageHint,
  ServerMessage,
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

// --- Health -----------------------------------------------------------------

app.get("/healthz", async (): Promise<HealthResponse> => {
  return { status: "ok", service: "flow-backend", version: VERSION };
});

// --- REST: one-shot transcribe + clean --------------------------------------

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

  // Iterate multipart parts: one file ("audio") + optional text fields.
  for await (const part of req.parts()) {
    if (part.type === "file") {
      format = formatFromFilename(part.filename) ?? "m4a";
      audio = await part.toBuffer();
    } else if (part.fieldname === "targetApp") {
      targetApp = String(part.value);
    } else if (part.fieldname === "language") {
      language = String(part.value) as LanguageHint;
    }
  }

  if (!audio || !format) {
    return reply.code(400).send({ code: "bad_request", message: "Missing 'audio' file" });
  }

  try {
    const result = await runPipeline({ audio, format, targetApp, language });
    await recordUsage({ userId: user.id, source: "rest", ...result.usage });
    return reply.send(result);
  } catch (err) {
    req.log.error(err);
    return reply
      .code(500)
      .send({ code: "internal", message: "Pipeline failed" });
  }
});

// --- WebSocket: live streaming ----------------------------------------------

app.register(async (instance) => {
  instance.get(WS_PATH, { websocket: true }, (socket, req) => {
    const send = (msg: ServerMessage) => socket.send(JSON.stringify(msg));

    let started = false;
    let format: AudioFormat = "webm";
    let targetApp: TargetAppHint | undefined;
    let language: LanguageHint | undefined;
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
          for await (const ev of runPipelineStream({ audio, format, targetApp, language })) {
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
