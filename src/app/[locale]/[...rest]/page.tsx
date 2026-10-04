import { notFound } from "next/navigation";

/**
 * Attrape-tout sous `[locale]` (recommandation next-intl).
 *
 * Next ne rend `app/[locale]/not-found.tsx` que lorsqu'une route appelle
 * `notFound()`. Pour qu'une URL inconnue (`/ceci-nexiste-pas`) soit traitée
 * elle aussi par la 404 localisée — et donc rendue dans
 * `app/[locale]/layout.tsx`, seul layout porteur de `<html lang>` — il faut
 * une route qui matche le segment `[locale]` et déclenche `notFound()`.
 *
 * Les routes réelles restent prioritaires : un segment dynamique attrape-tout
 * est toujours évalué en dernier.
 */
export default function LocaleCatchAll(): never {
  notFound();
}
