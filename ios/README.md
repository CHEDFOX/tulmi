# iOS (native Swift)

Built **alongside** Android off the same backend (`../tulmi/`), same API
contract (`../shared/types/api.ts`), same prompts (`../shared/prompts/`). Only
the surface is native Swift. **iOS requires a Mac (Xcode) to compile and ship.**

## What iOS includes

- **Keyboard extension** (`UIInputViewController`) — mic button + typing-refine,
  inserts text via `UITextDocumentProxy`. Mirrors the Android IME.
- **Share extension** — the iOS equivalent of Android's screen bubble. The user
  shares selected text / a screenshot into Tulmi; the app reads it and calls
  `POST /v1/draft` to produce a personalized reply.

## Platform limitation (by design)

Apple's sandbox does **not** allow an always-on floating button that reads other
apps' screens (Android's accessibility-overlay bubble). So on iOS the
screen-reply feature is reached through the **Share-sheet / screenshot**, not a
floating bubble. Voice, typing, and the keyboard all work the same on both
platforms.

## Status

Folder reserved and the plan is fixed. Implementation begins once a Mac build
environment is available (see the deploy/build notes the assistant provided for
Mac options).
