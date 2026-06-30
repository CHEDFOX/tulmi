/**
 * Single source of truth for build-time constants the whole app shares with
 * its native modules (Android IME keyboard, iOS keyboard extension).
 *
 * The TS bundle, the Android Kotlin keyboard (modules/tulmi-keyboard/android/Net.kt),
 * and the iOS keyboard extension (targets/keyboard/TulmiBackend.swift) all need
 * the same default backend URL. Whenever you change BACKEND_BASE_URL here,
 * run `npm run check:base-url` to verify Net.kt + TulmiBackend.swift match —
 * CI runs the same check and fails the PR if they drift.
 */

/**
 * Default backend URL baked into the bundle. Users can override at runtime via
 * the in-app ⚙ Connection screen (persisted to AsyncStorage `tulmi.baseUrl`);
 * the native keyboards pick up that override via the App Group / SharedPreferences
 * bridge written by tulmi-bridge.
 */
export const BACKEND_BASE_URL = "https://api.tailzu.space";
