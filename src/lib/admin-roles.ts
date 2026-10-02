/**
 * Admin roles (viewer | operator). Operator can do everything; viewer-level
 * access only. Role is now resolved from the Better Auth session via
 * ADMIN_OPERATORS / ADMIN_VIEWERS env lists (see src/lib/admin-auth.ts).
 *
 * Kept as a small shared type + type-guard for the remaining call sites.
 */
export enum Role {
  viewer = "viewer",
  operator = "operator",
}
