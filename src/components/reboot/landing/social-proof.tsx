"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("landing.footer.liveCount");
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
        {count !== null ? `${count}` : t("valueEmpty")}
      </span>
      <span className="soft-note text-center">
        {count !== null ? t("labelWithCount") : t("labelEmpty")}
      </span>
    </div>
  );
}

export function SocialProofBar() {
  const t = useTranslations("landing.footer");
  const socialProof = t.raw("socialProof") as Array<{ value: string; label: string }>;
  return (
    <div className="border-b border-border/60 bg-card/30">
      {/* 2 statistiques produit + le compteur réel = 3 cellules. */}
      <div className="shell grid grid-cols-1 gap-4 py-6 text-center sm:grid-cols-3">
        {socialProof.map((stat, i) => (
          <SocialProofStat key={i} value={stat.value} label={stat.label} />
        ))}
        <LiveMemberCount />
      </div>
    </div>
  );
}