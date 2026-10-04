"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Link as I18nLink } from "@/i18n/routing";
import { SectionHeader, CtaArrow } from "../shared";
import { Reveal } from "../motion/primitives";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Miroir de `PublicEvent` (src/lib/public-events.ts) — sous-ensemble utilisé. */
type PublicEvent = {
  id: string;
  title: string;
  startsAt: string;
  location: string | null;
  url: string | null;
  type: string;
  level: string | null;
  status: string;
  goingCount: number;
  interestCount: number;
};

const LIMIT = 3;

/**
 * §20 — LIVE ACTIVITY.
 *
 * 100 % données réelles : `GET /api/public/events` ne renvoie que les
 * événements `scheduled` / `live` et uniquement des compteurs agrégés
 * (`goingCount`, `interestCount`) — aucune donnée personnelle.
 *
 * Aucune activité n'est simulée : si l'API ne répond pas ou renvoie zéro
 * événement, on affiche un état vide explicite plutôt qu'un leurre.
 */
export function Activity() {
  const t = useTranslations("landing.activity");
  const locale = useLocale();

  const [events, setEvents] = React.useState<PublicEvent[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/public/events?limit=${LIMIT}`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { ok?: boolean; events?: PublicEvent[] }) => {
        setEvents(Array.isArray(d.events) ? d.events : []);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFailed(true);
      });
    return () => ctrl.abort();
  }, []);

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [locale],
  );

  const tType = useTranslations("landing.activity.types");
  const tLevel = useTranslations("landing.activity.levels");

  const list = events ?? [];

  /** Badge de type : clés i18n inconnues → on retombe sur la valeur brute. */
  const typeLabel = (v: string) => {
    try {
      return tType(v as never);
    } catch {
      return v;
    }
  };
  const levelLabel = (v: string) => {
    try {
      return tLevel(v as never);
    } catch {
      return v;
    }
  };

  return (
    <section
      id="activite"
      className="section border-t border-border/60"
      aria-labelledby="activity-title"
    >
      <div className="shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeader
            index={t("index")}
            title={<span id="activity-title">{t("title")}</span>}
            intro={t("intro")}
          />
          <I18nLink
            href="/evenements"
            className="group inline-flex min-h-[44px] items-center gap-2 text-sm text-foreground underline-offset-4 transition-colors hover:text-lime focus-lime hover:underline"
          >
            {t("cta")}
            <CtaArrow className="size-3.5" />
          </I18nLink>
        </div>

        {/* États de chargement / vide / erreur — jamais de données factices. */}
        {events === null && !failed ? (
          <ul role="list" className="mt-12 grid gap-4 md:grid-cols-3">
            {Array.from({ length: LIMIT }).map((_, i) => (
              <li
                key={i}
                aria-hidden
                className="h-[168px] animate-pulse rounded-lg border border-border/60 bg-card/30"
              />
            ))}
          </ul>
        ) : failed ? (
          <p role="status" className="mt-12 text-sm text-muted-foreground">
            {t("error")}
          </p>
        ) : list.length === 0 ? (
          <p role="status" className="mt-12 text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ul role="list" className="mt-12 grid gap-4 md:grid-cols-3">
            {list.map((e, i) => (
              <Reveal as="li" key={e.id} delay={i * 0.07} className="flex">
                <article className="flex w-full flex-col rounded-lg border border-border/70 bg-card/40 p-5 transition-colors hover:border-lime/40">
                  {/* Badges : statut réel + type réel */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "mono-label inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
                        e.status === "live"
                          ? "border-lime/50 bg-lime/5 text-lime"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {e.status === "live" && (
                        <span
                          className="size-1 rounded-full bg-lime"
                          aria-hidden
                        />
                      )}
                      {e.status === "live" ? t("statusLive") : t("statusScheduled")}
                    </span>
                    <span className="mono-label rounded-sm border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {typeLabel(e.type)}
                    </span>
                    {e.level && (
                      <span className="text-[11px] text-muted-foreground">
                        {levelLabel(e.level)}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 font-display text-base font-semibold leading-snug text-foreground">
                    {e.title}
                  </h3>

                  <dl className="mt-4 flex flex-col gap-1.5 text-[13px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                      <dt className="sr-only">{t("metaDate")}</dt>
                      <dd>
                        <time dateTime={e.startsAt}>
                          {dateFmt.format(new Date(e.startsAt))}
                        </time>
                      </dd>
                    </div>
                    {e.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="size-3.5 shrink-0" aria-hidden />
                        <dt className="sr-only">{t("metaLocation")}</dt>
                        <dd className="truncate">{e.location}</dd>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="size-3.5 shrink-0" aria-hidden />
                      <dt className="sr-only">{t("metaAttendees")}</dt>
                      <dd>
                        {t("going", { count: e.goingCount })}
                        {e.interestCount > 0 &&
                          ` · ${t("interest", { count: e.interestCount })}`}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-auto pt-5">
                    {e.url ? (
                      <Link
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex min-h-[44px] items-center gap-2 text-sm text-lime underline-offset-4 hover:underline focus-lime"
                      >
                        {t("cta")}
                        <CtaArrow className="size-3.5" />
                      </Link>
                    ) : (
                      <I18nLink
                        href="/evenements"
                        className="group inline-flex min-h-[44px] items-center gap-2 text-sm text-lime underline-offset-4 hover:underline focus-lime"
                      >
                        {t("cta")}
                        <CtaArrow className="size-3.5" />
                      </I18nLink>
                    )}
                  </div>
                </article>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}