import { redirect } from "next/navigation";
import { getSession } from "@/lib/account-auth";
import { db } from "@/lib/db";
import { buildAccountData } from "@/lib/account-data";
import { Logo, HashSymbol } from "@/components/brand/logo";
import { MonoLabel } from "@/components/reboot/shared";
import { AccountHeader } from "./_components/AccountHeader";
import { StatusSection } from "./_components/StatusSection";
import { ContactForm } from "./_components/ContactForm";
import { NextSteps } from "./_components/NextSteps";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic"; // toujours recharger (revalidate via PATCH)

/**
 * Page /account — espace personnel du membre.
 *
 * Sections :
 *   1. AccountHeader : prénom + archétype + statut badge
 *   2. StatusSection : explication contextuelle par statut (variante par status)
 *   3. NextSteps : 3 prochaines étapes personnalisées par archétype
 *   4. ContactForm : édition email/WhatsApp/ville/nom/objectif (PATCH /api/account/profile)
 *   5. LogoutButton
 */
export default async function AccountPage() {
  const session = await getSession();
  if (!session) {
    // Sécurité : si la session a expiré entre le middleware et le render
    redirect("/login?next=/account");
  }

  // Récupère le member complet (avec tous les champs)
  // via la même logique que /api/account/me pour rester synchro.
  const member = await db.member.findUnique({
    where: { id: session.member.id },
  });
  if (!member || member.deletedAt) {
    redirect("/login?next=/account");
  }

  const data = buildAccountData(member);

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <a
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Accueil
        </a>
        <Logo />
        <div className="w-12" /> {/* spacer */}
      </header>

      <div className="flex-1 px-4 py-6 sm:py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <AccountHeader
            member={data.member}
            profile={data.profile}
            status={data.status}
          />

          <StatusSection status={data.status} />

          <NextSteps archetype={data.profile?.archetype ?? null} />

          <section>
            <div className="flex items-center justify-between mb-3">
              <MonoLabel className="text-muted-foreground">
                Mes coordonnées
              </MonoLabel>
              <span className="mono-label text-xs text-muted-foreground">
                mets-les à jour à tout moment
              </span>
            </div>
            <div className="rounded-md border border-border/60 bg-card/40 p-5 sm:p-6">
              <ContactForm member={data.member} />
            </div>
          </section>

          <div className="flex justify-center pt-2">
            <LogoutButton />
          </div>

          <p className="text-center text-xs text-muted-foreground pt-2">
            <span className="inline-flex items-center gap-1.5">
              <HashSymbol size={12} />
              Membre depuis {new Date(data.member.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </span>
          </p>
        </div>
      </div>
    </main>
  );
}
