/**
 * PrimeScreen — the "turn on instant voice" moment.
 *
 * Deep-linked from the iOS keyboard extension via `tulmi://prime` when the
 * keep-alive session isn't active (first launch, or after iOS eventually kills
 * the session). Job:
 *
 *   1. Start the silent background audio session immediately.
 *   2. Tell the user "You're all set — swipe up to go back."
 *   3. Do NOTHING that requires them to tap through screens. This is a hand-off
 *      moment, not an onboarding page.
 *
 * We deliberately do NOT try to programmatically send the user back to the
 * previous app: iOS has no such API for a third-party app, and any attempt to
 * fake it (opening a shared URL, etc.) is fragile and reads as a bug. The
 * user swipes home themselves — the whole point of the flow is that they only
 * do it once.
 */
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { startAudioKeepAlive } from "../modules/tulmi-bridge";

const BLACK = "#000000";
const WHITE = "#ffffff";
const MUTED = "rgba(255,255,255,0.55)";
const ACCENT = "#E8A23C";

export default function PrimeScreen() {
  const [state, setState] = useState<"priming" | "ready" | "failed">("priming");

  useEffect(() => {
    // Fire once at mount. The native call is synchronous but the App Group
    // write happens in a serial queue — a fresh render tick is enough for it
    // to publish before the keyboard reads.
    const { ok } = startAudioKeepAlive();
    setState(ok ? "ready" : "failed");
  }, []);

  const message = useMemo(() => {
    switch (state) {
      case "priming":
        return { title: "Turning on instant voice…", sub: "One moment." };
      case "ready":
        return {
          title: "You're all set.",
          sub: "Swipe up to keep using your other app —\nyour mic will now work in the keyboard, everywhere.",
        };
      case "failed":
        return {
          title: "Couldn't turn on instant voice.",
          sub: "Try again from Tailzu, or open the app and check permissions.",
        };
    }
  }, [state]);

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={[styles.dot, state === "ready" && styles.dotReady, state === "failed" && styles.dotFailed]} />
        <Text style={styles.title}>{message.title}</Text>
        <Text style={styles.sub}>{message.sub}</Text>
        {state === "ready" && (
          <View style={styles.arrowBlock}>
            <Text style={styles.arrow}>↑</Text>
            <Text style={styles.arrowLabel}>swipe up</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BLACK, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { alignItems: "center", maxWidth: 320 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: MUTED,
    marginBottom: 24,
  },
  dotReady: { backgroundColor: ACCENT },
  dotFailed: { backgroundColor: "#ff6b5b" },
  title: {
    color: WHITE,
    fontSize: 22,
    fontWeight: "300",
    letterSpacing: 0.2,
    textAlign: "center",
    marginBottom: 12,
  },
  sub: {
    color: MUTED,
    fontSize: 15,
    fontWeight: "300",
    lineHeight: 22,
    textAlign: "center",
  },
  arrowBlock: {
    marginTop: 40,
    alignItems: "center",
  },
  arrow: { color: WHITE, fontSize: 40, fontWeight: "200" },
  arrowLabel: { color: MUTED, fontSize: 12, marginTop: 6, letterSpacing: 0.4 },
});
