import { NextRequest } from "next/server";

/** Extract a client key from the request for rate-limit purposes. */
export function rateKey(req: NextRequest): string {
  // NextRequest.ip respects x-forwarded-for (first entry) and falls back to socket.remoteAddress.
  // This works correctly in production (behind proxy) AND in local dev (no proxy headers).
  const ip = (req as unknown as { ip?: string }).ip;
  if (ip) {
    return ip;
  }
  // Fallback for plain Request (should not happen in this app, but safe).
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
}