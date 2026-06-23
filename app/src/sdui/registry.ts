/**
 * What this renderer build can draw + do. Sent to the server in the capability
 * handshake so it never emits a node/action we can't handle.
 */
export const CORE_COMPONENTS = [
  "Screen", "Stack", "Spacer", "Text", "Image", "Icon", "Button",
  "TextField", "Chip", "Card", "List", "Divider", "ProgressBar", "VoiceButton",
  // SDUI v2 content blocks:
  "Heading", "Paragraph", "Badge", "KeyValue", "Hero",
] as const;

export const CORE_ACTIONS = [
  "navigate", "navigateBack", "switchTab", "openUrl", "dismiss",
  "callEndpoint", "refresh", "setState", "toggleState", "haptic",
  "toast", "playMedia", "speak", "sequence", "condition",
] as const;

/** Named layouts the app can compose from `template` + `blocks`. */
export const CORE_TEMPLATES = ["scroll", "feature", "list", "centered"] as const;
