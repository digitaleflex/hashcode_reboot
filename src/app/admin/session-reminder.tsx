"use client";

import * as React from "react";
import { Clock, X, RotateCcw, Save } from "lucide-react";

/**
 * Rappel d'expiration de session admin (12h).
 * Affiche un rappel ~15 min puis ~2 min avant expiration, sauvegarde les
 * brouillons (note membre + import CSV) en localStorage et les restaure
 * après reconnexion.
 *
 * L'expiration exacte vit dans le cookie HttpOnly : on estime le départ
 * via `hashcode-admin-session-start` (posé au login, figé ensuite).
 */

const SESSION_MS = 12 * 60 * 60 * 1000;
const WARN_FIRST_MS = 15 * 60 * 1000;
const WARN_LAST_MS = 2 * 60 * 1000;

const KEY_START = "hashcode-admin-session-start";
const KEY_NOTE = "hashcode-admin-draft-note";
const KEY_IMPORT = "hashcode-admin-draft-import";
const KEY_RESTORED = "hashcode-admin-draft-restored";

type DraftNote = { text: string; memberId: string | null; at: number };
type DraftImport = { text: string; at: number };

function readStart(): number {
  try {
    const raw = window.localStorage.getItem(KEY_START);
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n > 0 && n <= Date.now()) return n;
    const now = Date.now();
    window.localStorage.setItem(KEY_START, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

function currentFieldValue(id: string): string | null {
  const el = document.getElementById(id);
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
  return null;
}

function selectedMemberId(): string | null {
  try {
    const sp = new URLSearchParams(window.location.search);
    return sp.get("selectedId") ?? sp.get("member");
  } catch {
    return null;
  }
}

function saveDrafts(manual = false): boolean {
  let saved = false;
  try {
    const note = currentFieldValue("admin-note");
    if (note !== null && note.trim()) {
      const payload: DraftNote = { text: note, memberId: selectedMemberId(), at: Date.now() };
      window.localStorage.setItem(KEY_NOTE, JSON.stringify(payload));
      saved = true;
    } else if (manual) {
      // En manuel, on ne supprime rien : on garde le dernier brouillon.
    }
    const csv = currentFieldValue("csv-data");
    if (csv !== null && csv.trim()) {
      const payload: DraftImport = { text: csv, at: Date.now() };
      window.localStorage.setItem(KEY_IMPORT, JSON.stringify(payload));
      saved = true;
    }
  } catch {
    /* stockage indisponible */
  }
  return saved;
}

/** Injecte une valeur dans un textarea contrôlé par React. */
function setReactTextareaValue(el: HTMLTextAreaElement, value: string) {
  const proto = window.HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function formatRemaining(ms: number): string {
  const totalMin = Math.max(1, Math.round(ms / 60000));
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }
  return `${totalMin} min`;
}

export function SessionReminder() {
  const [expiry] = React.useState<number>(() =>
    typeof window === "undefined" ? Date.now() + SESSION_MS : readStart() + SESSION_MS,
  );
  const [now, setNow] = React.useState<number>(() => Date.now());
  const [dismissedFirst, setDismissedFirst] = React.useState(false);
  const [dismissedLast, setDismissedLast] = React.useState(false);
  const [restoreInfo, setRestoreInfo] = React.useState<string | null>(null);
  const [saveInfo, setSaveInfo] = React.useState<string | null>(null);
  const restoredRef = React.useRef(false);

  // Horloge + sauvegarde périodique discrète.
  React.useEffect(() => {
    const t = window.setInterval(() => {
      setNow(Date.now());
      saveDrafts(false);
    }, 30000);
    return () => window.clearInterval(t);
  }, []);

  // Sauvegarde à chaque frappe dans les champs concernés.
  React.useEffect(() => {
    function onInput(e: Event) {
      const t = e.target as HTMLElement | null;
      if (t && (t.id === "admin-note" || t.id === "csv-data")) saveDrafts(false);
    }
    function onBeforeUnload() {
      saveDrafts(false);
    }
    document.addEventListener("input", onInput, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("input", onInput, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  // Restauration après reconnexion : réinjecte les brouillons quand les
  // champs apparaissent (dialogues montés à l'ouverture).
  React.useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    let note: DraftNote | null = null;
    let imp: DraftImport | null = null;
    try {
      const rn = window.localStorage.getItem(KEY_NOTE);
      const ri = window.localStorage.getItem(KEY_IMPORT);
      note = rn ? (JSON.parse(rn) as DraftNote) : null;
      imp = ri ? (JSON.parse(ri) as DraftImport) : null;
      if (window.localStorage.getItem(KEY_RESTORED) === "1") {
        note = null;
        imp = null;
      }
    } catch {
      note = null;
      imp = null;
    }
    if ((!note || !note.text.trim()) && (!imp || !imp.text.trim())) return;

    let attempts = 0;
    const restored: string[] = [];
    const timer = window.setInterval(() => {
      attempts += 1;
      try {
        if (note && note.text.trim()) {
          const el = document.getElementById("admin-note");
          if (el instanceof HTMLTextAreaElement && !el.value.trim()) {
            setReactTextareaValue(el, note.text);
            if (!restored.includes("note")) restored.push("note");
          }
        }
        if (imp && imp.text.trim()) {
          const el = document.getElementById("csv-data");
          if (el instanceof HTMLTextAreaElement && !el.value.trim()) {
            setReactTextareaValue(el, imp.text);
            if (!restored.includes("import")) restored.push("import");
          }
        }
      } catch {
        /* ignore */
      }
      if (restored.length > 0) {
        const labels = restored.map((r) => (r === "note" ? "note" : "import CSV")).join(" et ");
        setRestoreInfo(`Brouillon ${labels} restauré. Vérifie puis enregistre.`);
        try {
          window.localStorage.setItem(KEY_RESTORED, "1");
        } catch {
          /* ignore */
        }
        window.clearInterval(timer);
      } else if (attempts >= 40) {
        // Champs jamais ouverts : on signale quand même le brouillon dispo.
        if ((note && note.text.trim()) || (imp && imp.text.trim())) {
          setRestoreInfo("Un brouillon est conservé. Ouvre la note ou l'import pour le retrouver.");
        }
        window.clearInterval(timer);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = expiry - now;
  const showFirst =
    remaining > 0 && remaining <= WARN_FIRST_MS && remaining > WARN_LAST_MS && !dismissedFirst;
  const showLast = remaining > 0 && remaining <= WARN_LAST_MS && !dismissedLast;
  const expired = remaining <= 0;

  // À l'expiration, fige les brouillons une dernière fois.
  React.useEffect(() => {
    if (expired) saveDrafts(false);
  }, [expired]);

  function handleManualSave() {
    const ok = saveDrafts(true);
    setSaveInfo(ok ? "Brouillon enregistré sur cet appareil." : "Rien à enregistrer pour l'instant.");
    window.setTimeout(() => setSaveInfo(null), 3000);
  }

  function handleReconnect() {
    saveDrafts(false);
    try {
      window.localStorage.removeItem(KEY_RESTORED);
    } catch {
      /* ignore */
    }
    window.location.href = "/?admin=1";
  }

  function clearRestoreNotice(clearDrafts: boolean) {
    setRestoreInfo(null);
    if (clearDrafts) {
      try {
        window.localStorage.removeItem(KEY_NOTE);
        window.localStorage.removeItem(KEY_IMPORT);
        window.localStorage.setItem(KEY_RESTORED, "1");
      } catch {
        /* ignore */
      }
    }
  }

  if (!showFirst && !showLast && !expired && !restoreInfo && !saveInfo) return null;

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {restoreInfo && (
        <div
          role="status"
          className="pointer-events-auto w-full max-w-md rounded-md border border-lime/40 bg-card px-4 py-3 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-foreground">{restoreInfo}</p>
            <button
              type="button"
              onClick={() => clearRestoreNotice(false)}
              aria-label="Fermer le message de restauration"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-lime"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => clearRestoreNotice(true)}
              className="min-h-[36px] rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-lime/60 focus-lime"
            >
              Écarter
            </button>
          </div>
        </div>
      )}

      {(showFirst || showLast) && (
        <div
          role={showLast ? "alert" : "status"}
          className="pointer-events-auto w-full max-w-md rounded-md border border-amber-500/40 bg-card px-4 py-3 shadow-lg"
        >
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {showLast
                  ? `Session bientôt terminée (${formatRemaining(remaining)} restantes).`
                  : `Session active : expiration dans ${formatRemaining(remaining)}.`}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Tes brouillons (note, import) sont enregistrés sur cet appareil et
                restaurés après reconnexion. Termine ta saisie en cours.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleManualSave}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:border-lime/60 hover:text-lime focus-lime"
                >
                  <Save className="size-3.5" aria-hidden />
                  Enregistrer le brouillon
                </button>
                <button
                  type="button"
                  onClick={handleReconnect}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-lime/50 bg-lime/10 px-3 py-1.5 text-xs font-medium text-lime hover:bg-lime/15 focus-lime"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Se reconnecter
                </button>
                <button
                  type="button"
                  onClick={() => (showLast ? setDismissedLast(true) : setDismissedFirst(true))}
                  className="min-h-[36px] rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground focus-lime"
                >
                  Plus tard
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => (showLast ? setDismissedLast(true) : setDismissedFirst(true))}
              aria-label="Fermer le rappel de session"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-lime"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {expired && (
        <div
          role="alert"
          className="pointer-events-auto w-full max-w-md rounded-md border border-destructive/40 bg-card px-4 py-3 shadow-lg"
        >
          <p className="text-sm font-medium text-foreground">Session terminée.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Tes brouillons ont été conservés sur cet appareil. Reconnecte-toi pour les retrouver.
          </p>
          <div className="mt-2.5">
            <button
              type="button"
              onClick={handleReconnect}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-lime/50 bg-lime/10 px-4 py-2 text-sm font-medium text-lime hover:bg-lime/15 focus-lime"
            >
              <RotateCcw className="size-4" aria-hidden />
              Se reconnecter
            </button>
          </div>
        </div>
      )}

      {saveInfo && (
        <div role="status" className="pointer-events-auto rounded-md border border-lime/40 bg-card px-4 py-2 shadow-lg">
          <p className="text-xs text-foreground">{saveInfo}</p>
        </div>
      )}
    </div>
  );
}
