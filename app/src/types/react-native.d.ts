/**
 * The version of react-native we're on (0.85.x) exposes `StyleSheet.absoluteFill`
 * but dropped the `absoluteFillObject` declaration. The constant still exists
 * at runtime — see Libraries/StyleSheet/StyleSheet.js — and this codebase uses
 * it via spread (`{ ...StyleSheet.absoluteFillObject, ... }`). Re-augment the
 * type so `tsc --noEmit` (now run in CI) doesn't trip on it.
 *
 * Docs: https://reactnative.dev/docs/stylesheet#absolutefillobject
 */
declare module "react-native" {
  namespace StyleSheet {
    interface AbsoluteFillObjectStyle {
      position: "absolute";
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
    }
    const absoluteFillObject: AbsoluteFillObjectStyle;
  }
}

export {};
