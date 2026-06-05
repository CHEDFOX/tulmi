# Flow backend

Node + TypeScript (Fastify). Orchestrates the dictation pipeline:

```
audio ──▶ Groq Whisper (STT) ──▶ OpenRouter LLM (cleanup) ──▶ polished text
                                                          └──▶ usage → Supabase
```

## Setup

```bash
cd backend
cp ../.env.example .env     # fill in GROQ_API_KEY + OPENROUTER_API_KEY (Supabase optional)
npm install
```

`DEV_SKIP_AUTH=true` (the default in `.env.example`) lets you run the pipeline
with only the Groq + OpenRouter keys — no Supabase needed.

## Prove the pipeline (no server)

Drop an audio file in `test-assets/` and run:

```bash
npm run test:pipeline -- ./test-assets/sample.m4a --app WhatsApp --lang auto
```

It prints the raw transcript, the cleaned text, timing, and usage. Try a
Hinglish clip with `--lang auto` to see the code-switching handling.

## Run the server

```bash
npm run dev      # watch mode (tsx)
# or
npm run build && npm start
```

Then:

```bash
# Health
curl localhost:8080/healthz

# One-shot REST (multipart)
curl -X POST localhost:8080/v1/transcribe-clean \
  -H "Authorization: Bearer <supabase-jwt>" \
  -F audio=@test-assets/sample.m4a \
  -F targetApp=WhatsApp \
  -F language=auto
```

(With `DEV_SKIP_AUTH=true`, any/no token is accepted and mapped to a dev user.)

## API contract

The wire types live in [`../shared/types/api.ts`](../shared/types/api.ts) —
the single source of truth shared with the Android app.

- **REST** `POST /v1/transcribe-clean` — multipart `audio` + optional
  `targetApp`, `language` → `{ cleanedText, transcript, usage }`.
- **WebSocket** `wss://host/v1/stream` — send a `start` control frame, then
  binary audio frames, then `end`; receive `ready` → `transcript` →
  `cleaned_delta`* → `done`.

## Usage metering

Every successful request writes a row to Supabase `usage_events`
(audio seconds + word count). Apply the schema in
[`supabase/migrations/0001_usage_events.sql`](supabase/migrations/0001_usage_events.sql).
This is the foundation for free-tier enforcement later.

## Config knobs (env)

| Var                 | Purpose                                         |
|---------------------|-------------------------------------------------|
| `GROQ_STT_MODEL`    | Whisper model (default `whisper-large-v3-turbo`)|
| `CLEANUP_MODEL`     | OpenRouter model — **swap this one line** to change the cleanup LLM |
| `CLEANUP_PROMPT_VERSION` | Which `shared/prompts/cleanup.<v>.md` to load |
| `DEV_SKIP_AUTH`     | Skip Supabase auth + metering for local testing |
