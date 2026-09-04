/**
 * Admin roles system for fine-grained permissions.
 *
 * Tokens are issued by admin-auth.ts with the format:
 *   base64url(expiryEpochMs).base64url(signature).base64url(role)
 * where role is one of the values in `Role`.
 *
 * This module provides:
 *   - Role enum: viewer, operator
 *   - parseAdminRoleFromToken: decode role from a valid token
 *   - isAdminRole: any valid admin token
 *   - isOperatorRole: token grants operator privileges
 *
 * Parsing is defensive: a malformed, expired, or unsigned token yields null
 * (never throws) and is treated as "no access".
 */
import { verifyAdminToken, getAdminRoleFromToken } from "@/lib/admin-auth";

export enum Role {
  viewer = "viewer",
  operator = "operator",
}

/** Type guard: token is a valid admin token (any role). */
export function isAdminRole(token: string | null | undefined): token is string {
  if (!token) return false;
  return verifyAdminToken(token);
}

/** Type guard: token grants operator privileges. */
export function isOperatorRole(token: string | null | undefined): boolean {
  if (!token) return false;
  const role = readRole(token);
  return role === "operator";
}

/** Read the role claim from a token. Returns null if invalid/missing. */
export function parseAdminRoleFromToken(
  token: string | null | undefined,
): Role | null {
  if (!token) return null;
  const role = readRole(token);
  if (role === "viewer") return Role.viewer;
  if (role === "operator") return Role.operator;
  return null;
}