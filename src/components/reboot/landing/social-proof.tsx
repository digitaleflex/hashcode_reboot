"use client";

import * as React from "react";

/* ------------------------------------------------------------------ */
/* Social proof stat — footer stats bar                                */
/* ------------------------------------------------------------------ */

export function SocialProofStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-display font-bold text-2xl sm:text-3xl text-lime tabular-nums">
        {value}
      </span>
      <span className="soft-note text-center">
        {label}
      </span>
    </div>
  );
}

/** Live member count — fetches the public count from /api/community/count. */
export function LiveMemberCount() {
  const [count, setCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    fetch("/api/community/count", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) =>
        setCount(typeof d.count === "number" && d.count > 0 ? d.count : null),
      )
      .catch(() => setCount(null));
  }, []);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-display font-bold text-2xl sm:text-3xl text-lime tabular-nums">
        {count !== null ? `${count}` : "1ère"}
      </span>
      <span className="soft-note text-center">
        {count !== null ? "Profils déjà créés" : "Cohorte en cours"}
      </span>
    </div>
  );
}

export function SocialProofBar() {
  return (
    <div className="border-b border-border/60 bg-card/30">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        <SocialProofStat value="2026" label="Première cohorte ouverte" />
        <SocialProofStat value="3" label="Axes : web, cyber, IA" />
        <SocialProofStat value="~2 min" label="Profil par clic, sans friction" />
        <LiveMemberCount />
      </div>
    </div>
  );
}
