// Route catch-all Better Auth ADMIN — toutes les routes /api/auth/admin/*
// (sign-in/email, sign-up/email, sign-out, two-factor/*, request-password-reset…)
// sont servies par cette unique entrée.

import { adminAuthHandler } from "@/lib/auth/admin";

export const runtime = "nodejs";

export const { GET, POST } = adminAuthHandler;
