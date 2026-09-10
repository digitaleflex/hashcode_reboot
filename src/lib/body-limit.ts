import { NextRequest, NextResponse } from "next/server";

/**
 * body-limit.ts — Validate request body size before parsing.
 *
 * Usage in a route handler:
 *   import { bodyLimit } from "@/lib/body-limit";
 *   const tooLarge = bodyLimit(req, 102_400); // 100 KB
 *   if (tooLarge) return tooLarge;
 *
 * Default limit: 100 KB (sufficient for all our JSON payloads).
 * Max safe limit: 1 MB (Vercel Edge limit).
 */

const DEFAULT_MAX_BYTES = 100 * 1024; // 100 KB

export function bodyLimit(
  req: NextRequest,
  maxBytes: number = DEFAULT_MAX_BYTES,
): NextResponse | null {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return NextResponse.json(
      {
        error: `Payload trop volumineux (${Math.round(maxBytes / 1024)} KB max).`,
        code: "PAYLOAD_TOO_LARGE",
      },
      { status: 413 },
    );
  }
  return null;
}
