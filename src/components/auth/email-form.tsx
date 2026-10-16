"use client";

import * as React from "react";
import { Loader2, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { CtaArrow, RebootButton } from "@/components/reboot/shared";
import { Link, useRouter } from "@/i18n/routing";
import { authClient } from "@/lib/auth/client";
import { classifyAuthError, DEFAULT_NEXT, type AuthErrorKind } from "@/lib/auth-ui";
import { AuthError } from "./auth-error";
import { AuthStatus } from "./auth-status";

const EMAIL_FIELD_ID = "auth-email";
const EMAIL_ERROR_ID = "auth-email-error";
const EMAIL_HINT_ID = "auth-email-hint";

/** Même normalisation que le backend (`findUnique({ where: { email } })`). */
function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/** Forme d'email : stricte mais permissive, le serveur reste l'arbitre final. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Durée d'affichage de la confirmation neutre avant de passer à l'étape 2. */
const ACK_MS = 800;

/**
 * Étape 1 — l'email.
 *
 * Sécurité — pas d'énumération de comptes :
 * le serveur répond `{ success: true }` pour une adresse connue ET pour une
 * adresse inconnue (`sendVerificationOTP` retourne en silence quand
 * `db.member.findUnique` ne trouve rien — cf. src/lib/auth/index.ts). Le client
 * affiche donc TOUJOURS la même confirmation neutre et avance vers /verify-otp.
 * Deux exceptions, car elles décrivent la requête et non le compte :
 * le 429 et la panne réseau. Aucun texte du serveur n'est affiché : chaque
 * échec est mappé vers une chaîne i18n curatée.
 */
export function EmailForm({ next }: { next: string }) {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  function messageFor(kind: AuthErrorKind): string {
    switch (kind) {
      case "rateLimited":
        return t("errors.tooManyRequests");
      case "network":
        return t("errors.network");
      case "unavailable":
        return t("errors.unavailable");
      default:
        // Inclut `invalid` : l'adresse a été refusée par le serveur. Le message
        // reste celui d'une erreur serveur quelconque, pour ne rien laisser
        // deviner de l'état du compte.
        return t("errors.generic");
    }
  }

  /**
   * Confirmation neutre, puis passage à l'étape 2.
   *
   * L'attente courte n'est pas cosmétique : elle laisse la confirmation être
   * lue — et annoncée par `role="status"` — avant que l'écran ne change, ce
   * qui rend la transition entre les deux étapes lisible au lieu d'un saut.
   */
  async function acknowledge(trimmedEmail: string, destination: string) {
    setError(null);
    setFieldError(null);
    setStatus(t("sent"));
    const target = destination || DEFAULT_NEXT;
    await new Promise((resolve) => setTimeout(resolve, ACK_MS));
    router.push(
      `/verify-otp?email=${encodeURIComponent(trimmedEmail)}&next=${encodeURIComponent(target)}`,
    );
  }

  async function handleGoogle() {
    if (googleLoading || sending) return;
    setGoogleLoading(true);
    setError(null);
    try {
      // La page /auth/callback répartit ensuite : Member existant → next,
      // nouveau venu (User sans Member) → création du profil via /.
      await authClient.signIn.social({
        provider: "google",
        callbackURL: `/auth/callback?next=${encodeURIComponent(next || DEFAULT_NEXT)}`,
      });
    } catch {
      setError(t("googleFailed"));
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;

    setStatus(null);
    setError(null);

    // Validation côté client AVANT tout appel réseau : une adresse dont
    // l'erreur est évidente ne doit pas coûter un aller-retour serveur.
    const trimmed = normalize(email);
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setFieldError(t("errors.invalidEmail"));
      inputRef.current?.focus();
      return;
    }
    setFieldError(null);
    setSending(true);

    try {
      const { error: err } = await authClient.emailOtp.sendVerificationOtp({
        email: trimmed,
        type: "sign-in",
      });

      if (!err) {
        await acknowledge(trimmed, next);
        return;
      }

      const kind = classifyAuthError(err);
      // Les trois exceptions sont des pannes de la requête, pas des indices
      // sur le compte : les afficher ne révèle rien de l'existence du compte.
      // Tout le reste — y compris une éventuelle erreur pour une adresse
      // inconnue — retombe sur la confirmation neutre.
      if (kind === "rateLimited" || kind === "network" || kind === "unavailable") {
        setError(messageFor(kind));
        return;
      }
      await acknowledge(trimmed, next);
    } catch {
      setError(messageFor("network"));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <RebootButton
        type="button"
        size="lg"
        variant="outline"
        className="w-full"
        disabled={sending || googleLoading || status !== null}
        onClick={handleGoogle}
      >
        {googleLoading ? (
          <>
            <Loader2 className="size-4 animate-spin motion-reduce:hidden" aria-hidden="true" />
            <span>{t("loadingText")}</span>
          </>
        ) : (
          <>
            <GoogleIcon />
            <span>{t("googleCta")}</span>
          </>
        )}
      </RebootButton>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{t("orEmail")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div>
        <label
          htmlFor={EMAIL_FIELD_ID}
          className="mb-2 block text-[13.5px] font-medium text-foreground"
        >
          {t("emailLabel")}
        </label>

        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id={EMAIL_FIELD_ID}
            ref={inputRef}
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            autoFocus
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (fieldError) setFieldError(null);
              if (error) setError(null);
            }}
            disabled={sending || googleLoading || status !== null}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={
              [fieldError ? EMAIL_ERROR_ID : null, EMAIL_HINT_ID].filter(Boolean).join(" ")
            }
            className={[
              "h-12 w-full rounded-lg border bg-card pl-9 pr-3 text-[15px] text-foreground",
              "placeholder:text-muted-foreground",
              "transition-colors duration-150",
              "disabled:cursor-not-allowed disabled:opacity-60",
              fieldError ? "border-destructive/70" : "border-border hover:border-border",
              "focus:border-lime focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/45",
            ].join(" ")}
          />
        </div>

        {fieldError ? (
          <AuthError id={EMAIL_ERROR_ID} className="mt-2.5">
            {fieldError}
          </AuthError>
        ) : (
          <p
            id={EMAIL_HINT_ID}
            className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground"
          >
            {t("emailHint")}
          </p>
        )}
      </div>

      {error && <AuthError id="auth-login-error">{error}</AuthError>}

      {/* Pendant la confirmation neutre, le CTA laisse la place au message :
          pas de bouton clignotant sous un texte qui dit déjà « envoyé ». */}
      {status ? (
        <AuthStatus id="auth-login-status" tone="success">
          {status}
        </AuthStatus>
      ) : (
        <RebootButton
          type="submit"
          size="lg"
          className="group w-full"
          disabled={sending || googleLoading || !email.trim()}
        >
          {sending ? (
            <>
              {/* Le texte « Envoi en cours… » porte déjà l'information ; on
                  masque la rotation quand l'utilisateur a coupé les animations. */}
              <Loader2 className="size-4 animate-spin motion-reduce:hidden" aria-hidden="true" />
              <span>{t("sending")}</span>
            </>
          ) : (
            <>
              <span>{t("submit")}</span>
              <CtaArrow />
            </>
          )}
        </RebootButton>
      )}

      <p className="text-center text-[13px] leading-relaxed text-muted-foreground">
        {t("noAccountText")}{" "}
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-md text-foreground underline decoration-lime/60 underline-offset-4 transition-colors duration-150 hover:decoration-lime focus-lime"
        >
          {t("createProfileLink")}
        </Link>
      </p>
    </form>
  );
}

/** Logo "G" multicolore (paths officiels, affichage seul). */
function GoogleIcon() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.44 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  );
}