"use client";

import { useMemberSession } from "@/lib/use-member-session";
import { useTranslations } from "next-intl";

/** Entrée d'espace : « Mon espace » si connecté, sinon « Se connecter ». */
export function AccountLink() {
  const t = useTranslations("landing.accountLink");
  // Un membre connecté ne doit pas voir « Se connecter » en quittant son espace.
  const session = useMemberSession();
  const isAuthed = session.status === "authenticated";

  return (
    <a
      href={isAuthed ? "/dashboard" : "/login"}
      className="min-h-[44px] inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors focus-lime"
    >
      {isAuthed
        ? session.firstName
          ? t("authenticatedWithName", { firstName: session.firstName })
          : t("authenticated")
        : t("anonymous")}
    </a>
  );
}