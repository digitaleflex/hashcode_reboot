import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminRole, checkCSRF, getAdminRole } from "@/lib/admin-auth";
import { audit } from "@/lib/admin-audit";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { sendRejoinEmail } from "@/lib/email/builders";
import { logMemberEmail, memberIdsWithEmailLog } from "@/lib/member-email-log";
import { planBatch } from "@/lib/email-budget";
import {
  CSV_MAX_BYTES,
  parseCsvRecords,
  parseCsvTable,
  pickField,
} from "@/lib/import/csv";
import { normalizeCountry, normalizeLevel } from "@/lib/import/normalize";

export const runtime = "nodejs";

/** TTL du lien magique d'invitation (72 h). */
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
/** Pause entre 2 envois emails (Resend : 10 req/s max → 4/s = large marge). */
const SEND_DELAY_MS = 250;
/**
 * Plafond du mode confirm (création + envois séquentiels avec
 * SEND_DELAY_MS entre chaque email : 200 lignes ≈ 50 s + écritures DB,
 * proche des timeouts proxy/serverless — au-delà, découper en plusieurs
 * imports). Le dry-run (sans envoi) n'est pas plafonné : il analyse tout.
 */
const MAX_CONFIRM_ROWS = 200;

const bodySchema = z.object({
  /** CSV brut (texte) — parsé via le wrapper PapaParse partagé (csv.ts). */
  csvText: z.string().min(1, "Texte CSV requis.").max(CSV_MAX_BYTES),
  /** Sans confirm=true : dry-run, aucun email envoyé. */
  confirm: z.boolean().optional().default(false),
});

/** Email validé via Zod (plus de includes("@") maison). */
const inviteEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email manquant.")
  .max(254, "Email trop long.")
  .email("Email invalide ou manquant.");

interface InviteRow {
  email: string;
  firstName: string;
  phone: string | null;
  country: string;
  level: string;
}

interface ImportError {
  row: number;
  field?: string;
  message: string;
}

/**
 * POST /api/admin/import-invite — import + invitation magic link.
 *
 * Accepte du CSV brut (copy-paste ou upload). Crée les membres en PENDING
 * et envoie un email avec lien magique 1-clic (72 h).
 *
 * - Admin uniquement.
 * - Dry-run par défaut : analyse le CSV sans rien faire.
 * - Envoi : { confirm: true } → crée les membres + envoie les emails.
 */
export async function POST(req: NextRequest) {
  const blocked = blockIfTesting();
  if (blocked) return blocked;

  // Import + envoi de masse : rôle `operator` exigé + CSRF.
  if (!(await requireAdminRole(req, "operator"))) {
    return NextResponse.json(
      { error: "Accès refusé. Rôle operator requis.", code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  if (!checkCSRF(req)) {
    return NextResponse.json(
      { error: "CSRF validation failed.", code: "CSRF_FAILED" },
      { status: 403 },
    );
  }

  const rl = await rateLimit(`import-invite:${rateKey(req)}`, {
    capacity: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessaie dans quelques minutes.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": retryAfterHeader(rl.retryAfterMs) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "JSON invalide.", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides.", code: "INVALID_PAYLOAD", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { csvText, confirm } = parsed.data;

  // ── Parse CSV (wrapper PapaParse partagé) ─────────────────────────
  // En-tête détecté par csv.ts (colonne "email") → mapping par alias ;
  // sinon fallback positionnel historique : email=0, name=2, phone=1,
  // country=5, level=8.
  let dataLines: number;
  let extracted: Array<{
    email: string;
    name: string;
    phone: string;
    country: string;
    level: string;
  }>;
  try {
    const { records, hasHeader } = parseCsvRecords(csvText);
    if (hasHeader) {
      dataLines = records.length;
      extracted = records.map((rec) => ({
        email: pickField(rec, ["email", "e-mail", "adresse"]),
        name: pickField(rec, ["nom complet", "nom ou pseudo", "name", "nom", "pseudo", "prénom", "prenom"]),
        phone: pickField(rec, ["whatsapp", "téléphone", "telephone", "phone", "tel"]),
        country: pickField(rec, ["pays", "country"]),
        level: pickField(rec, ["niveau", "level"]),
      }));
    } else {
      const { rows } = parseCsvTable(csvText);
      dataLines = rows.length;
      extracted = rows.map((cols) => ({
        email: cols[0] ?? "",
        name: cols[2] ?? "",
        phone: cols[1] ?? "",
        country: cols[5] ?? "",
        level: cols[8] ?? "",
      }));
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "CSV illisible.",
        code: "CSV_TOO_LARGE",
      },
      { status: 413 },
    );
  }

  if (dataLines === 0) {
    return NextResponse.json(
      { error: "Aucune ligne trouvée.", code: "EMPTY_CSV" },
      { status: 422 },
    );
  }

  const errors: ImportError[] = [];
  const seen = new Set<string>();
  const validRows: InviteRow[] = [];

  for (let i = 0; i < extracted.length; i++) {
    const raw = extracted[i];
    const emailParsed = inviteEmailSchema.safeParse(raw.email);
    if (!emailParsed.success) {
      errors.push({
        row: i + 2,
        field: "email",
        message: emailParsed.error.issues[0]?.message ?? "Email invalide ou manquant.",
      });
      continue;
    }
    const email = emailParsed.data;

    if (seen.has(email)) continue;
    seen.add(email);

    // Extraire prénom du nom complet (premier mot)
    const rawName = raw.name.trim();
    const firstName = rawName.split(/\s+/)[0] || email.split("@")[0];

    validRows.push({
      email,
      firstName,
      phone: raw.phone.trim() || null,
      country: normalizeCountry(raw.country),
      level: normalizeLevel(raw.level) ?? "beginner",
    });
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Erreurs de validation.", code: "VALIDATION_ERROR", errors, totalRows: dataLines },
      { status: 422 },
    );
  }

  if (validRows.length === 0) {
    return NextResponse.json(
      { error: "Aucun email valide trouvé.", code: "NO_VALID_ROWS" },
      { status: 422 },
    );
  }

  // Plafond confirm (timeouts — voir commentaire MAX_CONFIRM_ROWS).
  if (confirm && validRows.length > MAX_CONFIRM_ROWS) {
    return NextResponse.json(
      {
        error: `Maximum ${MAX_CONFIRM_ROWS} lignes par envoi confirmé (timeouts). Découpe le fichier.`,
        code: "TOO_MANY_ROWS",
        totalRows: dataLines,
        validRows: validRows.length,
      },
      { status: 400 },
    );
  }

  // ── Dry-run ─────────────────────────────────────────────────────────────
  if (!confirm) {
    // Vérifier quels emails existent déjà
    const existing = await db.member.findMany({
      where: { email: { in: validRows.map((r) => r.email) } },
      select: { id: true, email: true, invitationStatus: true },
    });
    const existingSet = new Set(existing.map((e) => e.email));
    // Existants INVITED jamais envoyés → ré-envoi possible (anti-doublon via log).
    const invitedExisting = existing.filter((e) => e.invitationStatus === "INVITED");
    const logged = await memberIdsWithEmailLog(
      invitedExisting.map((e) => e.id),
      "invite",
    );
    const resendable = invitedExisting.filter((e) => !logged.has(e.id)).length;

    return NextResponse.json({
      dryRun: true,
      totalRows: dataLines,
      validRows: validRows.length,
      newMembers: validRows.filter((r) => !existingSet.has(r.email)).length,
      alreadyExist: validRows.filter((r) => existingSet.has(r.email)).length,
      resendable,
      sample: validRows.slice(0, 5),
    });
  }

  // ── Exécution ───────────────────────────────────────────────────────────
  const existing = await db.member.findMany({
    where: { email: { in: validRows.map((r) => r.email) } },
    select: { id: true, email: true, firstName: true, invitationStatus: true },
  });
  const existingByEmail = new Map(existing.map((e) => [e.email, e]));

  const toCreate = validRows.filter((r) => !existingByEmail.has(r.email));
  const skipped = validRows.filter((r) => existingByEmail.has(r.email));

  let created = 0;
  let emailsSent = 0;
  let resent = 0;
  const failedEmails: string[] = [];

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_URL ||
    "https://reboot.joinhashcode.com";

  try {
    // Créer les membres un par un (pour générer le magic link individuellement)
    for (const row of toCreate) {
      try {
        const member = await db.member.create({
          data: {
            email: row.email,
            firstName: row.firstName,
            phone: row.phone,
            primaryDomain: "web",
            level: row.level,
            goal: "",
            mentoringInterest: null,
            budgetRange: null,
            profileStatus: "PENDING",
            communityStatus: "NOT_INVITED",
            invitationStatus: "INVITED",
            invitedAt: new Date(),
            accessLane: "pending",
            country: row.country,
            availability: "5-10h",
            learningStyle: "practice",
            source: "admin-import",
          },
        });
        created++;

        // Magic link : code envoyé par Better Auth, lien direct vers /verify-otp.
        const { requestSignInOtp } = await import("@/lib/auth");
        await requestSignInOtp(member.email);

        const url = `${base.replace(/\/$/, "")}/verify-otp?email=${encodeURIComponent(member.email)}&next=${encodeURIComponent("/dashboard")}`;

        const res = await sendRejoinEmail({
          to: member.email,
          firstName: row.firstName,
          url,
        });

        if (res.ok) {
          emailsSent++;
          await logMemberEmail({
            memberId: member.id,
            email: member.email,
            kind: "invite",
            provider: res.provider,
            providerId: res.id,
          });
          // Mettre à jour le statut d'invitation après envoi réussi
          await db.member.update({
            where: { id: member.id },
            data: {
              invitationStatus: "INVITED",
              invitedAt: new Date(),
            },
          });
        } else {
          failedEmails.push(row.email);
        }

        // Rate-limit Resend
        await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
      } catch {
        failedEmails.push(row.email);
      }
    }

    // Ré-envoi aux existants INVITED jamais envoyés (échec précédent).
    // Anti-doublon : on exclut ceux qui ont déjà un log "invite".
    const resendCandidates = skipped
      .map((r) => existingByEmail.get(r.email))
      .filter(
        (m): m is { id: string; email: string; firstName: string; invitationStatus: string } =>
          !!m && m.invitationStatus === "INVITED",
      );
    const resendLogged = await memberIdsWithEmailLog(
      resendCandidates.map((m) => m.id),
      "invite",
    );
    // Garde-fou : limiter les envois au budget restant.
    const plan = await planBatch({ category: "marketing", requested: resendCandidates.length });
    const toResend = resendCandidates.slice(0, plan.allowed);
    for (const member of toResend) {
      if (resendLogged.has(member.id)) continue;
      try {
        const { requestSignInOtp } = await import("@/lib/auth");
        await requestSignInOtp(member.email);
        const url = `${base.replace(/\/$/, "")}/verify-otp?email=${encodeURIComponent(member.email)}&next=${encodeURIComponent("/dashboard")}`;
        const res = await sendRejoinEmail({
          to: member.email,
          firstName: member.firstName || "toi",
          url,
          forceProvider: plan.provider,
        });
        if (res.ok) {
          resent++;
          await logMemberEmail({
            memberId: member.id,
            email: member.email,
            kind: "invite",
            provider: res.provider,
            providerId: res.id,
          });
          await db.member.update({
            where: { id: member.id },
            // Les existants pré-migration peuvent avoir un token null :
            // (ré)émettre un token single-use à chaque (ré)envoi réussi.
            // Pas de log "invite" existant ici (filtré plus haut) donc
            // aucun ancien lien valide n'est invalidé.
            data: {
              invitedAt: new Date(),
            },
          });
        } else {
          failedEmails.push(member.email);
        }
        await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
      } catch {
        failedEmails.push(member.email);
      }
    }
  } catch (err) {
    console.error("Import-invite error:", err);
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }

  // Audit log
  const role = (await getAdminRole(req)) ?? "operator";
  void audit(
    "member.import-invite",
    "member",
    undefined,
    {
      created,
      emailsSent,
      resent,
      failed: failedEmails.length,
      skipped: skipped.length,
    },
    { type: "admin", role },
  );
  try {
    await db.analyticsEvent.create({
      data: {
        type: "admin_import_invite",
        ref: `created=${created} sent=${emailsSent} resent=${resent} failed=${failedEmails.length} skipped=${skipped.length}`,
        value: created,
      },
    });
  } catch {
    /* audit best-effort */
  }

  return NextResponse.json({
    ok: true,
    totalRows: dataLines,
    created,
    emailsSent,
    resent,
    failed: failedEmails,
    skippedAlreadyExist: skipped.length,
    skippedEmails: skipped.map((r) => r.email),
  });
}
