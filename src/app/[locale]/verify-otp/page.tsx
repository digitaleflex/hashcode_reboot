"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthLayout } from "@/components/auth/auth-layout";
import { OtpForm, OTP_LENGTH } from "@/components/auth/otp-form";
import { Link, useRouter } from "@/i18n/routing";
import { maskEmail, sanitizeNext } from "@/lib/auth-ui";

export const dynamic = "force-dynamic";

function VerifyOtpBody() {
  const t = useTranslations("auth.verifyOtp");
  const router = useRouter();
  const searchParams = useSearchParams();

  const email = searchParams.get("email") ?? "";
  // Anti open-redirect : n'accepte que les chemins internes (pas d'URL
  // externe, pas de « // »). Même filtre que sur /login.
  const next = sanitizeNext(searchParams.get("next"));
  // Lien magique 1-clic : `?code=123456` pré-remplit et auto-soumet (même
  // session OTP). Nettoyé à `0-9` et tronqué à 6 caractères.
  const linkCode = (searchParams.get("code") ?? "").replace(/\D/g, "").slice(0, OTP_LENGTH);

  // Sans email, aucun code ne peut être vérifié : on renvoie à l'étape 1 en
  // conservant la destination demandée.
  React.useEffect(() => {
    if (!email) {
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [email, next, router]);

  const masked = React.useMemo(() => maskEmail(email), [email]);

  return (
    <AuthLayout
      step={2}
      title={t("title")}
      subtitle={t("subtitle")}
      backHref={`/login?next=${encodeURIComponent(next)}`}
      backLabel={t("backLinkLong")}
      aside={
        <p className="mt-3 flex items-center justify-center gap-2 text-[13.5px] text-muted-foreground">
          <span className="mono-label">{t("sentToLabel")}</span>
          {/* Adresse masquée : l'email reste en clair dans l'URL (le lien
              magique en dépend) mais ne doit pas être lisible par-dessus
              l'épaule pendant la saisie. */}
          <span className="font-mono text-foreground">{masked}</span>
        </p>
      }
    >
      {email ? (
        <OtpForm email={email} next={next} linkCode={linkCode} />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-center text-sm text-muted-foreground">{t("loadingText")}</p>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center rounded-md text-[13px] text-foreground underline decoration-lime/60 underline-offset-4 transition-colors duration-150 hover:decoration-lime focus-lime"
          >
            {t("backLinkLong")}
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}

/** Fallback de `<Suspense>` — même coquille que la page résolue. */
function VerifyOtpFallback() {
  const t = useTranslations("auth.verifyOtp");
  return (
    <AuthLayout step={2} title={t("title")} subtitle={t("loadingText")} backHref="/login">
      <p className="text-center text-sm text-muted-foreground">{t("loadingText")}</p>
    </AuthLayout>
  );
}

/** Étape 2 du parcours de connexion : le code à 6 chiffres. */
export default function VerifyOtpPage() {
  return (
    <React.Suspense fallback={<VerifyOtpFallback />}>
      <VerifyOtpBody />
    </React.Suspense>
  );
}