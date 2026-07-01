/**
 * Tulmi — app entry.
 *
 * The app is a GENERIC, server-driven renderer: it boots from the backend and
 * draws whatever screens/navigation/styling the server sends (see src/sdui).
 * There are no hardcoded screens here anymore — change the server, change the
 * app. The native keyboard lives separately (modules/tulmi-keyboard, targets/).
 *
 * Exception — the `tulmi://prime` deep link. When the iOS keyboard extension
 * needs to warm the background audio session so the user can dictate without an
 * app switch, it opens the app at that URL and we render PrimeScreen (a full
 * take-over, one moment, then the user swipes home). See src/PrimeScreen.tsx.
 */
import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import PrimeScreen from "./src/PrimeScreen";
import { initSentry } from "./src/analytics/sentry";
import SduiApp from "./src/sdui/SduiApp";

type Route = "sdui" | "prime";

function routeFor(url: string | null): Route {
  if (!url) return "sdui";
  // Accept `tulmi://prime` and `tulmi://prime?anything` (case-insensitive).
  return url.toLowerCase().startsWith("tulmi://prime") ? "prime" : "sdui";
}

export default function App() {
  const [route, setRoute] = useState<Route | null>(null);

  useEffect(() => {
    // Best-effort — errors here must never block the app from booting.
    initSentry();

    let cancelled = false;
    Linking.getInitialURL()
      .then((url) => {
        if (!cancelled) setRoute(routeFor(url));
      })
      .catch(() => {
        if (!cancelled) setRoute("sdui");
      });

    // If the app is already running and the user taps `tulmi://prime` again,
    // swap the current tree for PrimeScreen instead of stacking. When they
    // background/foreground later the SduiApp is the natural next screen.
    const sub = Linking.addEventListener("url", (evt) => {
      setRoute(routeFor(evt.url));
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  if (route === null) return null; // avoid flashing SduiApp before we know
  if (route === "prime") return <PrimeScreen />;
  return <SduiApp />;
}
