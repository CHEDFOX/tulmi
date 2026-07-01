# Store-listing checklist — Tailzu

Everything the App Store + Play Store need before the first review submission.
Assign, don't skip. A missing item is almost always why review takes weeks.

## App Store (iOS)

### Must-haves (Review will reject without)

- [ ] **Privacy Policy URL** — public, human-readable, matches App Privacy
      answers. Draft: `docs/PRIVACY.md` → host at `https://tailzu.space/privacy`.
- [ ] **Support URL** — public page listing contact + FAQ. `https://tailzu.space/support`.
- [ ] **App icon** — 1024×1024 no-alpha PNG. Currently in `app/assets/icon.png`;
      confirm it's export-safe (no transparency, no rounded corners baked in).
- [ ] **Screenshots** — 6.9" (iPhone 16 Pro Max), 6.5" (iPhone XS Max) at minimum.
      Also 5.5" if you want iPhone 8 users to see anything. **~5-8 screenshots per
      size, showing the keyboard in real host apps.** Xcode Simulator captures are
      fine; add a device frame in the marketing tool.
- [ ] **App Preview video (optional but recommended)** — 15-30s vertical
      screen recording of a real dictation → cleaned text moment. Massive
      lift for keyboards specifically.
- [ ] **Copy blocks** (see below).
- [ ] **App Privacy answers** — every SaaS provider we send data to has to
      map to a category. Draft: **Purchases** none, **Financial Info** none,
      **Contact Info** email (linked to identity), **Audio Data** yes (used
      for App Functionality, NOT linked to identity, NOT for tracking),
      **User Content** yes (text — same posture as audio), **Usage Data** yes.
- [ ] **Age rating** — likely 4+ if we ship without user-generated content
      that could be moderated in-app. If we ever surface community content,
      revisit.
- [ ] **Export compliance** — `usesNonExemptEncryption: false` is already set
      in `app.config.ts` since we only use standard HTTPS. Keep that until
      we add anything non-standard.

### Keyboard-extension specifics (extra review scrutiny)

- [ ] **"Allow Full Access" justification** in the description — say
      *exactly* why: "reach the Tailzu cloud service for dictation + AI
      cleanup". Vague answers get rejected.
- [ ] **Background Audio mode justification** — same idea: "instant voice
      dictation from any app, powered by a silent background audio session".
      Reference the flow at `app/src/PrimeScreen.tsx`.
- [ ] **Demo video for the reviewer** — a 60s screen record showing the
      "prime → return → dictate in another app" flow. Uploaded as a Review
      Note attachment. Historically the biggest predictor of a smooth
      keyboard review.
- [ ] **Test credentials** — a working `apple.review@tailzu.space` account
      that survives every review round. Include in Review Notes.

### Copy blocks

- **Subtitle (30 char)**: `Speak. Type. Sound like you.`
- **Promotional text (170 char)**: `A voice + typing keyboard that turns
  messy dictation into polished text in your own style. Works everywhere
  you type — from WhatsApp to Gmail.`
- **Keywords (100 char)**: `voice keyboard, dictation, ai keyboard, hinglish,
  autocorrect, refine, chatgpt keyboard`
- **Description (4000 char)**: draft in `docs/copy/app-store-description.md`.
      TODO — 4-5 paragraph copy, feature list, why-you-need-it, FAQ.
- **What's New in this Version (4000 char)**: 3-5 short bullets per release.

### Ownership / accounts

- [ ] App Store Connect app record created under Team ID `6552H8HYA4`.
- [ ] `ascAppId` filled in `app/eas.json` → `submit.production.ios.ascAppId`.
- [ ] `appleId` filled in `app/eas.json` → `submit.production.ios.appleId`.
- [ ] TestFlight external testing group set up with 10-25 seats for a
      pre-launch beta.

---

## Play Store (Android)

### Must-haves

- [ ] **Privacy Policy URL** — same URL as iOS.
- [ ] **Feature graphic** — 1024×500 PNG. Marketing image, no text-heavy.
- [ ] **App icon** — 512×512 32-bit PNG. Generated from `assets/icon.png`.
- [ ] **Screenshots** — phone (min 320px, up to 8), 7-inch and 10-inch
      tablet if we're marking tablet support (currently `supportsTablet: false`,
      so skip).
- [ ] **Short description (80 char)**: `The voice + typing keyboard that
      sounds like you — in every app.`
- [ ] **Full description (4000 char)**: same source as iOS with 20-30% less
      polish (Play discovery leans on keyword density).
- [ ] **Content rating questionnaire** — probably ESRB Everyone / PEGI 3.
- [ ] **Data safety form** — mirror iOS App Privacy answers.
- [ ] **Target audience** — 13+ if we ship account creation with email;
      younger only if we add a kids-mode gate.
- [ ] **App category** — "Productivity" primary.

### Ownership / accounts

- [ ] Google Play Console project + billing profile.
- [ ] Service account with "Release Manager" role for automated uploads.
      Key JSON path: `secrets/play-service-account.json` (gitignored;
      referenced from `app/eas.json`).
- [ ] Internal testing track configured for staged rollout.

---

## Screenshots — the ONE thing that moves conversion

Prioritise these five moments (in this order):

1. **Speak, get polished text.** Real chat app on the left half, keyboard
   with mic-active state on the right, before/after text.
2. **Personality in action.** Same intent, three tones — one screenshot,
   three thought-bubble replies.
3. **Multilingual.** Hinglish input → clean output. This is a differentiator
   Gboard / SwiftKey don't sell.
4. **Instant voice everywhere.** The "prime once, use forever" moment in the
   app + the keyboard mic lighting up inside iMessage.
5. **Privacy receipts.** The Data & Privacy screen with real numbers.

## Pre-submission smoke test

- [ ] `npm run verify` clean in the frontend repo (`npm run check:base-url &&
      npm run typecheck`).
- [ ] Backend PR merged, `git pull && docker compose up -d --build` on the
      VPS, `/readyz` returns 200 with `status: "ready"`.
- [ ] iOS TestFlight build + a real dictation succeeds in WhatsApp, Notes,
      and Gmail.
- [ ] Android internal-track build + same three-app smoke.
- [ ] Live-Activity + Background Audio behaviour verified — dictation still
      works after the phone has been locked for 60 seconds.
