import * as React from "react";
import { CheckCircle2, Clock, Hourglass, MessageCircle, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { AccountStatus } from "./types";

/** Tous les accès WhatsApp passent par /api/community/join (traçage + redirection). */
const COMMUNITY_JOIN_URL = "/api/community/join";

/**
 * Section "Statut & prochaines étapes".
 * Server component : pas d'interaction directe (sauf le bouton WhatsApp).
 *
 * Variantes :
 *  - APPROVED : lien WhatsApp + confirmation
 *  - PENDING : explication + suggestion (mettre à jour l'objectif)
 *  - WAITLIST : "On revient vers toi"
 *  - REJECTED : message neutre + invitation à mettre à jour
 */
export async function StatusSection({ status }: { status: AccountStatus }) {
  const t = await getTranslations("account.status");

  switch (status.profileStatus) {
    case "APPROVED":
      return <Approved t={t} />;
    case "PENDING":
      return <Pending t={t} />;
    case "WAITLIST":
      return <Waitlist t={t} />;
    case "REJECTED":
      return <Rejected t={t} />;
    default:
      return null;
  }
}

function Approved({ t }: { t: (key: string, values?: Record<string, string | number | Date>) => string }) {
  return (
    <section className="rounded-md border border-lime/30 bg-lime/5 p-5 sm:p-6 space-y-3">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="size-5 text-lime shrink-0 mt-0.5" />
        <div>
          <h2 className="font-display font-bold text-lg">{t("approved.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("approved.description")}
          </p>
        </div>
      </div>
      <a
        href={COMMUNITY_JOIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-md bg-lime text-black hover:bg-lime/90 font-medium border border-transparent min-h-[48px] h-12 px-6 text-base w-full sm:w-auto"
      >
        <MessageCircle className="size-4" />
        {t("approved.whatsappButton")}
      </a>
    </section>
  );
}

function Pending({ t }: { t: (key: string, values?: Record<string, string | number | Date>) => string }) {
  return (
    <section className="rounded-md border border-amber-500/30 bg-amber-500/5 p-5 sm:p-6 space-y-3">
      <div className="flex items-start gap-3">
        <Clock className="size-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-display font-bold text-lg">{t("pending.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("pending.description")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("pending.tip")}
          </p>
        </div>
      </div>
    </section>
  );
}

function Waitlist({ t }: { t: (key: string, values?: Record<string, string | number | Date>) => string }) {
  return (
    <section className="rounded-md border border-blue-500/30 bg-blue-500/5 p-5 sm:p-6 space-y-3">
      <div className="flex items-start gap-3">
        <Hourglass className="size-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-display font-bold text-lg">{t("waitlist.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("waitlist.description")}
          </p>
        </div>
      </div>
    </section>
  );
}

function Rejected({ t }: { t: (key: string, values?: Record<string, string | number | Date>) => string }) {
  return (
    <section className="rounded-md border border-red-500/30 bg-red-500/5 p-5 sm:p-6 space-y-3">
      <div className="flex items-start gap-3">
        <XCircle className="size-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-display font-bold text-lg">{t("rejected.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("rejected.description")}
          </p>
        </div>
      </div>
    </section>
  );
}