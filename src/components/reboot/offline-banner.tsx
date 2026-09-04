"use client";

import * as React from "react";
import { Wifi, WifiOff } from "lucide-react";

/** Offline detection banner — shows a warning when the browser loses
 * connectivity. Uses navigator.onLine + online/offline events. */
export function OfflineBanner() {
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 text-black px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 animate-hash-slide-up">
      <WifiOff className="size-4" />
      Tu es hors-ligne. Tes réponses sont sauvegardées — reconnecte-toi pour soumettre ton profil.
    </div>
  );
}
