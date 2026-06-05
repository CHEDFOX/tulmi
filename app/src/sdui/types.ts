/**
 * SDUI types (client mirror of ../../../shared/types/sdui.ts).
 *
 * Kept local so the Expo bundler doesn't reach outside the app package — same
 * pattern as src/api.ts. Keep in sync with the shared source of truth.
 */

export interface ThemeTokens {
  color: Record<string, string>;
  space: Record<string, number>;
  radius: Record<string, number>;
  font: { family?: string; sizes: Record<string, number>; weights: Record<string, string> };
}

export type NavigationShell =
  | { kind: "tabs"; tabs: Array<{ id: string; title: string; icon?: string; screenId: string }> }
  | { kind: "stack"; rootScreenId: string };

export interface BootstrapResponse {
  schemaVersion: number;
  theme: ThemeTokens;
  navigation: NavigationShell;
  initialScreenId: string;
  flags?: Record<string, boolean | number | string>;
  cacheTtlSeconds?: number;
}

export type NodeEvent =
  | "onPress" | "onLongPress" | "onChange" | "onSubmit"
  | "onAppear" | "onDisappear" | "onRefresh" | "onEndReached";

export interface MotionSpec {
  appear?: string;
  exit?: string;
  durationMs?: number;
  delayMs?: number;
  loop?: boolean;
}

export interface Node {
  type: string;
  id?: string;
  props?: Record<string, any>;
  style?: Record<string, any>;
  children?: Node[];
  bind?: Record<string, string>;
  on?: Partial<Record<NodeEvent, ActionRef>>;
  motion?: MotionSpec;
  visibleIf?: Condition;
  fallback?: Node;
}

export interface ScreenResponse {
  schemaVersion: number;
  screenId: string;
  title?: string;
  theme?: Partial<ThemeTokens>;
  root: Node;
  state?: Record<string, any>;
  actions?: Record<string, ActionSpec>;
  cacheTtlSeconds?: number;
}

export type ActionRef = string | ActionSpec;

export type ActionSpec =
  | { kind: "navigate"; screenId: string; params?: Record<string, any> }
  | { kind: "navigateBack" }
  | { kind: "switchTab"; tabId: string }
  | { kind: "openUrl"; url: string; external?: boolean }
  | { kind: "dismiss" }
  | {
      kind: "callEndpoint";
      method: "GET" | "POST" | "PUT" | "DELETE";
      path: string;
      body?: Record<string, any> | string;
      assignTo?: string;
      onSuccess?: ActionRef;
      onError?: ActionRef;
    }
  | { kind: "refresh" }
  | { kind: "setState"; path: string; value: any }
  | { kind: "toggleState"; path: string }
  | { kind: "haptic"; style: string }
  | { kind: "toast"; message: string; tone?: "info" | "success" | "error" }
  | { kind: "playMedia"; url: string }
  | { kind: "speak"; text: string }
  | { kind: "sequence"; actions: ActionRef[] }
  | { kind: "condition"; if: Condition; then: ActionRef; else?: ActionRef };

export type Condition =
  | { eq: [string, any] }
  | { neq: [string, any] }
  | { truthy: string }
  | { not: Condition }
  | { all: Condition[] }
  | { any: Condition[] };
