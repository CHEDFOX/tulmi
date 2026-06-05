/**
 * Experience service — the screen catalog.
 *
 * This is where the backend "owns the UI". Each screen is built as data (a tree
 * of SDUI Nodes) and handed to the generic renderer in the app. Change these
 * builders → the app changes, with no client rebuild.
 *
 * See ../../../shared/types/sdui.ts for the contract.
 */
import type {
  BootstrapResponse,
  NavigationShell,
  Node,
  ScreenResponse,
  ThemeTokens,
} from "../../../shared/types/sdui.js";
import { SDUI_SCHEMA_VERSION } from "../../../shared/types/sdui.js";
import type { Personality } from "../../../shared/types/api.js";

// --- Global theme -----------------------------------------------------------

export const THEME: ThemeTokens = {
  color: {
    bg: "#0e0e12",
    surface: "#15151b",
    card: "#12121a",
    inputBg: "#1c1c25",
    border: "#2a2a36",
    primary: "#5b4bff",
    text: "#ffffff",
    muted: "#8a8a96",
    label: "#cfcfe0",
    danger: "#c0392b",
    success: "#4caf50",
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { sm: 6, md: 10, pill: 999 },
  font: {
    sizes: { caption: 12, label: 13, body: 15, h1: 20, brand: 24 },
    weights: { regular: "400", bold: "700", heavy: "800" },
  },
};

const NAV: NavigationShell = {
  kind: "tabs",
  tabs: [
    { id: "home", title: "Home", screenId: "home" },
    { id: "personality", title: "Personality", screenId: "personality" },
  ],
};

// --- Small Node helpers (keep builders readable) ----------------------------

const text = (content: string, variant = "body", extra: Partial<Node> = {}): Node => ({
  type: "Text",
  props: { content, variant },
  ...extra,
});

const spacer = (height: number): Node => ({ type: "Spacer", style: { height } });

// --- Bootstrap --------------------------------------------------------------

export function buildBootstrap(): BootstrapResponse {
  return {
    schemaVersion: SDUI_SCHEMA_VERSION,
    theme: THEME,
    navigation: NAV,
    initialScreenId: "home",
    flags: {},
    cacheTtlSeconds: 300,
  };
}

// --- Screens ----------------------------------------------------------------

export interface ScreenContext {
  personality: Personality;
}

export function buildScreen(screenId: string, ctx: ScreenContext): ScreenResponse | null {
  switch (screenId) {
    case "home":
      return homeScreen();
    case "personality":
      return personalityScreen(ctx.personality);
    default:
      return null;
  }
}

/** The refine playground — proves the full SDUI loop incl. a brain call. */
function homeScreen(): ScreenResponse {
  return {
    schemaVersion: SDUI_SCHEMA_VERSION,
    screenId: "home",
    title: "Tulmi",
    state: {
      input: "hey can we meet kal at 5 i think um",
      busy: false,
      result: {},
    },
    actions: {
      refine: {
        kind: "sequence",
        actions: [
          { kind: "setState", path: "busy", value: true },
          {
            kind: "callEndpoint",
            method: "POST",
            path: "/v1/refine",
            body: { text: "$state.input", targetApp: "WhatsApp", language: "auto" },
            assignTo: "result",
            onSuccess: "refineDone",
            onError: "refineErr",
          },
        ],
      },
      refineDone: {
        kind: "sequence",
        actions: [
          { kind: "setState", path: "busy", value: false },
          { kind: "haptic", style: "success" },
        ],
      },
      refineErr: {
        kind: "sequence",
        actions: [
          { kind: "setState", path: "busy", value: false },
          { kind: "toast", message: "Couldn't reach the backend. Check ⚙ Connection.", tone: "error" },
        ],
      },
    },
    root: {
      type: "Screen",
      children: [
        text("Playground", "h1"),
        text("Type something rough, then let Tulmi polish it.", "muted"),
        spacer(12),
        text("Your text", "label"),
        {
          type: "TextField",
          bind: { value: "input" },
          props: { placeholder: "Type here…", multiline: true },
        },
        spacer(10),
        {
          type: "Button",
          props: { label: "✨ Refine", variant: "primary" },
          on: { onPress: "refine" },
        },
        spacer(16),
        { type: "ProgressBar", visibleIf: { truthy: "busy" } },
        {
          type: "Card",
          visibleIf: { truthy: "result.refinedText" },
          motion: { appear: "fadeInUp" },
          children: [text("", "body", { bind: { content: "result.refinedText" } })],
        },
      ],
    },
    cacheTtlSeconds: 0,
  };
}

/** The personality form — server seeds it with the user's saved profile. */
function personalityScreen(p: Personality): ScreenResponse {
  const chip = (label: string, group: string, value: string): Node => ({
    type: "Chip",
    props: { label, group, value },
    on: { onPress: { kind: "haptic", style: "selection" } },
  });

  return {
    schemaVersion: SDUI_SCHEMA_VERSION,
    screenId: "personality",
    title: "Your personality",
    state: {
      form: {
        tone: p.tone ?? "",
        formality: p.formality ?? "neutral",
        emoji: p.emoji ?? "minimal",
        customInstructions: p.customInstructions ?? "",
        signature: p.signature ?? "",
      },
      status: "",
    },
    actions: {
      save: {
        kind: "sequence",
        actions: [
          { kind: "setState", path: "status", value: "Saving…" },
          {
            kind: "callEndpoint",
            method: "PUT",
            path: "/v1/personality",
            body: "$state.form",
            onSuccess: "saved",
            onError: "saveErr",
          },
        ],
      },
      saved: {
        kind: "sequence",
        actions: [
          { kind: "setState", path: "status", value: "Saved. Tulmi will write in this voice." },
          { kind: "haptic", style: "success" },
        ],
      },
      saveErr: { kind: "toast", message: "Couldn't save. Check ⚙ Connection.", tone: "error" },
    },
    root: {
      type: "Screen",
      children: [
        text("Your personality", "h1"),
        text("Set once — applied to everything Tulmi writes for you.", "muted"),
        spacer(12),

        text("Tone", "label"),
        { type: "TextField", bind: { value: "form.tone" }, props: { placeholder: "warm and concise, a little witty" } },

        spacer(12),
        text("Formality", "label"),
        {
          type: "Stack",
          style: { direction: "row", gap: 8 },
          children: [
            chip("casual", "form.formality", "casual"),
            chip("neutral", "form.formality", "neutral"),
            chip("formal", "form.formality", "formal"),
          ],
        },

        spacer(12),
        text("Emoji", "label"),
        {
          type: "Stack",
          style: { direction: "row", gap: 8 },
          children: [
            chip("none", "form.emoji", "none"),
            chip("minimal", "form.emoji", "minimal"),
            chip("expressive", "form.emoji", "expressive"),
          ],
        },

        spacer(12),
        text("Extra instructions", "label"),
        {
          type: "TextField",
          bind: { value: "form.customInstructions" },
          props: { placeholder: "avoid exclamation marks; British spelling", multiline: true },
        },

        spacer(16),
        { type: "Button", props: { label: "Save personality", variant: "primary" }, on: { onPress: "save" } },
        spacer(8),
        text("", "muted", { bind: { content: "status" } }),
      ],
    },
    cacheTtlSeconds: 0,
  };
}
