/**
 * Tulmi — Expo app shell (both platforms). This is the "main app": settings,
 * personality, and a quick playground to test the backend. The actual keyboard
 * is a native module (added next), not part of this React Native tree.
 */
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Audio } from "expo-av";
import {
  DEFAULT_BASE_URL,
  getBaseUrl,
  setBaseUrl,
} from "./src/storage";
import * as api from "./src/api";
import type { Personality } from "./src/api";

type Tab = "home" | "settings" | "personality";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  return (
    <View style={styles.app}>
      <View style={styles.header}>
        <Text style={styles.brand}>Tulmi</Text>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={{ padding: 16 }}>
        {tab === "home" && <HomeScreen />}
        {tab === "settings" && <SettingsScreen />}
        {tab === "personality" && <PersonalityScreen />}
      </ScrollView>
      <View style={styles.tabs}>
        <TabButton label="Home" active={tab === "home"} onPress={() => setTab("home")} />
        <TabButton label="Personality" active={tab === "personality"} onPress={() => setTab("personality")} />
        <TabButton label="Settings" active={tab === "settings"} onPress={() => setTab("settings")} />
      </View>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

// --- Home: backend playground (voice + typing) ------------------------------

function HomeScreen() {
  const [typed, setTyped] = useState("hey can we meet kal at 5 i think um");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<Audio.Recording | null>(null);

  async function onRefine() {
    setBusy(true);
    setOut("");
    try {
      const { refinedText } = await api.refine(typed, { targetApp: "WhatsApp", language: "auto" });
      setOut(refinedText);
    } catch (e: any) {
      setOut("Error: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function startRec() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setOut("Microphone permission denied.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recRef.current = recording;
      setRecording(true);
    } catch (e: any) {
      setOut("Mic error: " + e.message);
    }
  }

  async function stopRec() {
    const rec = recRef.current;
    setRecording(false);
    if (!rec) return;
    setBusy(true);
    setOut("");
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recRef.current = null;
      if (!uri) throw new Error("No audio captured");
      const { cleanedText } = await api.transcribeClean(uri, { targetApp: "WhatsApp", language: "auto" });
      setOut(cleanedText);
    } catch (e: any) {
      setOut("Error: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Text style={styles.h1}>Playground</Text>
      <Text style={styles.muted}>Test the backend before the keyboard is wired up.</Text>

      <Text style={styles.label}>Type something rough, then refine it:</Text>
      <TextInput style={styles.input} value={typed} onChangeText={setTyped} multiline />
      <Btn label="✨ Refine" onPress={onRefine} disabled={busy} />

      <View style={{ height: 12 }} />
      <Text style={styles.label}>Or speak:</Text>
      <Btn
        label={recording ? "■ Stop & transcribe" : "🎙️ Record"}
        onPress={recording ? stopRec : startRec}
        disabled={busy}
        variant={recording ? "danger" : "primary"}
      />

      <View style={{ height: 16 }} />
      {busy && <ActivityIndicator />}
      {!!out && (
        <View style={styles.outBox}>
          <Text style={styles.outText}>{out}</Text>
        </View>
      )}
    </View>
  );
}

// --- Settings: backend URL --------------------------------------------------

function SettingsScreen() {
  const [url, setUrl] = useState(DEFAULT_BASE_URL);
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    getBaseUrl().then((u) => {
      setUrl(u);
      setLoaded(true);
    });
  }

  async function save() {
    await setBaseUrl(url);
    setStatus("Saved.");
  }

  async function test() {
    setStatus("Checking...");
    try {
      await setBaseUrl(url);
      const h = await api.health();
      setStatus(`OK — ${h.service} v${h.version}`);
    } catch (e: any) {
      setStatus("Cannot reach backend: " + e.message);
    }
  }

  return (
    <View>
      <Text style={styles.h1}>Settings</Text>
      <Text style={styles.label}>Backend URL</Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="http://10.0.2.2:8770 or https://your-vps"
      />
      <Text style={styles.muted}>
        Emulator → your PC = http://10.0.2.2:8770. Physical phone → your PC's LAN IP, or your VPS URL.
      </Text>
      <View style={{ height: 8 }} />
      <Btn label="Save" onPress={save} />
      <View style={{ height: 8 }} />
      <Btn label="Test connection" onPress={test} variant="secondary" />
      {!!status && <Text style={styles.status}>{status}</Text>}
    </View>
  );
}

// --- Personality ------------------------------------------------------------

function PersonalityScreen() {
  const [p, setP] = useState<Personality>({});
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    api
      .getPersonality()
      .then((v) => {
        setP(v);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }

  async function save() {
    setStatus("Saving...");
    try {
      await api.putPersonality(p);
      setStatus("Saved. Tulmi will write in this voice.");
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  }

  return (
    <View>
      <Text style={styles.h1}>Your personality</Text>
      <Text style={styles.muted}>Set once — applied to everything Tulmi writes for you.</Text>

      <Text style={styles.label}>Tone</Text>
      <TextInput
        style={styles.input}
        value={p.tone ?? ""}
        onChangeText={(t) => setP({ ...p, tone: t })}
        placeholder="warm and concise, a little witty"
      />

      <Text style={styles.label}>Formality</Text>
      <Row>
        {(["casual", "neutral", "formal"] as const).map((f) => (
          <Chip key={f} label={f} active={p.formality === f} onPress={() => setP({ ...p, formality: f })} />
        ))}
      </Row>

      <Text style={styles.label}>Emoji</Text>
      <Row>
        {(["none", "minimal", "expressive"] as const).map((e) => (
          <Chip key={e} label={e} active={p.emoji === e} onPress={() => setP({ ...p, emoji: e })} />
        ))}
      </Row>

      <Text style={styles.label}>Extra instructions</Text>
      <TextInput
        style={styles.input}
        value={p.customInstructions ?? ""}
        onChangeText={(t) => setP({ ...p, customInstructions: t })}
        placeholder="avoid exclamation marks; British spelling"
        multiline
      />

      <View style={{ height: 8 }} />
      <Btn label="Save personality" onPress={save} />
      {!!status && <Text style={styles.status}>{status}</Text>}
    </View>
  );
}

// --- Small UI helpers -------------------------------------------------------

function Btn({
  label,
  onPress,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const bg = variant === "danger" ? "#c0392b" : variant === "secondary" ? "#444" : "#5b4bff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: "#0e0e12" },
  header: { paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: "#0e0e12" },
  brand: { color: "#fff", fontSize: 24, fontWeight: "800" },
  body: { flex: 1 },
  tabs: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#222", backgroundColor: "#15151b" },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderTopWidth: 2, borderTopColor: "#5b4bff" },
  tabText: { color: "#888", fontSize: 13 },
  tabTextActive: { color: "#fff", fontWeight: "700" },
  h1: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 6 },
  muted: { color: "#8a8a96", fontSize: 13, marginBottom: 12 },
  label: { color: "#cfcfe0", fontSize: 13, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: "#1c1c25",
    color: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#2a2a36",
  },
  btn: { borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  outBox: { backgroundColor: "#12121a", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#2a2a36" },
  outText: { color: "#eaeaf2", fontSize: 16, lineHeight: 22 },
  status: { color: "#9b9bd0", marginTop: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#1c1c25",
    borderWidth: 1,
    borderColor: "#2a2a36",
  },
  chipActive: { backgroundColor: "#5b4bff", borderColor: "#5b4bff" },
  chipText: { color: "#aaa" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
});
