/** Extract a client key from the request for rate-limit purposes. */
export function rateKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
}