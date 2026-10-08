/**
 * HASHCODE REBOOT — schéma Zod partagé pour les lignes d'import CSV.
 *
 * Utilisé par POST /api/members/import (csvText OU rows).
 * Messages FR (le Dialog client affiche `message` tel quel ; les clés
 * i18n admin.import.validationErrors.* sont documentées côté Dialog et
 * NON créées ici — cf. messages/fr.json, hors périmètre de ce lane).
 */

import { z } from "zod";
import {
  normalizeAccessLane,
  normalizeCountry,
  normalizeDomain,
  normalizeLevel,
} from "./normalize";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email requis.")
  .max(254, "Email trop long (max 254 caractères).")
  .email("Email invalide.");

export const importRowSchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    emailSchema,
  ),
  name: z.preprocess(
    (v) => (typeof v === "string" ? v : ""),
    z
      .string()
      .trim()
      .min(1, "Nom requis.")
      .max(120, "Nom trop long (max 120 caractères)."),
  ),
  level: z.preprocess(
    (v) => {
      if (typeof v !== "string" || v.trim() === "") return undefined;
      return normalizeLevel(v) ?? v.trim().toLowerCase();
    },
    z
      .enum(["beginner", "practicing", "autonomous", "advanced"], {
        error: "Niveau invalide (beginner, practicing, autonomous, advanced).",
      })
      .optional(),
  ),
  domain: z.preprocess(
    (v) => {
      if (typeof v !== "string" || v.trim() === "") return undefined;
      return normalizeDomain(v) ?? v.trim().toLowerCase();
    },
    z
      .enum(["web", "cybersecurity", "ai"], {
        error: "Domaine invalide (web, cybersecurity, ai).",
      })
      .optional(),
  ),
  country: z.preprocess(
    (v) => {
      if (typeof v !== "string" || v.trim() === "") return undefined;
      const code = normalizeCountry(v);
      // Best-effort : pays inconnu → chaîne vide (jamais bloquant).
      return code === "" ? "" : code;
    },
    z
      .string()
      .max(2, "Pays invalide (code ISO 2 lettres).")
      .optional(),
  ),
  accessLane: z.preprocess(
    (v) => {
      if (v === undefined || v === null) return undefined;
      if (typeof v === "string" && v.trim() === "") return undefined;
      return normalizeAccessLane(v) ?? v;
    },
    z
      .enum(["immediate", "pending"], {
        error: "Voie d'accès invalide (immediate, pending).",
      })
      .optional(),
  ),
});

export type ImportRow = z.infer<typeof importRowSchema>;

/** Erreur de validation renvoyée au client (contrat {created,updated,skipped,errors}). */
export interface ImportError {
  row: number;
  field?: string;
  message: string;
}
