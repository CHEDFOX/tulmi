# Tailzu — Privacy Policy

_This is a scaffold, not a lawyer-reviewed document. Publish only after your
counsel signs off; the App Store and Play Store both require a live URL._

**Last updated:** _fill on publish_

## The short version

- **We don't sell your data. Ever.**
- Your **audio** is sent to a speech-to-text provider (OpenAI, Groq, or
  Deepgram — see below), transcribed, then **deleted from our servers
  immediately after the response is returned**.
- Your **text** goes to our AI cleanup provider (OpenRouter → the model you
  chose, default Anthropic Claude) to be polished. It's not stored on our
  servers beyond the request itself.
- Your **personality profile** (tone, sign-off, vocabulary, etc.) is stored
  in your account so the output sounds like you.
- Your **account** (email, sign-in method, usage counts) is stored via
  Supabase in a database we control.
- You can view exactly what happened with your data in the in-app **Data &
  Privacy** screen (`Settings → Data & Privacy`) or by hitting the receipts
  endpoint yourself: `GET /v1/privacy/audit`.

## What data we collect

| Data | Purpose | Where it lives | Retention |
|---|---|---|---|
| Email + auth token | Sign in | Supabase | Until you delete your account |
| Personality profile | Personalise outputs | Supabase | Until you clear it |
| Language preference | Localise UI | Supabase | Until you change it |
| Usage counts (audio seconds, word counts, model name) | Show your stats, enforce free tier | Supabase | Until you delete your account |
| Audio you dictate | Speech-to-text call | Transient on our server; sent to STT provider | **Deleted after the STT call returns** |
| Text you refine / draft | Cleanup / draft LLM call | Transient on our server; sent to LLM provider | **Not stored on our servers** |

## Third-party services we send data to

We use SaaS providers to run the pipeline. Each one has its own privacy
policy — links below.

- **OpenAI** — speech-to-text and text-to-speech ([policy](https://openai.com/policies/privacy-policy))
- **Groq** — alternative speech-to-text ([policy](https://groq.com/privacy-policy/))
- **Deepgram** — live streaming speech-to-text ([policy](https://deepgram.com/privacy-policy))
- **OpenRouter** → the model you selected, default Anthropic Claude — text
  cleanup and reply drafting ([OpenRouter policy](https://openrouter.ai/privacy))
- **Supabase** — auth + database ([policy](https://supabase.com/privacy))
- **Sentry** — crash reporting (only when you have a compatible build; no
  message content is sent) ([policy](https://sentry.io/privacy/))

None of these providers see your account credentials directly — we
authenticate to them with our server-side keys, and we forward only the
minimum needed to fulfill the request.

## Your rights

- **See what we have.** In-app: `Settings → Data & Privacy`. On the API:
  `GET /v1/personality` and `GET /v1/privacy/audit`.
- **Delete everything.** Email `privacy@tailzu.space` — we remove your row in
  Supabase (auth + personality + profile + usage_events) within 30 days.
- **Export.** Same email, we send you a JSON dump.
- **Opt out of "learn from my writing".** It's off by default. To turn it on,
  toggle it in Settings. To turn it off, toggle it off — we stop using new
  runs to refine your saved style immediately.

## Regional notes

- **GDPR (EU):** we act as the data controller for your account data and as a
  processor when we forward your requests to the SaaS providers above.
- **CCPA (California):** we do not sell your personal information; there is
  nothing to opt out of.
- **India (DPDP Act):** you can withdraw consent at any time via the
  in-app Data & Privacy screen.

## Contact

- **Privacy questions / data requests:** `privacy@tailzu.space`
- **General support:** `support@tailzu.space`
- **Security disclosures:** `security@tailzu.space` (please encrypt with our
  published PGP key — link on the landing page)

## Changes to this policy

We'll post material changes at least 14 days before they take effect and
notify you in-app on next launch. Non-material changes (typo fixes, added
providers of the same category) may be published without notice.
