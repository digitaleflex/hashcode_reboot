// Route catch-all Better Auth ADMIN — toutes les routes /api/admin-auth/*
// (sign-in/email, sign-up/email, sign-out, two-factor/*, request-password-reset…)
// sont servies par cette unique entrée.
//
// basePath distinct de `/api/auth` (membres) : deux catch-alls sous le même
// préfixe s'entre-shadowent en App Router (le membre répondait 404 à la place).

import { adminAuthHandler } from "@/lib/auth/admin";

export const runtime = "nodejs";

export const { GET, POST } = adminAuthHandler;
