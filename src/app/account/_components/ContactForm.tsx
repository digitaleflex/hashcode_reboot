"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";
import type { AccountMember } from "./types";

/**
 * Formulaire d'édition des infos de contact + objectif 3 mois.
 * Client component : état local + PATCH /api/account/profile.
 *
 * Email volontairement non éditable (changement = flow de vérification séparé).
 */
export function ContactForm({ member }: { member: AccountMember }) {
  const router = useRouter();
  const [lastName, setLastName] = React.useState(member.lastName);
  const [phone, setPhone] = React.useState(member.phone);
  const [city, setCity] = React.useState(member.city);
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
      threeMonthGoal !== (member.threeMonthGoal ?? "");
    setDirty(isDirty);
  }, [lastName, phone, city, threeMonthGoal, member]);

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
          threeMonthGoal: threeMonthGoal.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setError(
            data.error ?? "Trop de modifications. Réessaie dans quelques minutes.",
          );
        } else {
          setError(data.error ?? "Erreur lors de la mise à jour.");
        }
        return;
      }
      setSuccess(true);
      setDirty(false);
      // Refresh server data (revalidate path /account)
      router.refresh();
    } catch {
      setError("Erreur réseau. Vérifie ta connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <MonoLabel className="text-muted-foreground block mb-1.5">
          Email
        </MonoLabel>
        <input
          type="email"
          value={member.email}
          disabled
          className="w-full rounded-md border border-border bg-card/40 px-3 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Pour changer ton email, contacte-nous via WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <MonoLabel className="text-muted-foreground block mb-1.5">
            Prénom
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
            Nom{" "}
            <span className="text-border normal-case">(facultatif)</span>
          </MonoLabel>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={60}
            disabled={loading}
            placeholder="Ex. Dossou"
            className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime transition-colors disabled:opacity-50"
          />
        </div>
      </div>

      <div>
        <MonoLabel className="text-muted-foreground block mb-1.5">
          WhatsApp
        </MonoLabel>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={40}
          disabled={loading}
          placeholder="+229 ..."
          className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime transition-colors disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Format international (+229...). On utilise ce numéro pour t&apos;inviter au
          groupe.
        </p>
      </div>

      <div>
        <MonoLabel className="text-muted-foreground block mb-1.5">
          Ville{" "}
          <span className="text-border normal-case">(facultatif)</span>
        </MonoLabel>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={80}
          disabled={loading}
          placeholder="Ex. Cotonou"
          className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime transition-colors disabled:opacity-50"
        />
      </div>

      <div>
        <MonoLabel className="text-muted-foreground block mb-1.5">
          Objectif à 3 mois
        </MonoLabel>
        <textarea
          value={threeMonthGoal}
          onChange={(e) => setThreeMonthGoal(e.target.value)}
          maxLength={280}
          rows={3}
          disabled={loading}
          placeholder="Ex. Avoir décroché mon premier poste de dev web."
          className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lime focus:border-lime transition-colors disabled:opacity-50 resize-y"
        />
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>4 caractères minimum. C&apos;est ce qui t&apos;aide à la validation.</span>
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
          Modifications enregistrées.
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
              Enregistrement…
            </>
          ) : (
            <>
              <Save className="size-4" />
              Enregistrer
            </>
          )}
        </RebootButton>
      </div>
    </form>
  );
}
