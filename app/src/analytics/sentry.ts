/**
 * Sentry wire-up (opt-in, no-op unless configured).
 *
 * How to activate for a real build:
 *   1. `npm install @sentry/react-native`
 *   2. `npx expo install @sentry/react-native` (patches Metro + native)
 *   3. Set `EXPO_PUBLIC_SENTRY_DSN` in the EAS build env (per profile).
 *   4. `expo prebuild` if you weren't using EAS Build.
 *
 * Until then this file is a no-op: `initSentry()` returns immediately and
 * `captureException` falls through to console. Nothing in the app tree cares
 * whether Sentry actually loaded — errors still surface, just to the local
 * device log instead of your dashboard.
 */

const DSN_KEY = "EXPO_PUBLIC_SENTRY_DSN";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sentry: any = null;
let ready = false;

function readDsn(): string | undefined {
  // process.env EXPO_PUBLIC_* is inlined at bundle time by Metro / Expo.
  const dsn = process.env[DSN_KEY];
  if (typeof dsn === "string" && dsn.trim()) return dsn.trim();
  return undefined;
}

/**
 * Bootstrap Sentry if a DSN is configured AND the SDK is installed.
 * Safe to call more than once — second call is a no-op.
 */
export async function initSentry(): Promise<void> {
  if (ready) return;
  const dsn = readDsn();
  if (!dsn) return;

  try {
    // Dynamic import so bundlers that don't have `@sentry/react-native`
    // installed simply throw here and we swallow it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require("@sentry/react-native");
    sentry.init({
      dsn,
      // TracesSampleRate low by default — mobile perf traces are expensive.
      tracesSampleRate: 0.05,
      // Don't ship device identifiers by default; a user can opt into full
      // context in Settings later.
      sendDefaultPii: false,
    });
    ready = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[sentry] DSN set but @sentry/react-native isn't installed — " +
        "run `npx expo install @sentry/react-native` to enable reporting.",
      err,
    );
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (ready && sentry) {
    try {
      sentry.captureException(err, context ? { extra: context } : undefined);
      return;
    } catch {
      /* fall through */
    }
  }
  // eslint-disable-next-line no-console
  console.error("[error]", err, context ?? {});
}
