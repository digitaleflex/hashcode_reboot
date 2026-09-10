import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { rateLimit, rateKey, retryAfterHeader } from "@/lib/rate-limit";
import { blockIfTesting } from "@/lib/test-guard";
import { generateOtp, hashOtp } from "@/lib/account-otp";
import { createPendingSession } from "@/lib/account-auth";
import { sendRejoinEmail } from "@/lib/mail";

export const runtime = "nodejs";

/** TTL du lien magique d'invitation (72 h). */
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
/** Pause entre 2 envois emails (Resend : 10 req/s max → 4/s = large marge). */
const SEND_DELAY_MS = 250;

const bodySchema = z.object({
  /** CSV brut (texte) — un email par ligne, virgules ou tabulations comme séparateur. */
  csvText: z.string().min(1, "Texte CSV requis."),
  /** Sans confirm=true : dry-run, aucun email envoyé. */
  confirm: z.boolean().optional().default(false),
});

/**
 * Parse une ligne CSV en gérant les champs entre guillemets.
 * Séparateur : virgule ou tabulation (auto-détecté).
 */
function parseCsvLine(line: string, sep: "," | "\t"): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // escape double quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep || ch === ";") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Détecte le séparateur dominant (virgule ou tabulation). */
function detectSeparator(firstLines: string[]): "," | "\t" {
  let commas = 0;
  let tabs = 0;
  for (const line of firstLines.slice(0, 5)) {
    commas += (line.match(/,/g) || []).length;
    tabs += (line.match(/\t/g) || []).length;
  }
  return tabs > commas ? "\t" : ",";
}

/** Mappe le level français vers le level interne. */
function mapLevel(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.includes("expert")) return "advanced";
  if (s.includes("avanc")) return "advanced";
  if (s.includes("inter")) return "practicing";
  if (s.includes("dbutant") || s.includes("dbutant")) return "beginner";
  return "beginner";
}

/** Mappe le pays vers un code pays ISO 2 lettres (best-effort). */
function mapCountry(raw: string): string {
  const s = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    "côte d'ivoire": "CI", "cote d'ivoire": "CI", "ivoire": "CI",
    "sénégal": "SN", "senegal": "SN",
    "bénin": "BJ", "benin": "BJ",
    "cameroun": "CM",
    "mali": "ML",
    "niger": "NE",
    "burkina faso": "BF", "burkina": "BF",
    "togo": "TG",
    "congo": "CG", "république du congo": "CG", "republique du congo": "CG",
    "rdc": "CD", "république démocratique du congo": "CD", "republique democratique du congo": "CD",
    "tunisie": "TN",
    "maroc": "MA",
    "algérie": "DZ", "algerie": "DZ",
    "gabon": "GA",
    "guinée": "GN", "guinee": "GN",
    "autres pays du monde": "",
    "": "",
  };
  return map[s] ?? "";
}

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

  if (!isAdminAuthed(req)) {
    return NextResponse.json(
      { error: "Non autorisé.", code: "UNAUTHORIZED" },
      { status: 401 },
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

  // ── Parse CSV ───────────────────────────────────────────────────────────
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return NextResponse.json(
      { error: "Aucune ligne trouvée.", code: "EMPTY_CSV" },
      { status: 422 },
    );
  }

  const sep = detectSeparator(lines.slice(0, 5));

  // Détecter l'en-tête (première ligne)
  const headerFields = parseCsvLine(lines[0], sep).map((h) => h.toLowerCase());
  const hasHeader = headerFields.some(
    (h) => h.includes("email") || h.includes("e-mail") || h.includes("adresse"),
  );

  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Trouver les indices des colonnes par en-tête
  let emailIdx = -1;
  let nameIdx = -1;
  let phoneIdx = -1;
  let countryIdx = -1;
  let levelIdx = -1;

  if (hasHeader) {
    const origHeaders = parseCsvLine(lines[0], sep);
    for (let i = 0; i < origHeaders.length; i++) {
      const h = origHeaders[i].toLowerCase();
      if (h.includes("email") || h.includes("e-mail") || h.includes("adresse")) emailIdx = i;
      if (h.includes("nom complet") || h.includes("nom ou pseudo") || h === "name") nameIdx = i;
      if (h.includes("whatsapp") || h.includes("téléphone") || h.includes("telephone") || h.includes("phone") || h.includes("tel")) phoneIdx = i;
      if (h.includes("pays") || h.includes("country")) countryIdx = i;
      if (h.includes("niveau") || h.includes("level")) levelIdx = i;
    }
  } else {
    // Fallback : assume email=0, name=2, phone=1, country=5, level=8
    emailIdx = 0;
    nameIdx = 2;
    phoneIdx = 1;
    countryIdx = 5;
    levelIdx = 8;
  }

  const errors: ImportError[] = [];
  const seen = new Set<string>();
  const validRows: InviteRow[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const fields = parseCsvLine(dataLines[i], sep);
    const email = (fields[emailIdx] ?? "").toLowerCase().trim();
    const rawName = (fields[nameIdx] ?? "").trim();
    const rawPhone = (fields[phoneIdx] ?? "").trim();
    const rawCountry = (fields[countryIdx] ?? "").trim();
    const rawLevel = (fields[levelIdx] ?? "").trim();

    if (!email || !email.includes("@")) {
      errors.push({ row: i + 2, field: "email", message: "Email invalide ou manquant." });
      continue;
    }

    if (seen.has(email)) continue;
    seen.add(email);

    // Extraire prénom du nom complet (premier mot)
    const firstName = rawName.split(/\s+/)[0] || email.split("@")[0];

    validRows.push({
      email,
      firstName,
      phone: rawPhone || null,
      country: mapCountry(rawCountry),
      level: mapLevel(rawLevel),
    });
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Erreurs de validation.", code: "VALIDATION_ERROR", errors, totalRows: dataLines.length },
      { status: 422 },
    );
  }

  if (validRows.length === 0) {
    return NextResponse.json(
      { error: "Aucun email valide trouvé.", code: "NO_VALID_ROWS" },
      { status: 422 },
    );
  }

  // ── Dry-run ─────────────────────────────────────────────────────────────
  if (!confirm) {
    // Vérifier quels emails existent déjà
    const existing = await db.member.findMany({
      where: { email: { in: validRows.map((r) => r.email) } },
      select: { email: true },
    });
    const existingSet = new Set(existing.map((e) => e.email));

    return NextResponse.json({
      dryRun: true,
      totalRows: dataLines.length,
      validRows: validRows.length,
      newMembers: validRows.filter((r) => !existingSet.has(r.email)).length,
      alreadyExist: validRows.filter((r) => existingSet.has(r.email)).length,
      sample: validRows.slice(0, 5),
    });
  }

  // ── Exécution ───────────────────────────────────────────────────────────
  const existing = await db.member.findMany({
    where: { email: { in: validRows.map((r) => r.email) } },
    select: { email: true },
  });
  const existingSet = new Set(existing.map((e) => e.email));

  const toCreate = validRows.filter((r) => !existingSet.has(r.email));
  const skipped = validRows.filter((r) => existingSet.has(r.email));

  let created = 0;
  let emailsSent = 0;
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
            accessLane: "immediate",
            country: row.country,
            availability: "5-10h",
            learningStyle: "practice",
            source: "admin-import",
          },
        });
        created++;

        // Générer magic link 1-clic
        const otp = generateOtp();
        const otpHash = await hashOtp(otp);
        await createPendingSession({
          memberId: member.id,
          otpHash,
          ttlMs: INVITE_TTL_MS,
          ip: null,
          userAgent: "admin-import-invite",
        });

        const url = `${base.replace(/\/$/, "")}/verify-otp?email=${encodeURIComponent(member.email)}&code=${encodeURIComponent(otp)}&next=${encodeURIComponent("/dashboard")}`;

        const res = await sendRejoinEmail({
          to: member.email,
          firstName: row.firstName,
          url,
        });

        if (res.ok) {
          emailsSent++;
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
  } catch (err) {
    console.error("Import-invite error:", err);
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }

  // Audit log
  try {
    await db.analyticsEvent.create({
      data: {
        type: "admin_import_invite",
        ref: `created=${created} sent=${emailsSent} failed=${failedEmails.length} skipped=${skipped.length}`,
        value: created,
      },
    });
  } catch {
    /* audit best-effort */
  }

  return NextResponse.json({
    ok: true,
    totalRows: dataLines.length,
    created,
    emailsSent,
    failed: failedEmails,
    skippedAlreadyExist: skipped.length,
    skippedEmails: skipped.map((r) => r.email),
  });
}
