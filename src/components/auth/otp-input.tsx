"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const OTP_LENGTH = 6;

/**
 * Saisie du code à 6 chiffres.
 *
 * Comportements mobiles et clavier, tous pris en charge ici :
 * - focus initial sur la première case ;
 * - saisie → avance automatique sur la case suivante ;
 * - Backspace sur une case vide → retour sur la case précédente (et efface) ;
 * - ArrowLeft / ArrowRight pour naviguer, y compris avec les flèches du clavier
 *   matériel (ligne du haut des claviers AZERTY/QWERTY) ;
 * - coller le code complet → répartition sur les six cases ;
 * - soumission automatique dès que le 6ᵉ chiffre est posé (fait dans le
 *   parent, via `onComplete`) ;
 * - `inputMode="numeric"` + `autoComplete="one-time-code"` : iOS et Android
 *   proposent alors la suggestion du code reçu par mail/SMS, ce qui évite
 *   complètement la saisie manuelle sur mobile.
 *
 * Accessibilité : chaque case porte un `aria-label` positionné
 * (« Chiffre 3 »), le groupe est étiqueté par `codeLabel`, et `aria-invalid`
 * + `aria-describedby` pointent vers le message d'erreur de l'étape.
 *
 * Pas de bouton « coller » : le collage natif fonctionne déjà (l'event `paste`
 * est intercepté et distribué) et sur mobile le clavier propose directement
 * le code — un bouton supplémentaire n'ajouterait que du bruit.
 */
export function OtpInput({
  digits,
  onDigitsChange,
  onComplete,
  disabled = false,
  invalid = false,
  labelId,
  describedBy,
  firstInputRef,
  autoFocus = true,
  className,
}: {
  digits: string[];
  onDigitsChange: (next: string[]) => void;
  /** Appelé dès que les 6 cases sont remplies. */
  onComplete: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** `id` du libellé visible du groupe (« Code à 6 chiffres »). */
  labelId: string;
  /** Ids à fusionner dans `aria-describedby` des six cases. */
  describedBy?: string;
  /** Permet au parent de rendre le focus à la première case après un reset. */
  firstInputRef?: React.RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
  className?: string;
}) {
  const t = useTranslations("auth.verifyOtp");
  const inputsRef = React.useRef<Array<HTMLInputElement | null>>([]);
  const submittedRef = React.useRef<string | null>(null);

  function focusAt(index: number) {
    const el = inputsRef.current[index];
    if (!el) return;
    el.focus();
    el.select();
  }

  /** Point d'entrée unique de toute mutation : gère l'auto-advance. */
  function writeAt(index: number, raw: string) {
    const values = raw.replace(/\D/g, "");
    const next = [...digits];

    if (!values) {
      next[index] = "";
      onDigitsChange(next);
      return;
    }

    // Coller / autofill multi-caractères depuis une seule case : on répartit.
    if (values.length > 1) {
      const start = index;
      for (let i = 0; i < values.length && start + i < OTP_LENGTH; i++) {
        next[start + i] = values[i];
      }
      const target = Math.min(start + values.length, OTP_LENGTH - 1);
      onDigitsChange(next);
      focusAt(target);
      return;
    }

    next[index] = values;
    onDigitsChange(next);
    if (index < OTP_LENGTH - 1) focusAt(index + 1);
  }

  function handleChange(index: number, raw: string) {
    writeAt(index, raw);
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "Backspace": {
        // Sur une case vide, on recule ET on efface la case précédente :
        // c'est le comportement attendu d'un code PIN.
        if (!digits[index] && index > 0) {
          event.preventDefault();
          const next = [...digits];
          next[index - 1] = "";
          onDigitsChange(next);
          focusAt(index - 1);
        }
        return;
      }
      case "Delete": {
        event.preventDefault();
        const next = [...digits];
        next[index] = "";
        onDigitsChange(next);
        return;
      }
      case "ArrowLeft":
        event.preventDefault();
        if (index > 0) focusAt(index - 1);
        return;
      case "ArrowRight":
        event.preventDefault();
        if (index < OTP_LENGTH - 1) focusAt(index + 1);
        return;
      case "Home":
        event.preventDefault();
        focusAt(0);
        return;
      case "End":
        event.preventDefault();
        focusAt(OTP_LENGTH - 1);
        return;
      default:
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array<string>(OTP_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    onDigitsChange(next);
    focusAt(Math.min(pasted.length, OTP_LENGTH - 1));
  }

  // Auto-soumission : dès qu'un code complet apparaît, une seule fois par
  // code. `submittedRef` se remet à zéro dès que le code est incomplet, donc
  // ressaisir exactement le même chiffre après une erreur soumet à nouveau.
  const completed = digits.join("");

  React.useEffect(() => {
    if (completed.length !== OTP_LENGTH) {
      submittedRef.current = null;
      return;
    }
    if (submittedRef.current === completed) return;
    submittedRef.current = completed;
    onComplete(completed);
  }, [completed, onComplete]);

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn("grid grid-cols-6 gap-1 sm:gap-2", className)}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
            if (index === 0 && firstInputRef) firstInputRef.current = el;
          }}
          type="text"
          inputMode="numeric"
          // iOS/Android : propose le code reçu par email dans le clavier.
          autoComplete={index === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={OTP_LENGTH}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.currentTarget.select()}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={t("digitAriaLabel", { index: index + 1 })}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={[
            "h-14 w-full rounded-lg border bg-card text-center font-mono text-xl font-semibold",
            "text-foreground caret-lime transition-colors duration-150",
            "disabled:cursor-not-allowed disabled:opacity-60",
            invalid ? "border-destructive/70" : "border-border",
            "focus:border-lime focus:outline-none focus-visible:ring-2 focus-visible:ring-lime/45",
          ].join(" ")}
        />
      ))}
    </div>
  );
}