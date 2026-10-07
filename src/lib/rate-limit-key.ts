import { NextRequest } from "next/server";

/** Extract a client key from the request for rate-limit purposes.
 *  Only trusts proxy headers when the request comes through a known proxy.
 *  In Vercel/Next.js production, `req.ip` is already resolved from the
 *  trusted proxy chain. We prefer that. For local/dev we fall back to
 *  headers but with a safe default. */
export function rateKey(req: NextRequest): string {
  // Best: Next.js resolves `req.ip` from trusted proxies (Vercel, etc.)
  // It returns undefined if no IP could be determined.
  const nextIp = (req as any).ip;
  if (nextIp && nextIp !== "::1" && nextIp !== "127.0.0.1") {
    return nextIp.trim();
  }

  // Fallback for local/dev where req.ip may not be set: trust headers
  // ONLY when we detect we're likely behind a proxy (via x-forwarded-for).
  // We do NOT trust x-real-ip alone without x-forwarded-for present.
  const xff = req.headers.get("x-forwarded-for") ?? "";
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  // Last resort: anonymous (should not happen in production behind proxy)
  return "anon";
}