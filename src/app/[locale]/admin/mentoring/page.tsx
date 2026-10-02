"use client";

import * as React from "react";
import {
  GraduationCap,
  Users,
  Loader2,
  AlertCircle,
  MessageCircle,
  Check,
  UserPlus,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/components/reboot/admin/lib/fetchJson";

// ── Types (miroir des routes /api/admin/mentoring/*) ───────────────────────

interface LeadMentorship {
  id: string;
  status: string;
  frequency: string;
  mentor: { id: string; firstName: string; lastName: string | null };
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  country: string;
  primaryDomain: string;
  profileArchetype: string | null;
  budgetRange: string | null;
  mentoringFrequency: string | null;
  createdAt: string;
  mentorContactedAt: string | null;
  mentorshipsAsMentee: LeadMentorship[];
}

interface Mentor {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  country: string;
  primaryDomain: string;
  level: string;
  profileArchetype: string | null;
  mentoringFrequency: string | null;
  activeMentees: number;
}

interface Suggestion {
  mentorId: string;
  score: number;
  reasons: string[];
  mentor: {
    id: string;
    firstName: string;
    lastName: string | null;
    primaryDomain: string;
    level: string;
    profileArchetype: string | null;
    activeMentees: number;
  } | null;
}

function waLink(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? `https://wa.me/${digits}` : null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function AdminMentoringPage() {
  const [tab, setTab] = React.useState<"leads" | "mentors">("leads");
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [mentors, setMentors] = React.useState<Mentor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [budgetFilter, setBudgetFilter] = React.useState<string>("all");
  const [domainFilter, setDomainFilter] = React.useState<string>("all");
  const [expandedLead, setExpandedLead] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [suggesting, setSuggesting] = React.useState(false);
  const [acting, setActing] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, m] = await Promise.all([
        fetchJson("/api/admin/mentoring/leads"),
        fetchJson("/api/admin/mentoring/mentors"),
      ]);
      if (l.error) throw new Error(l.error);
      if (m.error) throw new Error(m.error);
      setLeads(l.data.leads ?? []);
      setMentors(m.data.mentors ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function markContacted(id: string) {
    setActing(`contact-${id}`);
    try {
      const { error: err } = await fetchJson("/api/admin/mentoring/contacted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: id }),
      });
      if (!err) await load();
    } finally {
      setActing(null);
    }
  }

  async function suggestFor(leadId: string) {
    if (expandedLead === leadId) {
      setExpandedLead(null);
      return;
    }
    setExpandedLead(leadId);
    setSuggesting(true);
    setSuggestions([]);
    try {
      const { data } = await fetchJson(`/api/admin/mentoring/match?menteeId=${leadId}`);
      setSuggestions(data?.suggestions ?? []);
    } finally {
      setSuggesting(false);
    }
  }

  async function assign(mentorId: string, menteeId: string) {
    setActing(`assign-${mentorId}`);
    try {
      const { error: err } = await fetchJson("/api/admin/mentoring/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mentorId, menteeId }),
      });
      if (!err) {
        setExpandedLead(null);
        await load();
      }
    } finally {
      setActing(null);
    }
  }

  const filteredLeads = leads.filter(
    (l) =>
      (budgetFilter === "all" || l.budgetRange === budgetFilter) &&
      (domainFilter === "all" || l.primaryDomain === domainFilter),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" aria-label="Chargement" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md bg-destructive/5 border border-destructive/40 px-4 py-3 text-sm">
        <AlertCircle className="size-4 shrink-0 mt-0.5 text-destructive" />
        <span>{error}</span>
        <button onClick={() => void load()} className="ml-auto underline underline-offset-4 hover:text-lime">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display font-bold text-2xl tracking-tight flex items-center gap-2">
          <GraduationCap className="size-6 text-lime" />
          Mentorat
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {leads.length} lead{leads.length > 1 ? "s" : ""} prioritaire{leads.length > 1 ? "s" : ""} · {mentors.length} mentor{mentors.length > 1 ? "s" : ""} potentiel{mentors.length > 1 ? "s" : ""}
        </p>
      </header>

      {/* Onglets */}
      <div className="flex gap-2" role="tablist" aria-label="Vues mentorat">
        {(["leads", "mentors"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors min-h-[44px]",
              tab === t
                ? "border-lime/60 bg-lime/10 text-lime"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "leads" ? <UserPlus className="size-4" /> : <Users className="size-4" />}
            {t === "leads" ? "Leads prioritaires" : "Mentors"}
          </button>
        ))}
      </div>

      {tab === "leads" && (
        <section className="space-y-3" aria-label="Leads prioritaires">
          {/* Filtres */}
          <div className="flex flex-wrap gap-2">
            <select
              value={budgetFilter}
              onChange={(e) => setBudgetFilter(e.target.value)}
              className="h-10 rounded-md border border-border bg-card px-3 text-sm"
              aria-label="Filtrer par budget"
            >
              <option value="all">Tous budgets</option>
              <option value="20000-30000">20–30k</option>
              <option value=">30000">&gt;30k</option>
            </select>
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="h-10 rounded-md border border-border bg-card px-3 text-sm"
              aria-label="Filtrer par domaine"
            >
              <option value="all">Tous domaines</option>
              <option value="web">Web</option>
              <option value="cybersecurity">Cyber</option>
              <option value="ai">IA</option>
            </select>
          </div>

          {filteredLeads.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucun lead prioritaire pour le moment.
            </p>
          )}

          {filteredLeads.map((l) => {
            const wa = waLink(l.phone);
            const assigned = l.mentorshipsAsMentee[0];
            const expanded = expandedLead === l.id;
            return (
              <article key={l.id} className="rounded-lg border border-border/60 bg-card/40 p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-foreground">
                      {l.firstName}{l.lastName ? ` ${l.lastName}` : ""}
                      {l.profileArchetype && (
                        <span className="ml-2 text-xs font-mono text-lime">{l.profileArchetype}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{l.email}</p>
                    <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                      {l.budgetRange ?? "—"} · {l.mentoringFrequency ?? "—"} · {l.country} · inscrit le {fmtDate(l.createdAt)}
                    </p>
                    <p className="text-xs mt-1 flex flex-wrap gap-2">
                      {l.mentorContactedAt ? (
                        <span className="text-lime">Contacté le {fmtDate(l.mentorContactedAt)}</span>
                      ) : (
                        <span className="text-amber-300">Pas encore contacté</span>
                      )}
                      {assigned && (
                        <span className="text-sky-300">
                          Suivi par {assigned.mentor.firstName} ({assigned.status})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 min-h-[44px] text-sm hover:border-lime/60 hover:text-lime transition-colors"
                      >
                        <MessageCircle className="size-4" />
                        WhatsApp
                      </a>
                    )}
                    {!l.mentorContactedAt && (
                      <button
                        onClick={() => void markContacted(l.id)}
                        disabled={acting === `contact-${l.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 min-h-[44px] text-sm hover:border-lime/60 hover:text-lime transition-colors disabled:opacity-40"
                      >
                        <Check className="size-4" />
                        Marquer contacté
                      </button>
                    )}
                    {!assigned && (
                      <button
                        onClick={() => void suggestFor(l.id)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-lime px-3 min-h-[44px] text-sm font-medium text-background hover:bg-lime/90 transition-colors"
                      >
                        <Sparkles className="size-4" />
                        {expanded ? "Masquer" : "Suggérer un mentor"}
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="rounded-md border border-border/60 bg-background/60 p-3 space-y-2">
                    {suggesting && (
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                        Calcul des suggestions…
                      </p>
                    )}
                    {!suggesting && suggestions.length === 0 && (
                      <p className="text-xs text-muted-foreground">Aucun mentor disponible.</p>
                    )}
                    {suggestions.map((s) =>
                      s.mentor ? (
                        <div key={s.mentorId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/40 px-3 py-2">
                          <div className="text-sm">
                            <span className="font-medium text-foreground">
                              {s.mentor.firstName}{s.mentor.lastName ? ` ${s.mentor.lastName}` : ""}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {s.mentor.primaryDomain} · {s.mentor.level} · {s.mentor.activeMentees} mentoré{s.mentor.activeMentees > 1 ? "s" : ""}
                            </span>
                            <span className="ml-2 font-mono text-xs text-lime tabular-nums">{s.score}/100</span>
                          </div>
                          <button
                            onClick={() => void assign(s.mentorId, l.id)}
                            disabled={acting === `assign-${s.mentorId}`}
                            className="inline-flex items-center gap-1 rounded-md bg-lime px-3 min-h-[40px] text-xs font-medium text-background hover:bg-lime/90 disabled:opacity-40"
                          >
                            Assigner
                          </button>
                        </div>
                      ) : null,
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {tab === "mentors" && (
        <section className="space-y-3" aria-label="Mentors potentiels">
          {mentors.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucun mentor potentiel pour le moment.
            </p>
          )}
          {mentors.map((m) => (
            <article key={m.id} className="rounded-lg border border-border/60 bg-card/40 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display font-semibold text-foreground">
                  {m.firstName}{m.lastName ? ` ${m.lastName}` : ""}
                  {m.profileArchetype && (
                    <span className="ml-2 text-xs font-mono text-lime">{m.profileArchetype}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground font-mono truncate">{m.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {m.primaryDomain} · {m.level} · {m.mentoringFrequency ?? "—"} · {m.country}
                </p>
              </div>
              <span className={cn(
                "text-xs font-mono tabular-nums rounded-full border px-3 py-1.5",
                m.activeMentees === 0
                  ? "border-lime/50 text-lime"
                  : "border-border text-muted-foreground",
              )}>
                {m.activeMentees} mentoré{m.activeMentees > 1 ? "s" : ""} actif{m.activeMentees > 1 ? "s" : ""}
              </span>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
