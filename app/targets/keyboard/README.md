# Tulmi keyboard (native iOS keyboard extension)

The iOS counterpart to the Android IME in `../../modules/tulmi-keyboard/`. iOS
custom keyboards are a native **app extension** written in Swift; Expo adds the
target via [`@bacons/apple-targets`](https://github.com/EvanBacon/expo-apple-targets)
(registered in `../../app.config.ts`).

## What's here

```
expo-target.config.js     declares the "keyboard" app-extension target
Info.plist                NSExtension config + RequestsOpenAccess (network)
KeyboardViewController.swift  the keyboard: QWERTY + ✨ Refine, inserts text
TulmiBackend.swift        backend client (POST /v1/refine) — mirrors Net.kt
```

## Feature parity with Android

| Feature | Android | iOS |
|---|---|---|
| Typing (QWERTY) | ✅ | ✅ |
| ✨ Refine whole field | ✅ | ✅ |
| 🎙️ Voice dictation | ✅ (in-keyboard) | ⏳ via app-handoff (next step) |

**Why no in-keyboard voice on iOS:** Apple does not give keyboard extensions
microphone access, even with Full Access. The proven workaround (used by Wispr
Flow) is to have the keyboard briefly open the **main Tulmi app**, which records
the mic, transcribes via the backend, then hands the text back to the keyboard
through a shared App Group container. That handoff is the next iOS task.

## How it builds (requires macOS or EAS)

iOS native targets can only be compiled on a Mac or via EAS Build. From a Mac:

```bash
cd app
npm install @bacons/apple-targets
npx expo prebuild -p ios     # generates ios/, adds the keyboard target
npx expo run:ios             # builds + installs on a simulator/device
```

Or build in the cloud (needs an Apple Developer account for a real device):

```bash
npx eas-cli build --profile development --platform ios
```

Then on the iPhone: **Settings → General → Keyboard → Keyboards → Add New
Keyboard → Tulmi**, then enable **Allow Full Access** (required for ✨ Refine to
reach the backend). Switch to it with the 🌐 globe key.

## Known v1 limits / TODO

- **Voice handoff** to the main app is not built yet (see table above).
- Backend URL is a constant in `TulmiBackend.swift` — bridge the app's saved URL
  (via a shared App Group) later.
- iOS only exposes text *around the cursor*, so Refine replaces the visible
  context rather than guaranteed whole-field text.
- `targetApp` is hard-coded to `Generic` — iOS sandboxing hides the host app's
  identity, so per-app tone matching isn't available like it is on Android.
- Minimal QWERTY (letters, shift, space, delete, return) — numbers/symbols later.
