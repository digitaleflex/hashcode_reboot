"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, MailCheck, MailWarning } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = React.useState<"loading" | "ok" | "error">("loading");
  const [email, setEmail] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) {
      setState("error");
      setError("Lien manquant. Demande un nouveau lien depuis ton profil.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/verify-email?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data?.ok) {
          setEmail(typeof data.email === "string" ? data.email : "");
          setState("ok");
        } else {
          setError(data?.error ?? "Lien invalide ou expiré.");
          setState("error");
        }
      } catch {
        if (!cancelled) {
          setError("Erreur réseau. Vérifie ta connexion puis réessaie.");
          setState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="w-full max-w-md text-center">
      {state === "loading" && (
        <div className="animate-hash-in">
          <Loader2 className="mx-auto size-10 animate-spin text-lime" />
          <h1 className="mt-5 font-display font-bold text-2xl tracking-tight">
            Vérification en cours…
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Une seconde.</p>
        </div>
      )}
      {state === "ok" && (
        <div className="animate-hash-in">
          <MailCheck className="mx-auto text-lime" size={44} />
          <MonoLabel className="mt-4 text-lime">EMAIL VÉRIFIÉ</MonoLabel>
          <h1 className="mt-2 font-display font-bold text-2xl sm:text-3xl tracking-tight">
            C&apos;est bon, ton email est confirmé.
          </h1>
          {email && (
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="text-foreground font-medium">{email}</span> — tu peux retourner à HASHCODE.
            </p>
          )}
          <div className="mt-7 flex flex-col gap-3">
            <RebootButton size="lg" className="w-full" onClick={() => (window.location.href = "/")}>
              Retourner à HASHCODE
            </RebootButton>
            <a
              href="/login"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Se connecter
            </a>
          </div>
        </div>
      )}
      {state === "error" && (
        <div className="animate-hash-in">
          <MailWarning className="mx-auto text-destructive" size={44} />
          <MonoLabel className="mt-4 text-destructive">LIEN INVALIDE</MonoLabel>
          <h1 className="mt-2 font-display font-bold text-2xl tracking-tight">
            Ce lien ne marche plus.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground" role="alert">
            {error ?? "Lien expiré. Demande un nouveau lien."}
          </p>
          <div className="mt-7">
            <RebootButton size="lg" className="w-full" onClick={() => (window.location.href = "/")}>
              Retourner à HASHCODE
            </RebootButton>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            Astuce : demande un nouveau lien depuis la fin de ton inscription ou ton espace.
          </p>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-center p-4 sm:p-6">
        <Logo />
      </header>
      <div className="flex-1 flex items-center justify-center px-4">
        <React.Suspense
          fallback={
            <div className="w-full max-w-md text-center">
              <Loader2 className="mx-auto size-10 animate-spin text-lime" />
              <p className="mt-3 text-sm text-muted-foreground">Chargement…</p>
            </div>
          }
        >
          <VerifyEmailContent />
        </React.Suspense>
      </div>
    </main>
  );
}
