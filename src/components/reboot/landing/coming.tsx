"use client";

import { MonoLabel, SectionHeader } from "../shared";
import { cn } from "@/lib/utils";
import { COMING } from "./data";

export function Coming() {
  return (
    <section className="mx-auto max-w-6xl w-full px-5 sm:px-8 py-16 sm:py-24 cv-auto">
      <SectionHeader
        index="05 · La suite, concrètement"
        title="Le Reboot, c'est maintenant."
        intro="Les premiers membres ouvrent la voie. Voici l'ordre réel."
        className="mb-10"
      />
      <ol className="relative grid gap-px bg-border/60 border border-border/60 rounded-md overflow-hidden">
        {COMING.map((c, i) => (
          <li
            key={c.t}
            className="bg-card p-6 sm:p-7 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 items-start"
          >
            <MonoLabel className={cn(c.live ? "text-lime" : "text-muted-foreground")}>
              {String(i + 1).padStart(2, "0")}
            </MonoLabel>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display font-semibold text-foreground">
                  {c.t}
                </h3>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium tracking-[0.01em] leading-none",
                    c.live
                      ? "border-lime/60 text-lime bg-lime/10"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {c.live && (
                    <span className="mr-1.5 size-1.5 rounded-full bg-lime animate-hash-pulse" aria-hidden />
                  )}
                  {c.status}
                </span>
              </div>
              <p className="text-muted-foreground text-sm mt-1">{c.d}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
