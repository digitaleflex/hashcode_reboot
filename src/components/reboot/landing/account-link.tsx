"use client";

import { useMemberSession } from "@/lib/use-member-session";

/** Entrée d'espace : « Mon espace » si connecté, sinon « Se connecter ». */
export function AccountLink() {
  // Un membre connecté ne doit pas voir « Se connecter » en quittant son espace.
  const session = useMemberSession();
  const isAuthed = session.status === "authenticated";

  return (
    <a
      href={isAuthed ? "/dashboard" : "/login"}
      className="min-h-[44px] inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors focus-lime"
    >
      {isAuthed ? (session.firstName ? `Mon espace · ${session.firstName}` : "Mon espace") : "Se connecter"}
    </a>
  );
}
