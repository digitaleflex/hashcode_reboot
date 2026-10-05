/**
 * Centralized application error classes for HASHCODE REBOOT.
 *
 * Every API route / server action should throw these instead of returning
 * ad-hoc `{ error, code }` JSON, and let {@link errorToResponse} convert
 * them into a consistent NextResponse.
 *
 * Usage:
 *   throw new ValidationError("Email invalide", { details: parsed.error.issues });
 *   return errorToResponse(err); // inside catch
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_PAYLOAD"
  | "INVALID_JSON"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "CONFLICT"
  // `LOCKED` et `PAYLOAD_TOO_LARGE` ne sont plus portés par aucune classe de ce
  // module, mais restent émis en JSON brut par body-limit.ts (413) et par la
  // route admin email-templates (403 « gabarit verrouillé »). On les garde donc
  // dans le vocabulaire du corps de réponse.
  | "LOCKED"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL";

export interface ErrorBody {
  error: string;
  code: ErrorCode | string;
  details?: unknown;
}

/** Base application error: carries an HTTP status, machine code and safe message. */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode | string;
  readonly details?: unknown;

  constructor(
    message: string,
    options: { status?: number; code?: ErrorCode | string; details?: unknown } = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.status = options.status ?? 500;
    this.code = options.code ?? "INTERNAL";
    this.details = options.details;
  }
}

/** 400 — body is not parseable JSON. */
export class InvalidJsonError extends AppError {
  constructor(message = "Corps de requête invalide.") {
    super(message, { status: 400, code: "INVALID_JSON" });
  }
}

/** 422 — payload failed schema validation. */
export class ValidationError extends AppError {
  constructor(message = "Données invalides.", details?: unknown) {
    super(message, { status: 422, code: "INVALID_PAYLOAD", details });
  }
}

/** 401 — no valid session / invalid credentials. */
export class AuthError extends AppError {
  constructor(message = "Authentification requise.", code: ErrorCode | string = "AUTH_REQUIRED") {
    super(message, { status: 401, code });
  }
}

/** 403 — authenticated but not allowed. */
export class ForbiddenError extends AppError {
  constructor(message = "Accès refusé.") {
    super(message, { status: 403, code: "FORBIDDEN" });
  }
}

/** 404. */
export class NotFoundError extends AppError {
  constructor(message = "Ressource introuvable.") {
    super(message, { status: 404, code: "NOT_FOUND" });
  }
}

/** 409 — uniqueness/state conflict. */
export class ConflictError extends AppError {
  constructor(message = "Conflit avec l'état actuel.") {
    super(message, { status: 409, code: "CONFLICT" });
  }
}

/** 429. */
export class RateLimitError extends AppError {
  readonly retryAfterMs?: number;
  constructor(message = "Trop de tentatives. Réessaie dans quelques minutes.", retryAfterMs?: number) {
    super(message, { status: 429, code: "RATE_LIMITED" });
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Convert any thrown value into a consistent NextResponse.
 * - AppError → its status/code/details
 * - ZodError → 422 with issues
 * - anything else → 500 (message hidden in production-safe way)
 */
export function errorToResponse(err: unknown): NextResponse<ErrorBody> {
  if (err instanceof AppError) {
    const headers: Record<string, string> = {};
    if (err instanceof RateLimitError && err.retryAfterMs) {
      headers["Retry-After"] = String(Math.ceil(err.retryAfterMs / 1000));
    }
    return NextResponse.json(
      { error: err.message, code: err.code, ...(err.details !== undefined ? { details: err.details } : {}) },
      { status: err.status, headers },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Données invalides.", code: "INVALID_PAYLOAD", details: err.issues },
      { status: 422 },
    );
  }
  console.error("[api] unhandled error:", err);
  return NextResponse.json({ error: "Erreur interne.", code: "INTERNAL" }, { status: 500 });
}

/** Convenience: parse a JSON body, throwing InvalidJsonError on failure. */
export async function parseJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new InvalidJsonError();
  }
}
