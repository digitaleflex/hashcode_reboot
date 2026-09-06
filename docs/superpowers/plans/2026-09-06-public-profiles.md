# Public Member Profiles — Portefeuille réseau pour les membres

> **Goal:** Créer une page `/profile/[id]` publique pour chaque membre validé, partageable pour networking.

**Architecture:** Page Next.js accessible sans auth, affiche le profil public du membre (archétype, domain, level, goals, tags). Protection privacy intégrée — aucun dato personnelle sensibles.

**Prérequis:** Endpoint `/api/members/[id]/share` existe déjà (retourne champs publics uniquement).

---

## Fichiers à créer/modifier

| Action | Fichier | Responsabilité |
|--------|---------|---------------|
| Create | `src/app/profile/[id]/page.tsx` | Page profil public |
| Create | `src/app/profile/[id]/not-found.tsx` | Page introuvable |
| Create | `src/components/reboot/profile/PublicProfileCard.tsx` | Carte profil publique |
| Create | `src/app/api/profile/[id]/route.ts` | API fetch profil public |

---

## Étape 1: Page profil public

**File:** `src/app/profile/[id]/page.tsx`

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const res = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/profile/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) return { title: "Profil introuvable" };

  const { profile } = await res.json();
  return {
    title: `${profile.firstName} — HASHCODE Profile`,
    description: `${profile.archetype} · ${profile.domain} · ${profile.level}`,
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { id } = await params;
  const res = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/profile/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    notFound();
  }

  const { profile } = await res.json();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/60 py-4">
        <div className="max-w-2xl mx-auto px-4 flex items-center justify-between">
          <span className="mono-label text-lime">HASHCODE REBOOT</span>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Retour au site
          </a>
        </div>
      </header>

      <main className="flex-1 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <PublicProfileCard profile={profile} />
        </div>
      </main>

      <footer className="border-t border-border/60 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          HASHCODE REBOOT · Réseau de talents tech
        </p>
      </footer>
    </div>
  );
}
```

---

## Étape 2: API route

**File:** `src/app/api/profile/[id]/route.ts`

```tsx
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const m = await db.member.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      profileArchetype: true,
      primaryDomain: true,
      level: true,
      goal: true,
      availability: true,
      mentoringInterest: true,
      threeMonthGoal: true,
      tags: true,
      accessLane: true,
    },
  });

  if (!m) {
    return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  }

  const decode = <T,>(s: string | null, fallback: T): T => {
    if (!s) return fallback;
    try { return JSON.parse(s) as T; } catch { return fallback; }
  };

  return NextResponse.json({
    profile: {
      id: m.id,
      firstName: m.firstName,
      archetype: m.profileArchetype,
      domain: m.primaryDomain,
      level: m.level,
      goal: m.goal,
      availability: m.availability,
      mentoring: m.mentoringInterest,
      threeMonthGoal: m.threeMonthGoal,
      tags: decode<string[]>(m.tags, []),
      accessLane: m.accessLane,
    },
  });
}
```

---

## Étape 3: Composant PublicProfileCard

**File:** `src/components/reboot/profile/PublicProfileCard.tsx`

```tsx
interface Profile {
  id: string;
  firstName: string;
  archetype: string;
  domain: string;
  level: string;
  goal: string;
  availability: string;
  mentoring: string | null;
  threeMonthGoal: string | null;
  tags: string[];
  accessLane: string;
}

const DOMAIN_LABELS: Record<string, string> = {
  web: "Web Development",
  cybersecurity: "Cybersecurity",
  ai: "Applied AI",
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Débutant",
  practicing: "Pratique",
  autonomous: "Autonome",
  advanced: "Avancé",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  fulltime: "Temps plein",
  parttime: "Temps partiel",
  weekends: "Weekends",
  evenings: "Soirs",
};

export function PublicProfileCard({ profile }: { profile: Profile }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold italic text-foreground">
            {profile.firstName}
          </h1>
          <p className="mt-1 text-muted-foreground">{profile.archetype}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border border-lime/40 bg-lime/5 text-lime mono-label text-xs">
          <span className="size-1.5 rounded-full bg-lime animate-pulse" />
          HASHCODE
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Domaine</p>
          <p className="font-medium">{DOMAIN_LABELS[profile.domain] ?? profile.domain}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Niveau</p>
          <p className="font-medium">{LEVEL_LABELS[profile.level] ?? profile.level}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Disponibilité</p>
          <p className="font-medium">{AVAILABILITY_LABELS[profile.availability] ?? profile.availability}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Objectif</p>
          <p className="font-medium">{profile.goal}</p>
        </div>
      </div>

      {profile.mentoring && (
        <div className="mb-6 p-4 rounded-md bg-lime/5 border border-lime/20">
          <p className="text-xs text-lime mb-1 font-medium">Ouvert au mentorat</p>
          <p className="text-sm">{profile.mentoring}</p>
        </div>
      )}

      {profile.threeMonthGoal && (
        <div className="mb-6">
          <p className="text-xs text-muted-foreground mb-1">Objectif 3 mois</p>
          <p className="text-sm">{profile.threeMonthGoal}</p>
        </div>
      )}

      {profile.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profile.tags.map((tag) => (
            <span key={tag} className="px-2 py-1 text-xs rounded-sm bg-muted text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-border/60">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-lime hover:underline"
        >
          ← Rejoins le réseau HASHCODE
        </a>
      </div>
    </div>
  );
}
```

---

## Étape 4: Page not-found

**File:** `src/app/profile/[id]/not-found.tsx`

```tsx
export default function ProfileNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-display font-bold italic text-lime mb-4">404</h1>
        <p className="text-muted-foreground mb-6">Profil introuvable</p>
        <a href="/" className="text-sm text-lime hover:underline">
          ← Retour au site
        </a>
      </div>
    </div>
  );
}
```

---

## Étape 5: Ajouter le lien dans le profil Card existant

Dans `profile-card.tsx`, ajouter un bouton "Partager mon profil" qui ouvre `/profile/[id]`.
