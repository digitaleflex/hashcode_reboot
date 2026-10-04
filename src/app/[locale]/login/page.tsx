"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthLayout } from "@/components/auth/auth-layout";
import { EmailForm } from "@/components/auth/email-form";
import { sanitizeNext } from "@/lib/auth-ui";

export const dynamic = "force-dynamic";

function LoginBody() {
  const t = useTranslations("auth.login");
  const searchParams = useSearchParams();
  // Anti open-redirect (défense en profondeur, le sink /verify-otp filtre aussi).
  const next = sanitizeNext(searchParams.get("next"));

  return (
    <AuthLayout step={1} title={t("title")} subtitle={t("subtitle")} backHref="/">
      <EmailForm next={next} />
    </AuthLayout>
  );
}

/**
 * Fallback de `<Suspense>` — `useSearchParams` suspend le rendu.
 * Même coquille que la page résolue : ni le titre ni la marque ne doivent
 * disparaître le temps de résoudre les search params.
 */
function LoginFallback() {
  const t = useTranslations("auth.login");
  return (
    <AuthLayout step={1} title={t("title")} subtitle={t("loadingText")} backHref="/">
      <p className="text-center text-sm text-muted-foreground">{t("loadingText")}</p>
    </AuthLayout>
  );
}

/** Étape 1 du parcours de connexion : email → code. */
export default function LoginPage() {
  return (
    <React.Suspense fallback={<LoginFallback />}>
      <LoginBody />
    </React.Suspense>
  );
}