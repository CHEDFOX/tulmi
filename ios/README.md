# iOS — PHASE 2 (not started)

This folder is intentionally reserved. **Do not implement iOS yet.**

iOS will be a **native Swift keyboard extension** (`UIInputViewController`),
the iOS analogue of the Android custom keyboard in `../android/`. It needs Mac +
Xcode + a TestFlight/Apple Developer account to build and distribute, so it is
deliberately deferred to Phase 2.

When Phase 2 starts, it will reuse, unchanged:
- the same backend (`../backend/`),
- the same API contract (`../shared/types/api.ts`),
- the same cleanup prompt (`../shared/prompts/`).

Only the keyboard surface (recording, networking, text insertion via
`UITextDocumentProxy`) gets a native Swift implementation here.
