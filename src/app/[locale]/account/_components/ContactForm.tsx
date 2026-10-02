"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";
import { useTranslations } from "next-intl";
import type { AccountMember } from "./types";

/**
 * Formulaire d'édition des infos de contact + objectif 3 mois.
 * Client component : état local + PATCH /api/account/profile.
 *
 * Email volontairement non éditable (changement = flow de vérification séparé).
 */
export function ContactForm({ member }: { member: AccountMember }) {
  const t = useTranslations("account.contactForm");
  const router = useRouter();
  const [lastName, setLastName] = React.useState(member.lastName);
  const [phone, setPhone] = React.useState(member.phone);
  const [city, setCity] = React.useState(member.city);
  const [gender, setGender] = React.useState(member.gender ?? "");
  const [threeMonthGoal, setThreeMonthGoal] = React.useState(
    member.threeMonthGoal ?? "",
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  // Track dirty state
  React.useEffect(() => {
    const isDirty =
      lastName !== member.lastName ||
      phone !== member.phone ||
      city !== member.city ||
      gender !== (member.gender ?? "") ||
      threeMonthGoal !== (member.threeMonthGoal ?? "");
    setDirty(isDirty);
  }, [lastName, phone, city, gender, threeMonthGoal, member]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || loading) return;
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastName: lastName.trim(),
          phone: phone.trim(),
          city: city.trim(),
          gender: gender || null,
          threeMonthGoal: threeMonthGoal.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setError(
            data.error ?? t("rateLimitError", { defaultValue: "Trop de modifications. Réessaie dans quelques minutes." }),
          );
        } else {
          setError(data.error ?? t("genericError", { defaultValue: "Erreur lors de la mise à jour." }));
        }
        return;
      }
      setSuccess(true);
      setDirty(false);
      // Refresh server data (revalidate path /account)
      router.refresh();
    } catch {
      setError(t("networkError", { defaultValue: "Erreur réseau. Vérifie ta connexion." }));
    } finally {
      setLoading(false);
    }
  }

  const genderOptions = t.raw("genderOptions") as Array<{ value: string; label: string }>;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <MonoLabel className="text-muted-foreground block mb-1.5">
          {t("emailLabel")}
        </MonoLabel>
        <input
          type="email"
          value={member.email}
          disabled
          className="w-full rounded-md border border-border bg-card/40 px-3 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {t("emailChangeNote")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <MonoLabel className="text-muted-foreground block mb-1.5">
            {t("firstNameLabel")}
          </MonoLabel>
          <input
            type="text"
            value={member.firstName}
            disabled
            className="w-full rounded-md border border-border bg-card/40 px-3 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
          />
        </div>
        <div>
          <MonoLabel className="text-muted-foreground block mb-1.5">
            {t("lastNameLabel")}{" "}
            <span className="text-border normal-case">({t("optional")})</span>
          </MonoLabel>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={60}
            disabled={loading}
            placeholder={t("lastNamePlaceholder")}
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:border-lime transition-colors disabled:opacity-50"
          />
        </div>
      </div>

      <div>
        <MonoLabel className="text-muted-foreground block mb-1.5">
          {t("phoneLabel")}
        </MonoLabel>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={40}
          disabled={loading}
          placeholder={t("phonePlaceholder")}
          className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:border-lime transition-colors disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {t("phoneNote")}
        </p>
      </div>

      <div>
        <MonoLabel className="text-muted-foreground block mb-1.5">
          {t("cityLabel")}{" "}
          <span className="text-border normal-case">({t("optional")})</span>
        </MonoLabel>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={80}
          disabled={loading}
          placeholder={t("cityPlaceholder")}
          className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:border-lime transition-colors disabled:opacity-50"
        />
      </div>

      <div>
        <MonoLabel className="text-muted-foreground block mb-1.5">
          {t("genderLabel")}{" "}
          <span className="text-border normal-case">({t("optional")})</span>
        </MonoLabel>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          disabled={loading}
          className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:border-lime transition-colors disabled:opacity-50"
        >
          {genderOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <MonoLabel className="text-muted-foreground block mb-1.5">
          {t("goalLabel")}
        </MonoLabel>
        <textarea
          value={threeMonthGoal}
          onChange={(e) => setThreeMonthGoal(e.target.value)}
          maxLength={280}
          rows={3}
          disabled={loading}
          placeholder={t("goalPlaceholder")}
          className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:border-lime transition-colors disabled:opacity-50 resize-y"
        />
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("goalMinChars")}</span>
          <span>{threeMonthGoal.length} / 280</span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {success && !error && (
        <div
          role="status"
          className="rounded-md border border-lime/40 bg-lime/5 p-3 text-sm text-foreground"
        >
          {t("successMessage")}
        </div>
      )}

      <div className="flex justify-end">
        <RebootButton
          type="submit"
          size="md"
          disabled={loading || !dirty}
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("saving")}
            </>
          ) : (
            <>
              <Save className="size-4" />
              {t("saveButton")}
            </>
          )}
        </RebootButton>
      </div>
    </form>
  );
}