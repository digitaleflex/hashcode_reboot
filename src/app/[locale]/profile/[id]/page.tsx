import { notFound, unstable_rethrow } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PublicProfileCard, type PublicProfile } from "@/components/reboot/profile/PublicProfileCard";
import { getSession } from "@/lib/account-auth";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/profile/${id}`, {
      cache: "no-store",
    });
    // Appelé ici — c'est-à-dire avant que la réponse ne commence à être
    // diffusée — `notFound()` permet à Next de fixer un vrai statut 404.
    // Appelé depuis le composant de page, il n'arrive qu'après le début du
    // streaming et la réponse part déjà en 200 (soft 404).
    if (!res.ok) notFound();

    const { profile } = await res.json();
    return {
      title: `${profile.firstName} — Profil HASHCODE`,
      description: `${profile.archetype} · ${profile.domain} · ${profile.level}`,
    };
  } catch (error) {
    // Ne pas avaler l'erreur interne levée par `notFound()`.
    unstable_rethrow(error);
    return { title: "Profil introuvable" };
  }
}

export default async function PublicProfilePage({ params }: Props) {
  const t = await getTranslations("profile");
  const { id } = await params;

  let profile: PublicProfile | null = null;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/profile/${id}`, {
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      profile = data.profile;
    }
  } catch {
    // continue
  }

  if (!profile) {
    notFound();
  }

  // Session résolue côté serveur : l'entrée de compte est dans le HTML initial.
  const session = await getSession().catch(() => null);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 py-4 shrink-0">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between">
          <span className="mono-label text-lime text-sm font-bold tracking-widest">
            HASHCODE REBOOT
          </span>
          <span className="flex items-center gap-4">
            <a
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("header.backToSite")}
            </a>
            <a
              href={session ? "/dashboard" : "/login"}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {session ? t("header.mySpace") : t("header.login")}
            </a>
          </span>
        </div>
      </header>

      <main className="flex-1 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <PublicProfileCard profile={profile} />
        </div>
      </main>

      <footer className="border-t border-border/60 py-6 shrink-0">
        <p className="text-center text-xs text-muted-foreground">
          {t("footer")}
        </p>
      </footer>
    </div>
  );
}