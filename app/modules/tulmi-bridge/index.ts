import { requireNativeModule } from "expo-modules-core";

export interface KeyboardStatus {
  /** The keyboard has run at least once (iOS) / the IME is enabled (Android). */
  enabled: boolean;
  /** iOS: "Allow Full Access" granted. Android: same as enabled. */
  fullAccess: boolean;
  /** iOS: epoch-ms the keyboard last ran (0 if never). */
  lastActiveMs: number;
}

export interface AudioKeepAliveState {
  /** iOS: silent background AVAudioSession is running. Android: always true. */
  ready: boolean;
  /** epoch-ms when the session was (last) primed; 0 if never. */
  readyAtMs: number;
}

interface TulmiBridgeNative {
  setKeyboardCredentials(baseUrl: string, token: string): void;
  getKeyboardStatus?(): KeyboardStatus | undefined;
  setDictionary?(json: string): void;
  startAudioKeepAlive?(): { ok: boolean; readyAtMs: number };
  stopAudioKeepAlive?(): boolean;
  getAudioKeepAliveState?(): AudioKeepAliveState;
}

// The native module exists only in dev/prod builds (not in Expo Go). Resolve it
// lazily and fall back to a no-op so the JS app still runs everywhere.
let native: TulmiBridgeNative | null = null;
try {
  native = requireNativeModule("TulmiBridge") as unknown as TulmiBridgeNative;
} catch {
  native = null;
}

/**
 * Share the app's backend URL + the signed-in user's token with the native
 * keyboard extension so the keyboard reaches the same backend as the app and
 * authenticates as the user.
 *
 *  - iOS: written to the shared App Group `group.com.tulmi.app` (UserDefaults).
 *  - Android: written to the app's `tulmi` SharedPreferences (the IME, same
 *    package, reads them directly).
 *
 * No-op in Expo Go (native module absent). Never throws.
 */
export function setKeyboardCredentials(baseUrl: string, token: string): void {
  try {
    native?.setKeyboardCredentials(baseUrl, token);
  } catch {
    // Bridging is best-effort; never let it break the app.
  }
}

/**
 * The keyboard's current state (enabled + Full Access), read from the shared
 * container. Returns null when the bridge isn't available (Expo Go) so callers
 * can fall back gracefully instead of trapping the user.
 */
export function getKeyboardStatus(): KeyboardStatus | null {
  try {
    const s = native?.getKeyboardStatus?.();
    if (!s) return null;
    return { enabled: !!s.enabled, fullAccess: !!s.fullAccess, lastActiveMs: Number(s.lastActiveMs) || 0 };
  } catch {
    return null;
  }
}

/**
 * Push the user's text-expansion dictionary to the keyboard via the shared
 * container (App Group on iOS / SharedPreferences on Android). The keyboard
 * reads this and expands a typed trigger word into its replacement.
 * `entries` is a list of { word, replacement }.
 */
export function setKeyboardDictionary(entries: { word: string; replacement: string }[]): void {
  try {
    native?.setDictionary?.(JSON.stringify(entries ?? []));
  } catch {
    // best-effort; never block the app
  }
}

/** True when the native bridge is available (a dev/prod build, not Expo Go). */
export function isBridgeAvailable(): boolean {
  return native != null;
}

/**
 * Prime the "instant voice" background audio session so the keyboard can
 * record on demand in any host app. On iOS this holds a silent
 * `.playAndRecord` AVAudioSession alive under the app's `Background Modes:
 * audio` capability; on Android this is a no-op (Android IMEs record freely
 * with RECORD_AUDIO). Returns { ok: true } when the session is active.
 */
export function startAudioKeepAlive(): { ok: boolean; readyAtMs: number } {
  try {
    const r = native?.startAudioKeepAlive?.();
    return r ?? { ok: false, readyAtMs: 0 };
  } catch {
    return { ok: false, readyAtMs: 0 };
  }
}

/** Turn off the keep-alive (a Settings toggle can call this). */
export function stopAudioKeepAlive(): void {
  try {
    native?.stopAudioKeepAlive?.();
  } catch {
    /* best-effort */
  }
}

/**
 * Whether the keep-alive is currently active. Read from the shared App Group
 * flag so the answer matches what the keyboard sees. Returns
 * { ready: false, readyAtMs: 0 } when the bridge isn't available.
 */
export function getAudioKeepAliveState(): AudioKeepAliveState {
  try {
    const s = native?.getAudioKeepAliveState?.();
    if (!s) return { ready: false, readyAtMs: 0 };
    return { ready: !!s.ready, readyAtMs: Number(s.readyAtMs) || 0 };
  } catch {
    return { ready: false, readyAtMs: 0 };
  }
}
