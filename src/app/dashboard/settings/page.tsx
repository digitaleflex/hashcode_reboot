import { redirect } from "next/navigation";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { buildAccountData } from "@/lib/account-data";
import { MonoLabel } from "@/components/reboot/shared";
import { ContactForm } from "@/app/account/_components/ContactForm";
import { LogoutButton } from "@/app/account/logout-button";

export const dynamic = "force-dynamic";

/**
 * /dashboard/settings — coordonnées, compte et déconnexion.
 * Réutilise ContactForm (PATCH /api/account/profile).
 * /account reste accessible en lecture pour compat, mais le canonique est ici.
 */
export default async function DashboardSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard/settings");

  const member = await db.member.findUnique({
    where: { id: session.member.id },
  });
  if (!member || member.deletedAt) redirect("/login?next=/dashboard/settings");

  const data = buildAccountData(member);

  return (
    <div className="mx-auto max-w-4xl w-full px-5 sm:px-8 py-8 space-y-6">
      <header>
        <h1 className="font-display font-bold text-2xl tracking-tight">
          Paramètres
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tes coordonnées, ton compte et ta session.
        </p>
      </header>

      <section>
        <div className="flex items-center justify-between mb-3">
          <MonoLabel className="text-muted-foreground">
            Mes coordonnées
          </MonoLabel>
          <span className="mono-label text-xs text-muted-foreground">
            mets-les à jour à tout moment
          </span>
        </div>
        <div className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6">
          <ContactForm member={data.member} />
        </div>
      </section>

      <section className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6">
        <h2 className="font-display font-bold text-sm tracking-tight mono-label text-muted-foreground uppercase mb-4">
          Compte
        </h2>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium truncate">{data.member.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Pays</dt>
            <dd className="font-medium">{data.member.country}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Membre depuis</dt>
            <dd className="font-medium">
              {new Date(data.member.createdAt).toLocaleDateString("fr-FR", {
                month: "long",
                year: "numeric",
              })}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Pour changer ton email ou supprimer ton compte, contacte-nous via
          WhatsApp.
        </p>
      </section>

      <section className="rounded-lg border border-border/60 bg-card/40 p-5 sm:p-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-sm tracking-tight mono-label text-muted-foreground uppercase">
            Session
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Déconnecte cet appareil.
          </p>
        </div>
        <LogoutButton />
      </section>
    </div>
  );
}
