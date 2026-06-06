/**
 * What this renderer build can draw + do. Sent to the server in the capability
 * handshake so it never emits a node/action we can't handle.
 */
export const CORE_COMPONENTS = [
  "Screen", "Stack", "Spacer", "Text", "Image", "Icon", "Button",
  "TextField", "Chip", "Card", "List", "Divider", "ProgressBar", "VoiceButton",
] as const;

export const CORE_ACTIONS = [
  "navigate", "navigateBack", "switchTab", "openUrl", "dismiss",
  "callEndpoint", "refresh", "setState", "toggleState", "haptic",
  "toast", "playMedia", "speak", "sequence", "condition",
] as const;
