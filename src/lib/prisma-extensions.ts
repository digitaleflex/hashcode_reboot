/**
 * Prisma extensions and error handling for HASHCODE REBOOT.
 *
 * Provides:
 * - Connection/timeout error handling with retry logic
 * - Structured error serialization for logging
 * - Standardized error responses for API routes
 * 
 * Note: Middleware-based soft-delete filter is handled at query level
 * via the `where: { deletedAt: null }` pattern in repositories.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { createClientLogger } from "@/lib/logging-client";

const logger = createClientLogger({ component: "Prisma" });

/** Prisma error codes that indicate transient/connection issues. */
const TRANSIENT_ERROR_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database server timeout
  "P1008", // Connection pool timeout
  "P1017", // Server closed connection
  "P2024", // Connection pool exhausted
  "P2025", // Record not found (can be transient in race conditions)
]);

/** Prisma error codes that indicate constraint violations. */
const CONSTRAINT_ERROR_CODES = new Set([
  "P2002", // Unique constraint violation
  "P2003", // Foreign key constraint violation
  "P2014", // Required relation violation
]);

/** Retry configuration for transient errors. */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 2000,
};

/** Check if a Prisma error is transient (retryable). */
export function isTransientPrismaError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_ERROR_CODES.has(error.code);
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return true;
  }
  return false;
}

/** Check if a Prisma error is a constraint violation. */
export function isConstraintPrismaError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return CONSTRAINT_ERROR_CODES.has(error.code);
  }
  return false;
}

/** Serialize Prisma error for logging (removes circular refs, preserves useful info). */
export function serializePrismaError(error: unknown): Record<string, unknown> {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      name: "PrismaClientKnownRequestError",
      code: error.code,
      message: error.message,
      meta: error.meta,
      clientVersion: error.clientVersion,
    };
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return {
      name: "PrismaClientUnknownRequestError",
      message: error.message,
    };
  }
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return {
      name: "PrismaClientRustPanicError",
      message: error.message,
    };
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      name: "PrismaClientInitializationError",
      message: error.message,
      errorCode: error.errorCode,
    };
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      name: "PrismaClientValidationError",
      message: error.message,
    };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}

/**
 * Execute a Prisma operation with automatic retry on transient errors.
 * Uses exponential backoff with jitter.
 */
export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs } = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) break;

      if (!isTransientPrismaError(error)) {
        // Non-transient error, don't retry
        throw error;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 100,
        maxDelayMs
      );

      logger.warn("Prisma transient error, retrying", {
        attempt: attempt + 1,
        maxRetries,
        delayMs: Math.round(delay),
        error: serializePrismaError(error),
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Middleware wrapper for API routes to handle Prisma errors consistently.
 * Returns standardized error responses.
 */
export function handlePrismaError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const target = error.meta?.target as string[] | undefined;
        return {
          status: 409,
          code: "CONFLICT",
          message: target
            ? `Un enregistrement avec ce ${target.join(", ")} existe déjà.`
            : "Conflit : cet enregistrement existe déjà.",
        };
      }
      case "P2003":
        return {
          status: 400,
          code: "INVALID_REFERENCE",
          message: "Référence invalide : l'élément lié n'existe pas.",
        };
      case "P2025":
        return {
          status: 404,
          code: "NOT_FOUND",
          message: "Enregistrement introuvable.",
        };
      case "P1001":
      case "P1002":
      case "P1008":
      case "P1017":
        return {
          status: 503,
          code: "DATABASE_UNAVAILABLE",
          message: "Service temporairement indisponible. Réessaie dans un instant.",
        };
      default:
        logger.error("Unhandled Prisma known error", { error: serializePrismaError(error) });
        return {
          status: 500,
          code: "DATABASE_ERROR",
          message: "Erreur de base de données.",
        };
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      code: "DATABASE_CONNECTION_FAILED",
      message: "Impossible de se connecter à la base de données.",
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Données invalides pour la base de données.",
    };
  }

  logger.error("Unexpected Prisma error", { error: serializePrismaError(error) });
  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Erreur interne.",
  };
}

/** Helper to add soft-delete filter to where clauses. */
export function withSoftDelete<T extends Record<string, unknown>>(where: T): T & { deletedAt: null } {
  return { ...where, deletedAt: null };
}