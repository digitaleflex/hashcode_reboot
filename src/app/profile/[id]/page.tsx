import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicProfileCard, type PublicProfile } from "@/components/reboot/profile/PublicProfileCard";

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
    if (!res.ok) return { title: "Profil introuvable" };

    const { profile } = await res.json();
    return {
      title: `${profile.firstName} — HASHCODE Profile`,
      description: `${profile.archetype} · ${profile.domain} · ${profile.level}`,
    };
  } catch {
    return { title: "Profil introuvable" };
  }
}

export default async function PublicProfilePage({ params }: Props) {
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 py-4 shrink-0">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between">
          <span className="mono-label text-lime text-sm font-bold tracking-widest">
            HASHCODE REBOOT
          </span>
          <a
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Retour au site
          </a>
        </div>
      </header>

      <main className="flex-1 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <PublicProfileCard profile={profile} />
        </div>
      </main>

      <footer className="border-t border-border/60 py-6 shrink-0">
        <p className="text-center text-xs text-muted-foreground">
          HASHCODE REBOOT · Réseau de talents tech
        </p>
      </footer>
    </div>
  );
}
