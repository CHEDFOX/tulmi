# Tulmi app (Expo — Android + iOS)

One Expo/React Native codebase that builds **both** platforms via EAS (so iOS
ships from Windows, no Mac). This is the **main app** (settings, personality,
backend playground). The **keyboard** is a native module added on top (next
step) — JS can't run inside a keyboard process, so the keyboard stays native
(Kotlin/Swift); Expo just wraps and ships it.

## First-time setup (Windows, VS Code)

The committed files here are the **source** (`App.tsx`, `src/`, `app.config.ts`,
`eas.json`). Generate the Expo project boilerplate with correct, current
versions, then this source slots in:

```bash
# 1. From the repo root, scaffold a blank TypeScript Expo app INTO ./app
#    (run it in a temp dir and copy, or use --template blank-typescript)
npx create-expo-app@latest app --template blank-typescript
# (If 'app' already has these files, create in a temp folder and copy package.json,
#  babel.config.js, tsconfig.json, .gitignore over — keep OUR App.tsx/src/app.config.ts/eas.json.)

cd app

# 2. Install the runtime deps this app uses
npx expo install expo-av @react-native-async-storage/async-storage

# 3. Install EAS CLI (once, globally) and log in to your Expo account
npm install -g eas-cli
eas login
```

## Run it (fastest feedback)

```bash
npx expo start
```

Open it in **Expo Go** on your phone (scan the QR). The main app + the backend
playground (type→refine, record→transcribe) work in Expo Go.

> **Backend URL:** in the app's **Settings** tab, set the backend URL. Android
> emulator → your PC is `http://10.0.2.2:8770`. A physical phone on the same
> WiFi → your PC's LAN IP (e.g. `http://192.168.1.20:8770`). Production → your
> VPS `https://...`.

> The keyboard itself needs a **dev build** (not Expo Go) because it's native —
> that comes when we add the keyboard module.

## Build + ship (the Windows → stores flow you know)

```bash
# Android APK you can install directly:
eas build -p android --profile preview

# iOS build (Expo's cloud Macs compile it) + submit to TestFlight/App Store:
eas build -p ios --profile production
eas submit -p ios
```

(iOS builds need your Apple Developer account; EAS walks you through credentials.)

## Structure

```
app/
├─ App.tsx          screens: Home (playground) / Personality / Settings
├─ src/
│  ├─ api.ts        backend client (refine, transcribe, draft, speak, personality)
│  └─ storage.ts    switchable backend URL
├─ app.config.ts    Expo config (bundle ids, permissions, plugins)
└─ eas.json         build/submit profiles
   modules/         ← native keyboard (Kotlin IME + Swift extension) — next step
```

The request/response shapes in `src/api.ts` mirror `../shared/types/api.ts`.
