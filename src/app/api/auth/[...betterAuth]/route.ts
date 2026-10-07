import { auth } from "@/lib/auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { RateLimitError } from "@/lib/errors";

export const runtime = "nodejs";

export const { GET, POST } = {
  GET: async (req) => {
    // Rate limit for OTP sign-in requests (5 attempts per 10 minutes per IP)
    const rl = await rateLimit(`otp-signin:${rateKey(req)}`, {
      capacity: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.ok) {
      throw new RateLimitError(undefined, rl.retryAfterMs);
    }
    return auth.handler(req);
  },
  POST: async (req) => {
    // Rate limit for OTP sign-in requests (5 attempts per 10 minutes per IP)
    const rl = await rateLimit(`otp-signin:${rateKey(req)}`, {
      capacity: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.ok) {
      throw new RateLimitError(undefined, rl.retryAfterMs);
    }
    return auth.handler(req);
  },
};