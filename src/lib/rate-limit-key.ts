import { NextRequest } from "next/server";

/** Extract a client key from the request for rate-limit purposes. */
export function rateKey(req: NextRequest): string {
  // Prefer x-real-ip (set by trusted proxies like Vercel, NGINX, etc.)
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  // Fallback to x-forwarded-for (first entry) if present
  const xff = req.headers.get("x-forwarded-for") ?? "";
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  // Last resort: anonymous (should not happen in production)
  return "anon";
}