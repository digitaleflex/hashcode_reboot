import { redirect } from "next/navigation";
import { getSession } from "@/lib/account-auth";
import { Logo, HashSymbol } from "@/components/brand/logo";
import { MonoLabel } from "@/components/reboot/shared";
import { LogoutButton } from "./logout-button";

/**
 * Page /account — placeholder pour l'issue #57.
 *
 * La version complète (issue #56) ajoutera :
 *   - Voir son profil généré
 *   - Voir son statut (PENDING / APPROVED / WAITLIST)
 *   - Modifier ses infos
 *   - Lien WhatsApp si APPROVED
 *
 * Pour l'instant on valide juste que l'auth fonctionne :
 * le middleware redirige vers /login si pas de cookie,
 * et getSession() confirme que la session est valide.
 */
export default async function AccountPage() {
  const session = await getSession();
  if (!session) {
    // Sécurité : si la session a expiré entre le middleware et le render
    redirect("/login?next=/account");
  }
  const m = session.member;

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between p-4 sm:p-6">
        <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Accueil
        </a>
        <Logo />
        <div className="w-12" /> {/* spacer */}
      </header>

      <div className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <HashSymbol className="mx-auto text-lime" size={40} />
            <h1 className="mt-4 text-2xl sm:text-3xl font-display font-bold tracking-tight">
              Bienvenue, {m.firstName}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu es connecté·e à HASHCODE.
            </p>
          </div>

          <section className="rounded-md border border-border/60 bg-card/40 p-5 sm:p-6 space-y-4">
            <div>
              <MonoLabel className="text-muted-foreground">Email</MonoLabel>
              <p className="mt-1 text-sm text-foreground">{m.email}</p>
            </div>
            <div>
              <MonoLabel className="text-muted-foreground">Statut</MonoLabel>
              <p className="mt-1 text-sm text-foreground">
                <span className="inline-flex items-center gap-2">
                  <span
                    className={
                      m.profileStatus === "APPROVED"
                        ? "inline-block size-2 rounded-full bg-lime"
                        : m.profileStatus === "PENDING"
                          ? "inline-block size-2 rounded-full bg-amber-400"
                          : m.profileStatus === "WAITLIST"
                            ? "inline-block size-2 rounded-full bg-blue-400"
                            : "inline-block size-2 rounded-full bg-red-400"
                    }
                  />
                  {m.profileStatus}
                </span>
              </p>
            </div>
            <div>
              <MonoLabel className="text-muted-foreground">
                Archétype
              </MonoLabel>
              <p className="mt-1 text-sm text-foreground">
                {m.profileArchetype ?? "—"}
              </p>
            </div>
            <div>
              <MonoLabel className="text-muted-foreground">Pays</MonoLabel>
              <p className="mt-1 text-sm text-foreground">{m.country}</p>
            </div>
          </section>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Cette page est un placeholder. La version complète arrive bientôt
            (modification de profil, lien WhatsApp, etc.).
          </p>

          <div className="mt-6 flex justify-center">
            <LogoutButton />
          </div>
        </div>
      </div>
    </main>
  );
}
