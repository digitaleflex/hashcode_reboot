# Admin Tab Pages — Séparer chaque onglet en page dédiée

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer l'admin dashboard d'une seule page scrollable en pages séparées pour chaque onglet (Stats, Members, Activity, Exports), chacune avec son propre route URL.

**Architecture:** Chaque section admin devient une page Next.js route (`/admin/stats`, `/admin/members`, `/admin/activity`, `/admin/exports`). Un layout partagé (`admin/layout.tsx`) contient la sidebar et le header. La page `/admin` redirige vers `/admin/stats`.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Lucide icons

**Spec:** Basé sur l'observation du code existant — l'utilisateur veut chaque onglet avec son propre espace dédié plutôt qu'une seule page scrollable.

---

## Global Constraints

- Le layout admin (`src/app/admin/layout.tsx`) existe déjà et fournit le scope CSS admin
- La sidebar (`AdminSidebar`) doit être partagée entre toutes les pages admin
- Le header (top bar) avec session active, refresh, export, logout doit être partagé
- Chaque page ne charge que ses propres données (pas de fetch inutile)
- La nav sidebar doit surligner l'onglet actif basé sur le route courant
- Les URLs existantes `/admin` doivent rediriger vers `/admin/stats`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/app/admin/layout.tsx` | Ajouter le header + sidebar shared |
| Create | `src/app/admin/stats/page.tsx` | Page Vue d'ensemble (stats + funnel) |
| Create | `src/app/admin/members/page.tsx` | Page Membres (table + filtres) |
| Create | `src/app/admin/activity/page.tsx` | Page Activité (activity log) |
| Create | `src/app/admin/exports/page.tsx` | Page Exports (import/export CSV/JSON) |
| Modify | `src/app/admin/page.tsx` | Redirect → /admin/stats |
| Modify | `src/components/reboot/admin/AdminSidebar.tsx` | Navigation par routes au lieu de scroll |
| Delete | `src/app/admin/dashboard-client.tsx` | Plus nécessaire (pages individuelles) |
| Delete | `src/components/reboot/admin-dashboard.tsx` | Remplacé par les pages individuelles |

---

### Task 1: Créer un layout admin shared avec header + sidebar

**Files:**
- Modify: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: AdminSidebar existant, Logo, RebootButton, Lucide icons
- Produits: Layout rendu pour toutes les pages `/admin/*`

- [ ] **Step 1: Lire le layout admin actuel**

```bash
cat src/app/admin/layout.tsx
```

- [ ] **Step 2: Réécrire le layout avec header + sidebar**

Remplacer `src/app/admin/layout.tsx` par un layout qui inclut :
- Le header (top bar) avec : Logo, breadcrumb, session active badge, boutons (refresh, export CSV, export JSON, change passcode, logout, retour site)
- La sidebar (`AdminSidebar`) avec navigation par routes
- Un `<main>` scrollable pour le contenu des pages enfants
- La variable `activeSection` doit être dérivée du pathname courant via `usePathname()`

```tsx
"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Metadata } from "next";
import { adminMono, adminSans } from "./fonts";
import { Logo } from "@/components/brand/logo";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";
import { AdminSidebar } from "@/components/reboot/admin/AdminSidebar";
import { ChevronRight, RefreshCw, ArrowLeft, LogOut, Download, FileJson, Command } from "lucide-react";
import { SessionReminder } from "./session-reminder";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CommandPalette } from "@/components/reboot/admin/CommandPalette";
import { ChangePasscodeDialog } from "@/components/reboot/admin/ChangePasscodeDialog";

const SECTION_MAP: Record<string, string> = {
  "/admin/stats": "section-stats",
  "/admin/members": "section-members",
  "/admin/activity": "section-activity",
  "/admin/exports": "section-exports",
};

const SECTION_LABELS: Record<string, string> = {
  "section-stats": "Vue d'ensemble",
  "section-members": "Membres",
  "section-activity": "Activité",
  "section-exports": "Exports",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const activeSection = SECTION_MAP[pathname] ?? "section-stats";
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  // Ctrl+K for command palette
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  async function logout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch { /* ignore */ }
    queryClient.clear();
    router.push("/");
  }

  function handleRefresh() {
    setRefreshing(true);
    // Force refresh by reloading the current page
    router.refresh();
    setTimeout(() => setRefreshing(false), 1000);
  }

  async function handleExport(kind: "csv" | "json") {
    try {
      const url = kind === "csv" ? "/api/export" : "/api/export/json";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        toast({ title: "Erreur", description: "Échec de l'export." });
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `hashcode-reboot-members-${Date.now()}.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast({ title: `Export ${kind.toUpperCase()} terminé`, description: "Le fichier a été téléchargé." });
    } catch {
      toast({ title: "Erreur", description: "Échec de l'export." });
    }
  }

  return (
    <div className={`${adminSans.variable} ${adminMono.variable} admin-scope min-h-screen flex flex-col bg-background`}>
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-sm border-b border-border/60">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="compact" size="sm" />
            <span className="hidden sm:inline text-border">/</span>
            <MonoLabel className="text-muted-foreground hidden sm:inline">Admin</MonoLabel>
            <ChevronRight className="size-3 text-muted-foreground hidden sm:inline" aria-hidden />
            <span className="hidden sm:inline text-sm text-foreground">
              {SECTION_LABELS[activeSection] ?? activeSection}
            </span>
            <span className="hidden md:inline-flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-sm border border-lime/40 bg-lime/5">
              <span className="size-1.5 rounded-full bg-lime animate-hash-pulse" />
              <span className="mono-label text-lime">Session active</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span title="Palette de commandes (Ctrl+K)">
              <RebootButton
                size="sm"
                variant="outline"
                onClick={() => setPaletteOpen(true)}
                aria-label="Ouvrir la palette de commandes (Ctrl+K)"
              >
                <Command className="size-4" aria-hidden />
                <span className="hidden sm:inline mono-label">Ctrl K</span>
              </RebootButton>
            </span>
            <RebootButton
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Rafraîchir</span>
            </RebootButton>
            <span title="Exporter en CSV">
              <RebootButton
                size="sm"
                variant="outline"
                onClick={() => void handleExport("csv")}
              >
                <Download className="size-4" />
                <span className="hidden sm:inline">CSV</span>
              </RebootButton>
            </span>
            <ChangePasscodeDialog onChanged={handleRefresh} />
            <span className="hidden md:inline-block" title="Exporter en JSON">
              <RebootButton
                size="sm"
                variant="outline"
                onClick={() => void handleExport("json")}
              >
                <FileJson className="size-4" />
                <span className="hidden lg:inline">JSON</span>
              </RebootButton>
            </span>
            <span title="Se déconnecter">
              <RebootButton size="sm" variant="ghost" onClick={() => void logout()}>
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Déconnexion</span>
              </RebootButton>
            </span>
            <RebootButton size="sm" variant="ghost" onClick={() => router.push("/")}>
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Site</span>
            </RebootButton>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <AdminSidebar
          activeSection={activeSection}
          onNavigate={(sectionId) => {
            const routeMap: Record<string, string> = {
              "section-stats": "/admin/stats",
              "section-members": "/admin/members",
              "section-activity": "/admin/activity",
              "section-exports": "/admin/exports",
            };
            router.push(routeMap[sectionId] ?? "/admin/stats");
          }}
          onOpenPalette={() => setPaletteOpen(true)}
        />

        <div className="flex-1 min-w-0">
          <main className="mx-auto max-w-7xl w-full px-5 sm:px-8 py-8">
            {children}
          </main>
          <footer className="border-t border-border/60 py-4">
            <p className="text-center text-xs text-muted-foreground">
              HASHCODE REBOOT · Admin — accès réservé. Les exports contiennent des données membres.
            </p>
          </footer>
        </div>
      </div>

      <SessionReminder />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavigate={(sectionId) => {
          const routeMap: Record<string, string> = {
            "section-stats": "/admin/stats",
            "section-members": "/admin/members",
            "section-activity": "/admin/activity",
            "section-exports": "/admin/exports",
          };
          router.push(routeMap[sectionId] ?? "/admin/stats");
        }}
        onExport={(kind) => void handleExport(kind)}
        onLogout={() => void logout()}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
```

- [ ] **Step 3: Vérifier que le composant compile**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Pas d'erreurs liées au layout

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat(admin): add shared layout with header and sidebar navigation"
```

---

### Task 2: Créer la page Stats (Vue d'ensemble)

**Files:**
- Create: `src/app/admin/stats/page.tsx`

**Interfaces:**
- Consumes: `AdminStats`, `AdminStatsSkeleton`, `PendingApprovalsBanner`, `fetchJson`
- Produits: Page `/admin/stats` rendant les stats et le funnel

- [ ] **Step 1: Créer le dossier et la page**

```bash
mkdir -p src/app/admin/stats
```

Créer `src/app/admin/stats/page.tsx` :

```tsx
"use client";

import * as React from "react";
import { AdminStats, type Stats, type FunnelData } from "@/components/reboot/admin/AdminStats";
import { AdminStatsSkeleton } from "@/components/reboot/admin/skeletons";
import { PendingApprovalsBanner } from "@/components/reboot/admin/PendingApprovalsBanner";
import { fetchJson, isAbortError, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminStatsPage() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [funnel, setFunnel] = React.useState<FunnelData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { toast } = useToast();

  const loadData = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, funnelResult] = await Promise.all([
        fetchJson("/api/stats", { cache: "no-store", signal }),
        fetchJson("/api/analytics", { cache: "no-store", signal }).catch(() => null),
      ]);

      if (signal?.aborted) return;

      if (statsResult.res.status === 401 || statsResult.code === "UNAUTHORIZED") {
        window.location.href = "/?admin=1";
        return;
      }

      if (!statsResult.res.ok) {
        const msg = statsResult.error ?? "Erreur de chargement des stats.";
        throw new Error(
          statsResult.res.status === 429 || statsResult.code === "RATE_LIMITED"
            ? withRetryAfter(msg, statsResult.retryAfterSec)
            : msg,
        );
      }

      setStats(statsResult.data);

      if (funnelResult?.res?.ok) {
        setFunnel(funnelResult.data);
      }
    } catch (e) {
      if (isAbortError(e)) return;
      if (e instanceof Error && e.message === "unauthorized") return;
      setError(
        e instanceof Error
          ? e.message
          : "Erreur de chargement des données. Vérifie ta connexion puis rafraîchis.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const ctrl = new AbortController();
    void loadData(ctrl.signal);
    return () => ctrl.abort();
  }, [loadData]);

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between gap-4 animate-hash-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-destructive shrink-0" />
            <p className="text-sm text-foreground">{error}</p>
          </div>
          <button
            onClick={() => void loadData()}
            className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime whitespace-nowrap"
          >
            Réessayer
          </button>
        </div>
      )}

      {stats && <PendingApprovalsBanner pendingCount={stats.pendingCount ?? 0} />}

      <section aria-label="Vue d'ensemble">
        {loading ? (
          <AdminStatsSkeleton />
        ) : (
          <AdminStats stats={stats} funnel={funnel} />
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Pas d'erreurs

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/stats/
git commit -m "feat(admin): add dedicated stats page at /admin/stats"
```

---

### Task 3: Créer la page Members

**Files:**
- Create: `src/app/admin/members/page.tsx`

**Interfaces:**
- Consumes: `useMembers`, `MemberTable`, `MemberDetailDialog`, `fetchJson`
- Produits: Page `/admin/members` rendant la table des membres

- [ ] **Step 1: Créer le dossier et la page**

```bash
mkdir -p src/app/admin/members
```

Créer `src/app/admin/members/page.tsx` :

```tsx
"use client";

import * as React from "react";
import { useMembers } from "@/components/reboot/admin/hooks/useMembers";
import { MemberTable } from "@/components/reboot/admin/MemberTable";
import { MemberDetailDialog } from "@/components/reboot/admin/MemberDetailDialog";
import { fetchJson, isAbortError, withRetryAfter } from "@/components/reboot/admin/lib/fetchJson";
import { MemberTableSkeleton } from "@/components/reboot/admin/skeletons";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminMembersPage() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [bulkAction, setBulkAction] = React.useState<string | null>(null);
  const [bulkResult, setBulkResult] = React.useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = React.useState(false);

  const {
    members, total, page, pageSize, setPage,
    filters, setFilters, setFilter,
    searchQuery, setSearchQuery, debouncedSearchQuery,
    sortKey, sortDir, toggleSort,
    selectedIds, setSelectedIds, toggleSelect, toggleSelectAll,
    recentMembers, loading: membersLoading, loadError: membersError,
    refreshMembers, serverSorted,
  } = useMembers({});

  const loading = membersLoading;

  async function runBulk(action: "approve" | "invite" | "waitlist" | "reject" | "delete") {
    if (selectedIds.size === 0) return;
    if (action === "delete" && !confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }
    setBulkAction(action);
    setBulkResult(null);
    try {
      const { res, data, error, code, retryAfterSec } = await fetchJson("/api/members/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action }),
      });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        window.location.href = "/?admin=1";
        return;
      }
      if (!res.ok || !data?.ok) {
        const base = error ?? "Échec de l'action bulk.";
        setBulkResult(
          `Erreur: ${res.status === 429 || code === "RATE_LIMITED" ? withRetryAfter(base, retryAfterSec) : base}`,
        );
        return;
      }
      const affected = (data.affected as number) ?? 0;
      const partial = (data.partial as boolean) ?? false;
      const missing = (data.missing as number) ?? 0;
      setBulkResult(
        partial
          ? `${affected} membre(s) — action "${action}" partielle (${missing} introuvable(s)).`
          : `${affected} membre(s) — action "${action}" appliquée`,
      );
      toast({
        title: `${affected} membre(s) traité(s)`,
        description: `Action « ${action} » appliquée avec succès.`,
      });
      setConfirmBulkDelete(false);
      await refreshMembers();
    } catch (e) {
      if (isAbortError(e)) return;
      setBulkResult("Échec de l'action bulk.");
    } finally {
      setBulkAction(null);
    }
  }

  async function deleteMember(id: string) {
    try {
      const { res, error, code, retryAfterSec } = await fetchJson(`/api/members/${id}`, {
        method: "DELETE",
      });
      if (res.status === 401 || code === "UNAUTHORIZED") {
        window.location.href = "/?admin=1";
        return;
      }
      if (!res.ok) {
        toast({ title: "Erreur", description: error ?? "Échec de la suppression." });
        return;
      }
      setSelectedId(null);
      await refreshMembers();
    } catch (e) {
      if (isAbortError(e)) return;
      toast({ title: "Erreur", description: "Échec de la suppression." });
    }
  }

  return (
    <div className="space-y-8">
      {membersError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between gap-4 animate-hash-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-destructive shrink-0" />
            <p className="text-sm text-foreground">{membersError}</p>
          </div>
          <button
            onClick={() => void refreshMembers()}
            className="text-xs px-3 py-1.5 rounded-md border border-border bg-card text-foreground hover:border-lime/60 hover:text-lime transition-colors focus-lime whitespace-nowrap"
          >
            Réessayer
          </button>
        </div>
      )}

      <section aria-label="Membres">
        <MemberTable
          members={members}
          total={total}
          page={page}
          pageSize={pageSize}
          sortKey={sortKey}
          sortDir={sortDir}
          filters={filters}
          searchQuery={searchQuery}
          recentMembers={recentMembers}
          selectedIds={selectedIds}
          bulkAction={bulkAction}
          bulkResult={bulkResult}
          confirmBulkDelete={confirmBulkDelete}
          loading={loading}
          serverSorted={serverSorted}
          onToggleSort={toggleSort}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onFilter={setFilter}
          onClearFilters={() => setFilters({})}
          onSearchChange={setSearchQuery}
          onSelectMember={setSelectedId}
          onBulk={(a) => void runBulk(a)}
          onCancelSelection={() => {
            setSelectedIds(new Set());
            setConfirmBulkDelete(false);
          }}
          onDismissBulkResult={() => setBulkResult(null)}
          onConfirmBulkDeleteChange={setConfirmBulkDelete}
          onPageChange={setPage}
        />
      </section>

      <MemberDetailDialog
        id={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={() => void refreshMembers()}
        onDelete={deleteMember}
      />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Pas d'erreurs

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/members/
git commit -m "feat(admin): add dedicated members page at /admin/members"
```

---

### Task 4: Créer la page Activity

**Files:**
- Create: `src/app/admin/activity/page.tsx`

**Interfaces:**
- Consumes: `ActivityLog`
- Produits: Page `/admin/activity`

- [ ] **Step 1: Créer le dossier et la page**

```bash
mkdir -p src/app/admin/activity
```

Créer `src/app/admin/activity/page.tsx` :

```tsx
"use client";

import { ActivityLog } from "@/components/reboot/admin/ActivityLog";

export default function AdminActivityPage() {
  return (
    <div className="space-y-8">
      <section aria-label="Activité">
        <ActivityLog />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Pas d'erreurs

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/activity/
git commit -m "feat(admin): add dedicated activity page at /admin/activity"
```

---

### Task 5: Créer la page Exports

**Files:**
- Create: `src/app/admin/exports/page.tsx`

**Interfaces:**
- Consumes: `ImportCsvDialog`, `ExportDialog`, `RebootButton`, `fetchJson`
- Produits: Page `/admin/exports`

- [ ] **Step 1: Créer le dossier et la page**

```bash
mkdir -p src/app/admin/exports
```

Créer `src/app/admin/exports/page.tsx` :

```tsx
"use client";

import * as React from "react";
import { MonoLabel } from "@/components/reboot/shared";
import { RebootButton } from "@/components/reboot/shared";
import { ImportCsvDialog } from "@/components/reboot/admin/ImportCsvDialog";
import { ExportDialog } from "@/components/reboot/admin/ExportDialog";
import { Download, FileJson } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminExportsPage() {
  const [exporting, setExporting] = React.useState<"csv" | "json" | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const { toast } = useToast();

  async function handleExport(kind: "csv" | "json", columns?: string[]) {
    if (exporting) return;
    setExporting(kind);
    try {
      const url = kind === "csv" ? "/api/export" : "/api/export/json";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        toast({ title: "Erreur", description: "Échec de l'export." });
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `hashcode-reboot-members-${Date.now()}.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast({ title: `Export ${kind.toUpperCase()} terminé`, description: "Le fichier a été téléchargé." });
    } catch {
      toast({ title: "Erreur", description: "Échec de l'export." });
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-8">
      <section aria-label="Exports & Import">
        <div className="rounded-md border border-border/60 bg-card/40 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <MonoLabel className="text-muted-foreground">Exports & Import</MonoLabel>
              <p className="mt-1 text-sm text-muted-foreground">
                Exporte la vue filtrée ou tous les membres. CSV et JSON. Importe un CSV pour ajouter des membres.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ImportCsvDialog />
              <RebootButton
                size="sm"
                variant="outline"
                onClick={() => setExportDialogOpen(true)}
                disabled={exporting !== null}
              >
                <Download className="size-4" aria-hidden="true" />
                <span>{exporting === "csv" ? "Export…" : "CSV"}</span>
              </RebootButton>
              <span className="hidden md:inline-block" title="Exporter en JSON">
                <RebootButton
                  size="sm"
                  variant="outline"
                  onClick={() => void handleExport("json")}
                  disabled={exporting !== null}
                >
                  <FileJson className="size-4" />
                  <span className="hidden lg:inline">
                    {exporting === "json" ? "Export…" : "JSON"}
                  </span>
                </RebootButton>
              </span>
            </div>
          </div>
        </div>
      </section>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={(kind, columns) => void handleExport(kind, columns)}
        exporting={exporting}
      />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Pas d'erreurs

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/exports/
git commit -m "feat(admin): add dedicated exports page at /admin/exports"
```

---

### Task 6: Rediriger `/admin` vers `/admin/stats` + nettoyer l'ancien dashboard

**Files:**
- Modify: `src/app/admin/page.tsx` → redirect vers `/admin/stats`
- Delete: `src/app/admin/dashboard-client.tsx`
- Delete: `src/components/reboot/admin-dashboard.tsx`

**Interfaces:**
- Consumes: Rien de nouveau
- Produits: Redirection propre

- [ ] **Step 1: Remplacer `page.tsx` par une redirection**

Remplacer `src/app/admin/page.tsx` :

```tsx
import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/admin/stats");
}
```

- [ ] **Step 2: Supprimer `dashboard-client.tsx`**

```bash
rm src/app/admin/dashboard-client.tsx
```

- [ ] **Step 3: Supprimer `admin-dashboard.tsx`**

Vérifier d'abord qu'il n'est plus importé ailleurs :

```bash
grep -r "admin-dashboard" src/ --include="*.tsx" --include="*.ts"
```

Si plus d'imports, supprimer :

```bash
rm src/components/reboot/admin-dashboard.tsx
```

- [ ] **Step 4: Vérifier les imports cassés**

Run: `npx tsc --noEmit --pretty 2>&1 | head -50`
Expected: Pas d'erreurs

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin): redirect /admin to /admin/stats, remove monolithic dashboard"
```

---

### Task 7: Mettre à jour AdminSidebar pour la navigation par routes

**Files:**
- Modify: `src/components/reboot/admin/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `usePathname()` de Next.js
- Produits: Sidebar navigate par URL au lieu de scroll

- [ ] **Step 1: Modifier AdminSidebar pour lire le pathname**

Modifier le composant `AdminSidebar` pour qu'il utilise `usePathname()` au lieu de `activeSection` prop pour déterminer l'onglet actif, et que le clic sur un item navigue vers la route correspondante.

Remplacer la partie navigation dans `AdminSidebar.tsx` :

```tsx
// En haut du fichier, ajouter :
import { usePathname } from "next/navigation";

// Remplacer les ITEMS par des routes :
const ITEMS = [
  { path: "/admin/stats", id: "section-stats", label: "Vue d'ensemble", icon: LayoutDashboard },
  { path: "/admin/members", id: "section-members", label: "Membres", icon: Users },
  { path: "/admin/activity", id: "section-activity", label: "Activité", icon: Activity },
  { path: "/admin/exports", id: "section-exports", label: "Exports", icon: FileJson },
] as const;

// Dans le composant, remplacer activeSection prop par :
export function AdminSidebar({ onNavigate, onOpenPalette }: AdminSidebarProps) {
  const pathname = usePathname();
  const activeSection = ITEMS.find(i => pathname.startsWith(i.path))?.id ?? "section-stats";
  // ... reste du composant identique
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Pas d'erreurs

- [ ] **Step 3: Commit**

```bash
git add src/components/reboot/admin/AdminSidebar.tsx
git commit -m "feat(admin): update sidebar to use route-based navigation"
```

---

### Task 8: Nettoyage final et vérification

**Files:**
- Vérifier tous les imports
- Vérifier les hooks useMembers fonctionnent indépendamment

**Interfaces:**
- Consumes: Tout le travail précédent
- Produits: Build propre

- [ ] **Step 1: Lancer le build complet**

```bash
npm run build 2>&1 | tail -30
```

Expected: Build réussi sans erreurs

- [ ] **Step 2: Lancer le dev server et tester manuellement**

```bash
npm run dev
```

Vérifier :
- `/admin` redirige vers `/admin/stats`
- `/admin/stats` affiche les stats
- `/admin/members` affiche la table des membres
- `/admin/activity` affiche le journal d'activité
- `/admin/exports` affiche les options d'export
- La sidebar surligne l'onglet actif
- La navigation entre pages fonctionne

- [ ] **Step 3: Lancer le lint**

```bash
npm run lint 2>&1 | tail -20
```

Expected: Pas d'erreurs

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat(admin): complete tab-pages refactoring — each section has its own route"
```
