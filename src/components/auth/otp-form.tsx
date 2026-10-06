"use client";

import * as React from "react";
import { Loader2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { CtaArrow, RebootButton } from "@/components/reboot/shared";
import { useRouter } from "@/i18n/routing";
import { authClient } from "@/lib/auth/client";
import { classifyAuthError, type AuthErrorKind } from "@/lib/auth-ui";
import { AuthError } from "./auth-error";
import { AuthStatus } from "./auth-status";
import { OtpInput, OTP_LENGTH } from "./otp-input";

/** Ré-export : la page a besoin de la longueur pour nettoyer `?code=`. */
export { OTP_LENGTH };

/** 60 s : mêmes 60 s que le cooldown déjà présent, et que `info.resent` annonce. */
const RESEND_COOLDOWN_SEC = 60;

/** Confirmation de succès affichée avant la redirection vers `next`. */
const SUCCESS_MS = 650;

const CODE_LABEL_ID = "auth-otp-label";
const CODE_ERROR_ID = "auth-otp-error";
const CODE_HINT_ID = "auth-otp-hint";

function emptyDigits(): string[] {
  return Array<string>(OTP_LENGTH).fill("");
}

/**
 * Étape 2 — le code à 6 chiffres.
 *
 * Contrat de sécurité conservé à l'identique :
 * - `OTP_LENGTH = 6` (le backend génère bien 6 chiffres, cf.
 *   `tests/magic-link.test.cjs`) ;
 * - lien magique 1-clic : `?code=` pré-remplit et soumet une seule fois, puis
 *   l'URL est nettoyée via `history.replaceState` pour ne pas laisser le code
 *   dans l'historique du navigateur ;
 * - `next` repassé par le filtre anti open-redirect de `sanitizeNext` ;
 * - aucun texte du serveur n'est affiché : `err.message` n'est jamais repris
 *   tel quel, chaque échec est mappé sur une chaîne i18n curatée.
 */
export function OtpForm({
  email,
  next,
  linkCode = "",
}: {
  email: string;
  next: string;
  /** Code fourni par le lien magique 1-clic (`?code=`), déjà nettoyé. */
  linkCode?: string;
}) {
  const t = useTranslations("auth.verifyOtp");
  const router = useRouter();

  const [digits, setDigits] = React.useState<string[]>(emptyDigits);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(RESEND_COOLDOWN_SEC);
  const [resending, setResending] = React.useState(false);
  const firstInputRef = React.useRef<HTMLInputElement | null>(null);
  const autoSubmittedRef = React.useRef(false);

  // Le compte à rebours est honnête : le contrôle est réellement désactivé
  // pendant le décompte, et repart à 60 s après chaque renvoi effectif.
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // `messageFor` est encapsulé dans un useCallback pour que `submit` — lui-même
  // un useCallback, mémorisé dans `submitRef` — ne change pas d'identité quand
  // seul `t` change. Sans cela, le handler stocké dans le ref serait remplacé à
  // chaque frappe.
  const messageFor = React.useCallback((kind: AuthErrorKind): string => {
    switch (kind) {
      case "expired":
        return t("errors.codeExpired");
      case "tooManyAttempts":
        return t("errors.tooManyAttempts");
      case "rateLimited":
        return t("errors.tooManyRequests");
      case "network":
        return t("errors.network");
      case "unavailable":
        return t("errors.unavailable");
      case "invalid":
        // Le backend n'expose AUCUN compteur de tentatives restantes dans sa
        // réponse : on n'invente donc pas de « N essais restants ».
        return t("errors.codeInvalid");
      default:
        return t("errors.generic");
    }
  }, [t]);

  const clearCode = React.useCallback((focusFirst = true) => {
    setDigits(emptyDigits());
    if (focusFirst) {
      // `requestAnimationFrame` : le rerender doit avoir rendu les cases
      // vidées avant de déplacer le focus, sinon on refocuse l'ancienne.
      requestAnimationFrame(() => {
        firstInputRef.current?.focus();
      });
    }
  }, []);

  const submit = React.useCallback(
    async (code: string) => {
      if (code.length !== OTP_LENGTH || loading) return;
      setError(null);
      setInfo(null);
      setLoading(true);
      try {
        const { error: err } = await authClient.signIn.emailOtp({ email, otp: code });

        if (!err) {
          setSuccess(true);
          // Confirmation très brève puis redirection : l'utilisateur voit que
          // c'est passé, sans avoir à deviner si ça a fonctionné.
          setTimeout(() => {
            router.push(next);
            router.refresh();
          }, SUCCESS_MS);
          return;
        }

        setError(messageFor(classifyAuthError(err)));
        clearCode();
      } catch {
        setError(messageFor("network"));
      } finally {
        setLoading(false);
      }
    },
    [clearCode, email, loading, next, router, messageFor],
  );

  const submitRef = React.useRef(submit);
  React.useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  const handleComplete = React.useCallback((code: string) => {
    void submitRef.current(code);
  }, []);

  // Lien magique 1-clic : `?code=` pré-remplit et soumet une seule fois.
  React.useEffect(() => {
    if (autoSubmittedRef.current) return;
    if (linkCode.length !== OTP_LENGTH) return;
    autoSubmittedRef.current = true;
    setDigits(linkCode.split(""));
    setInfo(t("info.magicLink"));
    void submitRef.current(linkCode);

    // On retire `?code=` de l'historique : le code ne doit pas survivre dans
    // l'historique de navigation (ni sur l'écran d'accueil du mobile).
    try {
      const params = new URLSearchParams(window.location.search);
      params.delete("code");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    } catch {
      /* best-effort */
    }
  }, [linkCode, t]);

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      const { error: err } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (err) {
        // Même logique que l'étape 1 : sur un envoi refusé on ne dit rien du
        // compte, on décrit la requête.
        setError(messageFor(classifyAuthError(err)));
        return;
      }
      setInfo(t("info.resent"));
      setCooldown(RESEND_COOLDOWN_SEC);
      clearCode();
    } catch {
      setError(messageFor("network"));
    } finally {
      setResending(false);
    }
  }

  const canSubmit = digits.join("").length === OTP_LENGTH && !loading;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) void submit(digits.join(""));
      }}
      noValidate
      className="space-y-5"
    >
      <div>
        <p
          id={CODE_LABEL_ID}
          className="mb-2 block text-[13.5px] font-medium text-foreground"
        >
          {t("codeLabel")}
        </p>

        <OtpInput
          digits={digits}
          onDigitsChange={(nextDigits) => {
            setDigits(nextDigits);
            if (error) setError(null);
            if (info) setInfo(null);
          }}
          onComplete={handleComplete}
          disabled={loading || success}
          invalid={error !== null}
          labelId={CODE_LABEL_ID}
          describedBy={[error ? CODE_ERROR_ID : null, CODE_HINT_ID].filter(Boolean).join(" ")}
          autoFocus={!linkCode}
          firstInputRef={firstInputRef}
        />

        <p id={CODE_HINT_ID} className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
          {t("codeHint")}
        </p>
      </div>

      {error && (
        <AuthError id={CODE_ERROR_ID}>
          {error}
        </AuthError>
      )}

      {info && (
        <AuthStatus id="auth-otp-info" tone="info">
          {info}
        </AuthStatus>
      )}

      {success ? (
        <AuthStatus id="auth-otp-success" tone="success">
          {t("info.success")}
        </AuthStatus>
      ) : (
        <RebootButton
          type="submit"
          size="lg"
          className="group w-full"
          disabled={!canSubmit}
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:hidden" aria-hidden="true" />
              <span>{t("verifying")}</span>
            </>
          ) : (
            <>
              <span>{t("submit")}</span>
              <CtaArrow />
            </>
          )}
        </RebootButton>
      )}

      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground transition-colors duration-150 hover:text-foreground focus-lime disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resending ? (
            <Loader2 className="size-3.5 animate-spin motion-reduce:hidden" aria-hidden="true" />
          ) : (
            <Mail className="size-3.5" aria-hidden="true" />
          )}
          {cooldown > 0 ? t("resendCooldown", { resendCooldown: cooldown }) : t("resend")}
        </button>
        <p className="text-center text-[12.5px] leading-relaxed text-muted-foreground">
          {t("hint")}
        </p>
      </div>
    </form>
  );
}