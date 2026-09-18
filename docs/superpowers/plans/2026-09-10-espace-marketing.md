# Espace Marketing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer un hub `/admin/marketing` à onglets qui centralise tout le marketing existant, plus une entrée « Marketing » dans la sidebar admin.

**Architecture:** Aucune nouvelle route API. La page réutilise les endpoints existants (`/api/email-stats`, `/api/admin/announce-dashboard`, `/api/admin/invitations`, `/api/invite/relance`, `/api/admin/import-invite`, `/api/admin/test-email`) et les composants existants (`EmailEngagement`, `ImportInvitePanel`). 3 nouveaux panneaux légers + 1 page. Navigation : sidebar `ITEMS` + `SECTION_MAP`/`routeMap` du layout + palette de commandes.

**Tech Stack:** Next.js App Router, React client components, Tailwind (classes existantes `bg-card`, `border-border/60`, `text-lime`), lucide-react, `fetchJson` helper.

**Spec:** Demande utilisateur (2026-09-10) : « espace où on centralise et gère tout ce qui est marketing, section Marketing dans la sidebar ». Scope validé : centraliser l'existant (pas de broadcasts Resend en V1), une page à onglets.

## Global Constraints

- Pages admin : `"use client"` en première ligne, français pour les libellés UI.
- Auth : si `res.status === 401` ou `code === "UNAUTHORIZED"` → `router.push("/?admin=1")` via callback `onSessionExpired`.
- Requêtes : utiliser `fetchJson` de `@/components/reboot/admin/lib/fetchJson` (retourne `{ res, data, error, code, retryAfterSec }`).
- Rate-limit : si `res.status === 429` ou `code === "RATE_LIMITED"` → message via `withRetryAfter(base, retryAfterSec)`.
- Onglets : pas de `useSearchParams` (évite Suspense) — lire `window.location.search` au mount + `replaceState`, comme `useMembers.ts`.
- Vérification finale : `npx tsc --noEmit`, `npx eslint` sur fichiers touchés, `npm run test:unit` (153 tests attendus OK).

---

## File Structure

- Modify: `src/components/reboot/admin/AdminSidebar.tsx` — 1 entrée `ITEMS` + import icône.
- Modify: `src/app/admin/layout.tsx` — `SECTION_MAP` + `routeMap`.
- Modify: `src/components/reboot/admin/CommandPalette.tsx` — 1 entrée navigation.
- Create: `src/components/reboot/admin/marketing/AnnouncePanel.tsx` — annonce espace membre par lots.
- Create: `src/components/reboot/admin/marketing/RelancePanel.tsx` — relance des invitations non cliquées.
- Create: `src/components/reboot/admin/marketing/TestEmailPanel.tsx` — envoi d'email de test.
- Create: `src/app/admin/marketing/page.tsx` — coquille à onglets + onglet Vue d'ensemble (réutilise `EmailEngagement` + `ImportInvitePanel`).

---

### Task 1: Entrée « Marketing » dans la navigation (sidebar + layout + palette)

**Files:**
- Modify: `src/components/reboot/admin/AdminSidebar.tsx:3,10-20`
- Modify: `src/app/admin/layout.tsx:20-40`
- Modify: `src/components/reboot/admin/CommandPalette.tsx:55-60`

**Interfaces:**
- Consumes: routes existantes, rien de nouveau.
- Produces: `section-marketing` → `/admin/marketing` résolu par sidebar, layout et palette.

- [ ] **Step 1: Ajouter l'item sidebar**

Dans `src/components/reboot/admin/AdminSidebar.tsx`, étendre l'import lucide avec `Megaphone`, et insérer après la ligne Invitations :

```tsx
import { LayoutDashboard, Users, Activity, FileJson, Settings, Shield, ShieldBan, Calendar, Mail, Megaphone, ChevronLeft, ChevronRight, Command } from "lucide-react";
```

```tsx
{ path: "/admin/marketing", id: "section-marketing", label: "Marketing", icon: Megaphone },
```

Ligne complète du tableau après modification (ordre : stats, members, invitations, **marketing**, events, activity, exports, blacklist, audit-log, settings).

- [ ] **Step 2: Mapper la section dans le layout**

Dans `src/app/admin/layout.tsx`, ajouter dans `SECTION_MAP` :

```ts
"/admin/marketing": "section-marketing",
```

et dans `routeMap` :

```ts
"section-marketing": "/admin/marketing",
```

- [ ] **Step 3: Ajouter l'entrée palette de commandes**

Dans `src/components/reboot/admin/CommandPalette.tsx`, après la ligne `nav-members` :

```tsx
{ id: "nav-marketing", label: "Marketing", group: "navigation", action: () => onNavigate("section-marketing") },
```

- [ ] **Step 4: Vérifier compilation**

Run: `npx tsc --noEmit`
Expected: PASS (aucune erreur).

---

### Task 2: Panneau « Annonce » (campagnes par lots)

**Files:**
- Create: `src/components/reboot/admin/marketing/AnnouncePanel.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/announce-dashboard` — `{ confirm: false }` → `{ dryRun: true, total, limit, offset }` ; `{ confirm: true, limit, offset }` → `{ ok: true, sent, failed, total, nextOffset, done }`. Source de vérité : `src/app/api/admin/announce-dashboard/route.ts:38-80`.
- Produces: `AnnouncePanel({ onSessionExpired }: { onSessionExpired: () => void })`.

- [ ] **Step 1: Créer le composant**

```tsx
"use client";

import * as React from "react";
import { MonoLabel, RebootButton } from "@/components/reboot/shared";
import { fetchJson, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2 } from "lucide-react";

const LOT = 15;

export function AnnouncePanel({ onSessionExpired }: { onSessionExpired: () => void }) {
  const { toast } = useToast();
  const [total, setTotal] = React.useState<number | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [sent, setSent] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const loadTotal = React.useCallback(async () => {
    const { res, data, code } = await fetchJson("/api/admin/announce-dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: false }),
    });
    if (res.status === 401 || code === "UNAUTHORIZED") {
      onSessionExpired();
      return;
    }
    if (res.ok && typeof data?.total === "number") setTotal(data.total);
  }, [onSessionExpired]);

  React.useEffect(() => {
    void loadTotal();
  }, [loadTotal]);

  async function handleSendLot() {
    if (loading || done) return;
    setLoading(true);
    try {
      const { res, data, error, code, retryAfterSec } = await fetchJson("/api/admin/announce-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, limit: LOT, offset }),
      });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        onSessionExpired();
        return;
      }
      if (!res.ok || !data?.ok) {
        const base = error ?? "Échec de l'envoi du lot.";
        toast({
          title: "Erreur",
          description: res.status === 429 || code === "RATE_LIMITED" ? withRetryAfter(base, retryAfterSec) : base,
          variant: "destructive",
        });
        return;
      }
      setSent((s) => s + (data.sent as number));
      setOffset(data.nextOffset as number);
      if (data.done) setDone(true);
      toast({ title: "Lot envoyé", description: `${data.sent} email(s) envoyé(s).` });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <MonoLabel className="text-muted-foreground">Annonce espace membre</MonoLabel>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === null ? "Chargement…" : `${sent}/${total} envoyés${done ? " — terminé." : "."} Envois par lots de ${LOT}.`}
          </p>
        </div>
        <RebootButton size="sm" onClick={() => void handleSendLot()} disabled={loading || done || total === null}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          <span>{done ? "Terminé" : "Envoyer le lot suivant"}</span>
        </RebootButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier compilation**

Run: `npx tsc --noEmit`
Expected: PASS.

---

### Task 3: Panneau « Relances » (invitations non cliquées)

**Files:**
- Create: `src/components/reboot/admin/marketing/RelancePanel.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/invitations?status=INVITED&page=1&pageSize=100` → `{ ok, stats: { INVITED, ACCEPTED, total }, members: [{ id, invitationClicks }], pagination }` (source : `src/app/api/admin/invitations/route.ts`, `src/app/admin/invitations/page.tsx:118-182`). `POST /api/invite/relance` body `{ memberIds: string[], confirm: true }` → `{ ok, sent }` (source : `src/app/admin/invitations/page.tsx:283-317`).
- Produces: `RelancePanel({ onSessionExpired }: { onSessionExpired: () => void })`.

- [ ] **Step 1: Créer le composant**

```tsx
"use client";

import * as React from "react";
import { MonoLabel, RebootButton } from "@/components/reboot/shared";
import { fetchJson, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2 } from "lucide-react";

export function RelancePanel({ onSessionExpired }: { onSessionExpired: () => void }) {
  const { toast } = useToast();
  const [relanceable, setRelanceable] = React.useState<string[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    const { res, data, code } = await fetchJson("/api/admin/invitations?status=INVITED&page=1&pageSize=100");
    if (res.status === 401 || code === "UNAUTHORIZED") {
      onSessionExpired();
      return;
    }
    if (res.ok && data?.ok && Array.isArray(data.members)) {
      setRelanceable(
        (data.members as { id: string; invitationClicks: number }[])
          .filter((m) => m.invitationClicks === 0)
          .map((m) => m.id),
      );
    }
  }, [onSessionExpired]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleRelance() {
    if (loading || !relanceable?.length) return;
    setLoading(true);
    try {
      const { res, data, error, code, retryAfterSec } = await fetchJson("/api/invite/relance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: relanceable, confirm: true }),
      });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        onSessionExpired();
        return;
      }
      if (!res.ok || !data?.ok) {
        const base = error ?? "Échec de la relance.";
        toast({
          title: "Erreur relance",
          description: res.status === 429 || code === "RATE_LIMITED" ? withRetryAfter(base, retryAfterSec) : base,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Relance envoyée", description: `${data.sent} email(s) envoyé(s).` });
      setRelanceable(null);
      await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <MonoLabel className="text-muted-foreground">Relance invitations</MonoLabel>
          <p className="mt-1 text-sm text-muted-foreground">
            {relanceable === null
              ? "Chargement…"
              : relanceable.length === 0
                ? "Aucune invitation en attente de clic."
                : `${relanceable.length} invitation(s) sans clic à relancer.`}
          </p>
        </div>
        <RebootButton size="sm" onClick={() => void handleRelance()} disabled={loading || !relanceable?.length}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          <span>Relancer</span>
        </RebootButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier compilation**

Run: `npx tsc --noEmit`
Expected: PASS.

---

### Task 4: Panneau « Test email »

**Files:**
- Create: `src/components/reboot/admin/marketing/TestEmailPanel.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/test-email` body `{ email, kind: "welcome" | "invite" | "both" }` (source : `src/app/api/admin/test-email/route.ts:10-13`).
- Produces: `TestEmailPanel({ onSessionExpired }: { onSessionExpired: () => void })`.

- [ ] **Step 1: Lire la fin de la route pour confirmer la forme de réponse**

Run: lecture de `src/app/api/admin/test-email/route.ts` lignes 70-87.
Expected: connaître les champs exacts de la réponse succès (ex. `{ ok, sent }`) pour les afficher dans le toast.

- [ ] **Step 2: Créer le composant** (adapter le toast à la forme constatée à l'étape 1)

```tsx
"use client";

import * as React from "react";
import { MonoLabel, RebootButton } from "@/components/reboot/shared";
import { fetchJson, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FlaskConical } from "lucide-react";

type Kind = "welcome" | "invite" | "both";

export function TestEmailPanel({ onSessionExpired }: { onSessionExpired: () => void }) {
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");
  const [kind, setKind] = React.useState<Kind>("both");
  const [loading, setLoading] = React.useState(false);

  async function handleSend() {
    if (loading || !email.trim()) return;
    setLoading(true);
    try {
      const { res, data, error, code, retryAfterSec } = await fetchJson("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), kind }),
      });
      if (res.status === 401 || code === "UNAUTHORIZED" || res.status === 403) {
        onSessionExpired();
        return;
      }
      if (!res.ok) {
        const base = error ?? "Échec de l'envoi de test.";
        toast({
          title: "Erreur",
          description: res.status === 429 || code === "RATE_LIMITED" ? withRetryAfter(base, retryAfterSec) : base,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Email de test envoyé", description: `Modèle(s) « ${kind} » envoyés à ${email.trim()}.` });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
      <MonoLabel className="text-muted-foreground">Email de test</MonoLabel>
      <p className="mt-1 text-sm text-muted-foreground">Vérifie le rendu welcome / invitation sur ta boîte avant une campagne.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ton@email.com"
          aria-label="Email de test"
          className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime/40"
        />
        <div className="flex rounded-md border border-border overflow-hidden" role="group" aria-label="Modèle à tester">
          {(["welcome", "invite", "both"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={kind === k ? "px-3 h-9 text-sm bg-lime/10 text-lime" : "px-3 h-9 text-sm text-muted-foreground hover:text-foreground"}
            >
              {k === "welcome" ? "Bienvenue" : k === "invite" ? "Invitation" : "Les deux"}
            </button>
          ))}
        </div>
        <RebootButton size="sm" onClick={() => void handleSend()} disabled={loading || !email.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FlaskConical className="size-4" aria-hidden />}
          <span>Envoyer</span>
        </RebootButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Vérifier compilation**

Run: `npx tsc --noEmit`
Expected: PASS.

---

### Task 5: Page `/admin/marketing` à onglets

**Files:**
- Create: `src/app/admin/marketing/page.tsx`

**Interfaces:**
- Consumes: `AnnouncePanel`, `RelancePanel`, `TestEmailPanel`, `EmailEngagement` (+ type `EmailStatsData`), `ImportInvitePanel`. `GET /api/email-stats` → `{ summary, byCategory, relance }` (source : `src/app/api/email-stats/route.ts:34-48`).
- Produces: route `/admin/marketing` avec onglets `overview | campagnes | import | test`, persisté en `?tab=`.

- [ ] **Step 1: Créer la page**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/reboot/shared";
import { EmailEngagement, type EmailStatsData } from "@/components/reboot/admin/EmailEngagement";
import { ImportInvitePanel } from "@/app/admin/members/ImportInvitePanel";
import { AnnouncePanel } from "@/components/reboot/admin/marketing/AnnouncePanel";
import { RelancePanel } from "@/components/reboot/admin/marketing/RelancePanel";
import { TestEmailPanel } from "@/components/reboot/admin/marketing/TestEmailPanel";
import { fetchJson } from "@/components/reboot/admin/lib/fetchJson";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "campagnes", label: "Campagnes" },
  { id: "import", label: "Import" },
  { id: "test", label: "Test" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function readTab(): TabId {
  if (typeof window === "undefined") return "overview";
  const t = new URLSearchParams(window.location.search).get("tab");
  return TABS.some((x) => x.id === t) ? (t as TabId) : "overview";
}

export default function AdminMarketingPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabId>("overview");
  const [emailStats, setEmailStats] = React.useState<EmailStatsData | null>(null);
  const [loadingStats, setLoadingStats] = React.useState(true);

  const handleSessionExpired = React.useCallback(() => {
    router.push("/?admin=1");
  }, [router]);

  React.useEffect(() => {
    setTab(readTab());
  }, []);

  const selectTab = React.useCallback((t: TabId) => {
    setTab(t);
    try {
      const sp = new URLSearchParams(window.location.search);
      sp.set("tab", t);
      window.history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    const ctrl = new AbortController();
    setLoadingStats(true);
    fetchJson("/api/email-stats", { cache: "no-store", signal: ctrl.signal })
      .then(({ res, data, code }) => {
        if (res.status === 401 || code === "UNAUTHORIZED") {
          handleSessionExpired();
          return;
        }
        if (res.ok) setEmailStats(data as EmailStatsData);
      })
      .catch(() => {
        /* silencieux — EmailEngagement gère l'absence de données */
      })
      .finally(() => setLoadingStats(false));
    return () => ctrl.abort();
  }, [handleSessionExpired]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
        <p className="text-sm text-muted-foreground">Pilote emails, campagnes, import et tests depuis un seul espace.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sections marketing">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => selectTab(t.id)}
            className={cn(
              "h-9 px-4 rounded-full border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-inset",
              tab === t.id
                ? "border-lime/60 bg-lime/10 text-lime"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section aria-label="Vue d'ensemble marketing" className="space-y-6">
          <EmailEngagement data={emailStats} loading={loadingStats} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button type="button" onClick={() => router.push("/admin/invitations")} className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors">
              <MonoLabel className="text-muted-foreground">Invitations</MonoLabel>
              <p className="mt-1 text-sm text-foreground">Suivi des statuts et relances.</p>
            </button>
            <button type="button" onClick={() => router.push("/admin/members?type=invited")} className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors">
              <MonoLabel className="text-muted-foreground">Invités</MonoLabel>
              <p className="mt-1 text-sm text-foreground">Liste filtrée des membres invités.</p>
            </button>
            <button type="button" onClick={() => router.push("/admin/exports")} className="rounded-md border border-border/60 bg-card/40 p-4 text-left hover:border-lime/40 transition-colors">
              <MonoLabel className="text-muted-foreground">Exports</MonoLabel>
              <p className="mt-1 text-sm text-foreground">Extraire les cibles de campagne.</p>
            </button>
          </div>
        </section>
      )}

      {tab === "campagnes" && (
        <section aria-label="Campagnes" className="space-y-4">
          <AnnouncePanel onSessionExpired={handleSessionExpired} />
          <RelancePanel onSessionExpired={handleSessionExpired} />
        </section>
      )}

      {tab === "import" && (
        <section aria-label="Import et invitation">
          <ImportInvitePanel onSessionExpired={handleSessionExpired} />
        </section>
      )}

      {tab === "test" && (
        <section aria-label="Test email">
          <TestEmailPanel onSessionExpired={handleSessionExpired} />
        </section>
      )}
    </div>
  );
}
```

Notes d'intégration (à vérifier pendant l'implémentation, sans changer le contrat) :
- `ImportInvitePanel` vit sous `src/app/admin/members/` : import direct autorisé (même App Router). Si l'import croisé pose problème au lint, déplacer le fichier vers `src/components/reboot/admin/ImportInvitePanel.tsx` et mettre à jour `src/app/admin/members/page.tsx:11`.
- `fetchJson` accepte `signal` (utilisé dans `src/app/admin/stats/page.tsx:35`) — sinon retirer l'option.

- [ ] **Step 2: Vérifier compilation + lint**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npx eslint src/app/admin/marketing/page.tsx src/components/reboot/admin/marketing/ src/components/reboot/admin/AdminSidebar.tsx src/app/admin/layout.tsx src/components/reboot/admin/CommandPalette.tsx`
Expected: PASS (0 erreur).

---

### Task 6: Vérification globale

**Files:** aucun (contrôle).

- [ ] **Step 1: Tests unitaires**

Run: `npm run test:unit`
Expected: 153 tests, 0 fail (référence du 2026-09-10).

- [ ] **Step 2: Contrôle manuel (checklist)**

1. `/admin/marketing` affiche 4 onglets, `?tab=` persiste au rechargement.
2. Sidebar : item « Marketing » (icône Megaphone) actif sur `/admin/marketing`, desktop + mobile + réduit.
3. Palette Ctrl+K : « Marketing » navigue vers la page.
4. Onglet Campagnes : total annonce cohérent avec `INVITED` (171), envoi d'un lot puis `done`.
5. Session expirée : 401 → redirection `/?admin=1` sur chaque panneau.
6. Aucune régression : `/admin/stats`, `/admin/members`, `/admin/invitations` inchangés visuellement.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/marketing src/components/reboot/admin/marketing src/components/reboot/admin/AdminSidebar.tsx src/app/admin/layout.tsx src/components/reboot/admin/CommandPalette.tsx
git commit -m "feat(admin): add Marketing hub centralizing email campaigns and tests"
```

---

## Self-Review

1. **Spec coverage:** centraliser l'existant ✓ (email-stats, announce, relance, import-invite, test-email tous câblés) ; sidebar ✓ (ITEMS + layout + palette) ; page à onglets ✓ ; pages existantes non déplacées ✓ (liens seulelement).
2. **Placeholder scan:** aucun `TODO/TBD` ; chaque étape contient le code exact et la commande de vérification.
3. **Type consistency:** `onSessionExpired: () => void` uniforme sur les 3 panneaux et la page ; `TabId` dérivé de `TABS` ; `EmailStatsData` importé en type depuis `EmailEngagement` ; contrats API recopiés des routes sources citées.
