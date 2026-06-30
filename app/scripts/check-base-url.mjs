#!/usr/bin/env node
/**
 * Drift guard for BACKEND_BASE_URL.
 *
 * The default backend URL lives in three places (JS bundle, Android Kotlin
 * keyboard, iOS Swift keyboard extension). They MUST stay in sync — the
 * keyboards' runtime overrides come from the main app via SharedPreferences /
 * App Group UserDefaults, but the fallback string each one carries is what
 * users hit on a fresh install before the override is written.
 *
 * This script extracts the URL from each source and exits non-zero if they
 * disagree. Wire it into `npm run check:base-url` and CI.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const SOURCES = [
  {
    label: "app/src/config.ts (BACKEND_BASE_URL)",
    path: resolve(root, "src/config.ts"),
    pattern: /BACKEND_BASE_URL\s*=\s*"([^"]+)"/,
  },
  {
    label: "modules/tulmi-keyboard/android/Net.kt (baseUrl)",
    path: resolve(root, "modules/tulmi-keyboard/android/Net.kt"),
    pattern: /var\s+baseUrl:\s*String\s*=\s*"([^"]+)"/,
  },
  {
    label: "targets/keyboard/TulmiBackend.swift (baseUrl fallback)",
    path: resolve(root, "targets/keyboard/TulmiBackend.swift"),
    // The string literal in the `(v?.isEmpty == false) ? v! : "..."` fallback.
    pattern: /\?\s*v!\s*:\s*"([^"]+)"/,
  },
];

const found = SOURCES.map((s) => {
  const text = readFileSync(s.path, "utf8");
  const m = text.match(s.pattern);
  if (!m) {
    console.error(`✗ could not find URL in ${s.label} (${s.path})`);
    process.exit(2);
  }
  return { ...s, url: m[1] };
});

const distinct = new Set(found.map((f) => f.url));
if (distinct.size === 1) {
  console.log(`✓ BACKEND_BASE_URL in sync: ${[...distinct][0]}`);
  for (const f of found) console.log(`    ${f.label}`);
  process.exit(0);
}

console.error("✗ BACKEND_BASE_URL drift detected:");
for (const f of found) console.error(`    ${f.url}\n      ← ${f.label}`);
console.error(
  "\nFix: edit each file so the URL matches, then re-run `npm run check:base-url`.\n" +
    "The canonical source is app/src/config.ts (BACKEND_BASE_URL).",
);
process.exit(1);
