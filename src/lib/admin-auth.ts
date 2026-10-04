import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/** Check if the request origin matches the host (CSRF protection). */
export function checkCSRF(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

/** Admin email allow-lists (comma-separated env vars). */
function adminOperators(): string[] {
  return (process.env.ADMIN_OPERATORS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
function adminViewers(): string[] {
  return (process.env.ADMIN_VIEWERS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Every email allowed into the admin space, whatever its role.
 *
 * Single source of truth, shared by `resolveAdminSession` (authorization) and
 * `POST /api/admin/login` (gate) so the two can never disagree.
 *
 * Fail-closed by construction: an empty list means NOBODY is an admin. Never
 * reintroduce an `allowList.length === 0 -> allow everyone` shortcut — it turns
 * one missing env var into a full admin bypass.
 */
export function adminAllowList(): string[] {
  const legacy = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...adminOperators(), ...adminViewers(), ...legacy];
}

/** Resolve the current Better Auth session and the admin role for it, if admin. */
async function resolveAdminSession(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: Object.fromEntries(req.headers) as any });
    const email = session?.user?.email?.toLowerCase();
    if (!email) return null;
    if (adminOperators().includes(email)) return { email, role: "operator" as const };
    if (adminViewers().includes(email)) return { email, role: "viewer" as const };
    if (adminAllowList().includes(email)) return { email, role: "operator" as const };
    return null;
  } catch {
    return null;
  }
}

/** Check if the current request is from an authenticated admin (any role). */
export async function isAdminAuthed(req: NextRequest): Promise<boolean> {
  return (await resolveAdminSession(req)) !== null;
}

/** Get the admin role for this request, or null if not an admin. */
export async function getAdminRole(req: NextRequest): Promise<"viewer" | "operator" | null> {
  return (await resolveAdminSession(req))?.role ?? null;
}

/** Get the admin identity (email) for this request, or "unknown". */
export async function getAdminIdentity(req: NextRequest): Promise<string> {
  return (await resolveAdminSession(req))?.email ?? "unknown";
}

/**
 * Require admin authentication with a specific role.
 * operator can access everything; viewer only viewer-level resources.
 */
export async function requireAdminRole(
  req: NextRequest,
  allowedRole: "viewer" | "operator" = "operator",
): Promise<boolean> {
  const ctx = await resolveAdminSession(req);
  if (!ctx) return false;
  return ctx.role === "operator" || ctx.role === allowedRole;
}

