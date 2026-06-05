# Tulmi

Your **AI language layer** for the phone. Speak, type, or point it at your
screen — Tulmi turns rough input into clean, ready-to-send text **in your own
voice**, across **most world languages**, with best-in-class **Hindi / Hinglish
/ code-switching** as the flagship that other apps treat as an afterthought.

## Three ways in, one brain (all powered by the backend)

1. **🎙️ Speak** → audio is transcribed and cleaned (fillers removed, punctuated,
   lists formatted) → inserted where your cursor is.
2. **⌨️ Type** → rough text is rewritten the best way, like smart autocorrect.
3. **🫧 Screen** → a floating bubble (Android) / Share-sheet (iOS) reads what's on
   screen; you say what you want; Tulmi drafts a personalized reply.

Every output is shaped by two things the **backend** owns:

- **Personality** — your tone/style, set once in the app.
- **Context** — which app you're in, who you're writing to, what's on screen.

The apps are thin: they capture input and send it; the backend does the thinking.

---

## Monorepo layout

```
tulmi/
├─ shared/        Cross-cutting source of truth
│  ├─ prompts/    Versioned prompts (cleanup + reply) — the product's secret sauce
│  └─ types/      API request/response + streaming contract (TypeScript)
├─ tulmi/         Backend — Node + TypeScript (Fastify). Deploys to the VPS.
│                 voice/typing/screen → Groq STT + OpenRouter LLM → personalized text
├─ android/       Native Kotlin: custom keyboard (IME) + floating screen bubble
└─ ios/           Native Swift: keyboard extension + Share-sheet (needs a Mac)
```

## Platform note (important)

Android and iOS are built **together** off the same backend. One capability
differs by platform: the **always-on floating bubble that reads any screen is
Android-only** — Apple's sandbox forbids it. On iOS the same outcome is reached
via the **Share-sheet / screenshot** into the app. Voice, typing, and the
keyboard work on both.

## Tech decisions (locked)

| Concern            | Choice                                                    |
|--------------------|-----------------------------------------------------------|
| Backend            | Node + TypeScript (Fastify), in `tulmi/`                  |
| Speech-to-text     | OpenAI `gpt-4o-transcribe` (default, ~100 langs); Groq Whisper optional. Provider via `STT_PROVIDER` |
| Cleanup / reply LLM| OpenRouter, default `anthropic/claude-haiku-4.5` (swappable via env) |
| Streaming          | WebSocket (+ one-shot REST endpoints)                     |
| Auth + DB + usage  | Supabase (usage metered from day one)                     |
| Android UI         | Native Kotlin `InputMethodService` + overlay bubble       |
| iOS UI             | Native Swift keyboard extension + Share extension         |
| Secrets            | Env vars only. See `.env.example`.                        |

## Backend API (summary)

| Mode    | Endpoint                                   |
|---------|--------------------------------------------|
| Voice   | `POST /v1/transcribe-clean`, `WS /v1/stream` |
| Typing  | `POST /v1/refine`                          |
| Screen  | `POST /v1/draft`                           |
| Profile | `GET` / `PUT /v1/personality`              |

Full contract: [`shared/types/api.ts`](shared/types/api.ts).

## Quick start (backend)

```bash
cd tulmi
cp ../.env.example .env      # then fill in your keys
npm install
npm run dev                  # starts the server

# Prove the pipeline with an audio file (no server needed):
npm run test:pipeline -- ./test-assets/sample.m4a --app WhatsApp
```

See [`tulmi/README.md`](tulmi/README.md) for details, and
[`DEPLOY.md`](DEPLOY.md) to deploy to a VPS without disturbing other apps.
