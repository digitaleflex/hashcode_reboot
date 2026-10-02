"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MonoLabel } from "@/components/reboot/shared";
import { Loader2, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface MeData {
  member?: Record<string, unknown>;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export default function ProfileCompletPage() {
  const t = useTranslations("dashboard.profileComplet");
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<null | {
    profileStatus: string;
    archetype: string;
  }>(null);
  const [form, setForm] = React.useState({
    firstName: "",
    lastName: "",
    phone: "",
    country: "",
    city: "",
    primaryDomain: "web",
    level: "beginner",
    goal: "project",
    availability: "5-10h",
    learningStyle: "practice",
    mentoringInterest: "no",
    threeMonthGoal: "",
  });

  const domains = t.raw("domains") as Array<[string, string]>;
  const levels = t.raw("levels") as Array<[string, string]>;
  const goals = t.raw("goals") as Array<[string, string]>;
  const availabilities = t.raw("availabilities") as string[];
  const learning = t.raw("learning") as Array<[string, string]>;

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/account/me", { cache: "no-store" });
        if (res.status === 401) {
          router.push("/login?next=/dashboard/profile-complet");
          return;
        }
        const data = (await res.json()) as MeData;
        const m = data.member ?? {};
        setForm((f) => ({
          ...f,
          firstName: str(m.firstName, f.firstName),
          lastName: str(m.lastName, f.lastName),
          phone: str(m.phone, f.phone),
          country: str(m.country, f.country),
          city: str(m.city, f.city),
          primaryDomain: str(m.primaryDomain, f.primaryDomain),
          level: str(m.level, f.level),
          goal: str(m.goal, f.goal) || f.goal,
          availability: str(m.availability, f.availability),
          learningStyle: str(m.learningStyle, f.learningStyle),
          mentoringInterest: str(m.mentoringInterest, f.mentoringInterest) || f.mentoringInterest,
          threeMonthGoal: str(m.threeMonthGoal, f.threeMonthGoal),
        }));
      } catch {
        setError(t("loadError"));
      } finally {
        setLoading(false);
      }
    })();
  }, [router, t]);

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/account/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t("saveError"));
        return;
      }
      setDone({
        profileStatus: data.profileStatus as string,
        archetype: data.archetype as string,
      });
    } catch {
      setError(t("networkError"));
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    const approved = done.profileStatus === "APPROVED";
    return (
      <div className="mx-auto max-w-xl w-full px-5 sm:px-8 py-12 text-center">
        <div className="rounded-lg border border-border/60 bg-card/40 p-8">
          {approved ? (
            <CheckCircle2 className="size-10 text-lime mx-auto" />
          ) : (
            <Clock className="size-10 text-amber-400 mx-auto" />
          )}
          <h1 className="mt-4 text-2xl font-bold">
            {approved ? t("success.approvedTitle") : t("success.pendingTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {approved
              ? t("success.approvedDescription", { archetype: done.archetype })
              : t("success.pendingDescription")}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            {approved && (
              <a
                href="/api/community/join"
                className="inline-flex items-center justify-center min-h-[44px] px-6 rounded-md bg-lime text-black font-medium hover:bg-lime/90 transition-colors"
              >
                {t("success.joinWhatsApp")}
              </a>
            )}
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center justify-center min-h-[44px] px-6 rounded-md border border-border bg-card hover:border-lime/60 hover:text-lime transition-colors"
            >
              {t("success.viewDashboard")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl w-full px-5 sm:px-8 py-8">
      <MonoLabel className="text-lime">{t("header.tag")}</MonoLabel>
      <h1 className="mt-1 text-2xl font-bold">{t("header.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("header.description")}
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> {t("loading")}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("fields.firstName")}>
              <input required maxLength={40} value={form.firstName} onChange={set("firstName")} className={inputCls} />
            </Field>
            <Field label={t("fields.lastName")}>
              <input maxLength={60} value={form.lastName} onChange={set("lastName")} className={inputCls} />
            </Field>
            <Field label={t("fields.phone")}>
              <input value={form.phone} onChange={set("phone")} placeholder={t("fields.phonePlaceholder")} className={inputCls} />
            </Field>
            <Field label={t("fields.country")}>
              <input required maxLength={8} value={form.country} onChange={set("country")} placeholder={t("fields.countryPlaceholder")} className={inputCls} />
            </Field>
            <Field label={t("fields.city")}>
              <input maxLength={80} value={form.city} onChange={set("city")} className={inputCls} />
            </Field>
            <Field label={t("fields.primaryDomain")}>
              <select value={form.primaryDomain} onChange={set("primaryDomain")} className={inputCls}>
                {domains.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label={t("fields.level")}>
              <select value={form.level} onChange={set("level")} className={inputCls}>
                {levels.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label={t("fields.goal")}>
              <select value={form.goal} onChange={set("goal")} className={inputCls}>
                {goals.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label={t("fields.availability")}>
              <select value={form.availability} onChange={set("availability")} className={inputCls}>
                {availabilities.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label={t("fields.learningStyle")}>
              <select value={form.learningStyle} onChange={set("learningStyle")} className={inputCls}>
                {learning.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={t("fields.threeMonthGoal")}>
            <textarea
              required
              minLength={4}
              maxLength={280}
              rows={3}
              value={form.threeMonthGoal}
              onChange={set("threeMonthGoal")}
              placeholder={t("fields.threeMonthGoalPlaceholder")}
              className={cn(inputCls, "resize-y")}
            />
          </Field>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] w-full sm:w-auto px-8 rounded-md bg-lime text-black font-medium hover:bg-lime/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t("submitButton")}
          </button>
        </form>
      )}
    </div>
  );
}

const inputCls =
  "mt-1.5 w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:border-lime transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <MonoLabel className="text-muted-foreground">{label}</MonoLabel>
      {children}
    </label>
  );
}