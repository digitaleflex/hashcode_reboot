"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Mail, Loader2 } from "lucide-react";
import { Logo, HashSymbol } from "@/components/brand/logo";
import { RebootButton, MonoLabel } from "@/components/reboot/shared";
import { useTranslations } from "next-intl";

function LoginForm() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const searchParams = useSearchParams();
  // Anti open-redirect (défense en profondeur, le sink /verify-otp filtre aussi).
  const rawNext = searchParams.get("next") || "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t("errors.invalidEmail"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setError(data.error ?? t("errors.tooManyRequests"));
        } else {
          setError(data.error ?? t("errors.generic"));
        }
        return;
      }
      setSent(true);
      // Redirige vers /verify-otp avec l'email en query
      router.push(`/verify-otp?email=${encodeURIComponent(trimmed)}&next=${encodeURIComponent(next)}`);
    } catch {
      setError(t("errors.network"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <HashSymbol className="mx-auto text-lime" size={36} />
        <h1 className="mt-4 text-2xl sm:text-3xl font-display font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <MonoLabel className="text-muted-foreground">{t("emailLabel")}</MonoLabel>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            autoFocus
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || sent}
            required
            className="mt-1.5 w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:border-lime transition-colors disabled:opacity-50"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <RebootButton
          type="submit"
          size="lg"
          className="w-full"
          disabled={loading || sent || !email.trim()}
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("sending")}
            </>
          ) : (
            <>
              <Mail className="size-4" />
              {t("submit")}
            </>
          )}
        </RebootButton>

        <p className="text-xs text-muted-foreground text-center mt-4">
          {t("noAccountText")}{" "}
          <a href="/" className="text-lime hover:underline">
            {t("createProfileLink")}
          </a>
        </p>
      </form>
    </div>
  );
}

function LoginFallback() {
  const t = useTranslations("auth.login");
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <HashSymbol className="mx-auto text-lime" size={36} />
        <h1 className="mt-4 text-2xl sm:text-3xl font-display font-bold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("loadingText")}</p>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar minimal */}
      <header className="flex items-center justify-between p-4 sm:p-6">
        <a
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          {t("backLink")}
        </a>
        <Logo />
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <React.Suspense fallback={<LoginFallback />}>
          <LoginForm />
        </React.Suspense>
      </div>
    </main>
  );
}