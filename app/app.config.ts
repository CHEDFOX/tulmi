import { ExpoConfig } from "expo/config";

/**
 * Expo app config for Tulmi (Android + iOS from one codebase).
 * The native keyboard (Android IME / iOS keyboard extension) is added on top of
 * this via a config plugin + native target in a later step.
 */
const config: ExpoConfig = {
  name: "Tulmi",
  slug: "tulmi",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "tulmi",
  userInterfaceStyle: "dark",
  ios: {
    bundleIdentifier: "com.tulmi.app",
    supportsTablet: false,
    infoPlist: {
      NSMicrophoneUsageDescription:
        "Tulmi uses the microphone to turn your speech into clean text.",
    },
  },
  android: {
    package: "com.tulmi.app",
    permissions: ["android.permission.RECORD_AUDIO", "android.permission.INTERNET"],
  },
  // expo-av provides mic-permission config; usesCleartextTraffic is enabled in
  // the dev build so the app can reach a plain-HTTP backend during testing.
  // The keyboard plugin injects the native Android IME (Kotlin) at build time.
  plugins: ["expo-av", "./modules/tulmi-keyboard/plugin/withTulmiKeyboard"],
};

export default config;
