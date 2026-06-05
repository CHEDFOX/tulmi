# Flow

Voice dictation that actually understands how you talk — including **Hindi,
Hinglish, and code-switching**, which other dictation apps treat as an
afterthought.

**Core loop:** you speak → audio is transcribed → an LLM cleans it (removes
fillers, punctuates, formats lists, matches the tone of the app you're typing
in) → the polished text is inserted wherever your cursor is.

---

## Monorepo layout

```
flow/
├─ shared/        Cross-cutting source of truth
│  ├─ prompts/    Versioned cleanup prompt (the product's secret sauce)
│  └─ types/      API request/response + streaming message contract (TypeScript)
├─ backend/       Node + TypeScript (Fastify). Deploys to the VPS.
│                 audio → Groq Whisper (STT) → OpenRouter LLM (cleanup) → text
├─ android/       Native Kotlin custom keyboard (IME). Phase 1.
└─ ios/           Placeholder. Native Swift keyboard extension — PHASE 2.
```

## Phases

- **Phase 1 (now):** Cloud pipeline (backend) + Android keyboard. Buildable on
  Windows. Cloud-first, no on-device models. Usage metered from day one.
- **Phase 2 (later):** iOS Swift keyboard extension (needs Mac/TestFlight).

## Tech decisions (locked)

| Concern            | Choice                                                    |
|--------------------|-----------------------------------------------------------|
| Backend            | Node + TypeScript (Fastify)                               |
| Speech-to-text     | Groq Whisper API                                          |
| Cleanup LLM        | OpenRouter, default `anthropic/claude-haiku-4.5` (swappable via env) |
| Streaming          | WebSocket (+ a one-shot REST endpoint for simple cases)   |
| Auth + DB + usage  | Supabase                                                  |
| Android UI         | Native Kotlin `InputMethodService` (IME)                  |
| Secrets            | Env vars only. See `.env.example`.                        |

## Quick start (backend)

```bash
cd backend
cp ../.env.example .env      # then fill in your keys
npm install
npm run dev                  # starts the server

# Prove the pipeline with an audio file (no server needed):
npm run test:pipeline -- ./test-assets/sample.m4a --app WhatsApp
```

See [`backend/README.md`](backend/README.md) for details and the API contract.
