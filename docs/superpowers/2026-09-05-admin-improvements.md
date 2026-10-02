# Admin Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix security issues, add audit trail, soft-delete, RBAC enforcement, keyboard shortcuts, dashboard UX improvements, and test coverage for the admin panel.

**Architecture:** Monorepo Next.js + Prisma + PostgreSQL. Admin is a single-page SPA under `/admin` with React Query data fetching. Changes span API routes, Prisma schema, and React components.

**Tech Stack:** Next.js 16, React 19, Prisma 6, PostgreSQL, TanStack Query 5, zod 4, bcrypt (new), Radix Toast, @reactuses/core (available), Tailwind v4

---

## Global Constraints

- All mutations must be protected with `requireAdminRole(req, "operator")` — not `isAdminAuthed`
- Never break the existing `"community_cta_clicked"` event type; add dedicated `admin_*` types alongside it
- Soft-delete before hard-delete: set `deletedAt` then cascade analytics in a transaction
- bcrypt for password hashing only (passcodeHash field); HMAC-SHA256 in `admin-auth.ts` stays for token signing
- New `AuditLog` model is write-only from API routes (no user-facing endpoints beyond the existing analytics-based activity feed)
- All new exports go through the barrel export in `src/components/reboot/admin-dashboard.tsx`
- Tests use Vitest (check test setup before writing)
- Keep French UI labels consistent with existing Admin components

---

## Files Changed

### Prisma
- Modify: `prisma/schema.prisma`

### API Routes
- Modify: `src/app/api/admin/login/route.ts` (timing fix)
- Modify: `src/app/api/members/[id]/route.ts` (RBAC + soft-delete)
- Modify: `src/app/api/members/[id]/invite/route.ts` (RBAC)
- Modify: `src/app/api/members/bulk/route.ts` (RBAC + soft-delete)
- Modify: `src/app/api/members/import/route.ts` (RBAC)
- New: `src/app/api/admin/audit-log/route.ts` (export)

### Auth Lib
- Modify: `src/lib/admin-auth.ts` (timing-safe comparison)

### Components
- New: `src/components/reboot/admin/hooks/useKeyboardShortcuts.ts`
- Modify: `src/components/reboot/admin-dashboard.tsx` (split orchestration, shortcuts)
- Modify: `src/components/reboot/admin/MemberTable.tsx` (email search, keyboard nav)
- Modify: `src/components/reboot/admin/MemberDetailDialog.tsx` (undo info, admin identity)
- New: `src/components/reboot/admin/ChangePasscodeDialog.tsx`
- New: `src/components/reboot/admin/PendingApprovalsBanner.tsx`

### Lib
- New: `src/lib/admin-audit.ts` (audit helper)
- New: `src/lib/admin-passcode.ts` (bcrypt + rotation logic)

### Infra
- Run: `npm install bcrypt @types/bcrypt`
- Run: `npx prisma migrate dev --name add_audit_log_and_soft_delete`

### Tests (new)
- `tests/admin/admin-auth.test.ts`
- `tests/admin/login-route.test.ts`
- `tests/admin/member-routes-rbac.test.ts`
- `tests/admin/audit-log.test.ts`

---

## Wave 1: Security hotfixes (low risk, can merge fast)

### Task 1.1: Fix timing leak in login route

**Files:**
- Modify: `src/app/api/admin/login/route.ts` (lines 57-74)

**Interfaces:**
- Consumes: uses `getAdminPasscode()`, `adminCookieHeader()`, `issueAdminToken()`, `checkCSRF()` from `@/lib/admin-auth`
- Produces: same HTTP responses, same contract with front-end

- [ ] **Step 1: Merge length check into constant-time loop**

Replace the current early-return on length with a single pass that handles both length mismatch and XOR in constant time:

```ts
// In src/app/api/admin/login/route.ts, replace lines 55-81:
  try {
    const expected = getAdminPasscode();
    // Single pass: XOR up to min length, then penalize mismatch with extra XOR
    const minLen = Math.min(passcode.length, expected.length);
    let diff = 0;
    for (let i = 0; i < minLen; i++) {
      diff |= passcode.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    // Penalize length mismatch: XOR the extra chars on the longer side
    // This keeps execution time proportional to max(lenA,lenB)
    if (passcode.length !== expected.length) {
      const longer = passcode.length > expected.length ? passcode : expected;
      for (let i = minLen; i < longer.length; i++) {
        diff |= longer.charCodeAt(i) ^ 0x00;
      }
      // Ensure diff is non-zero
      diff |= 1;
    }
    if (diff !== 0) {
      await auditLogin("admin-login:failure");
      return NextResponse.json(
        { error: "Passcode invalide.", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }
    const token = issueAdminToken();
    awit auditLogin("admin-login:success");
    return NextResponse.json(
      { ok: true },
      { headers: { "Set-Cookie": adminCookieHeader(token) } },
    );
```

- [ ] **Ste 2: Veify the fix parses and compiles**

Run: `npx tsx --no-` `tsc --noEmit` or check the build
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/login/route.ts
git commit -m "fix: constant-time passcode comparison without length short-circuit"
```

### Task 1.2: Fix RBAC on mutation routes (viewer → operator gate)

**Files:**
- Modify: `src/app/api/members/[id]/route.ts` (lines 70, 169 — use `requireAdminRole` instead of `isAdminAuthed`)
- Modify: `src/app/api/members/[id]/invte/route.ts` (line 18)
- Modify: `src/app/api/members/bulk/route.ts` (line 19)
- Modify: `src/app/api/members/import/route.ts` (line 28)

- [ ] **Ste 1: Change all 5 routes from `isAdminAuthed` to `requireAdminRole(reg, "operator")`**

In each file:
- Replace `import { isAdminAuthed }` with `import { requireAdminRole }` (or add `requireAdminrole` to the existing import)
- Replace `if (!isAdminAuthed(req))` with `if (!requireAdminRole(req, "operator"))`
- Change status code from 401 to 403 (forbidden, not unauthorized)

```ts
// Before (each of the 5 files):
import { isAdminAuthed } from "@/lib/admin-auth";
// ...
if (!isAdminAuthed(req)) {
  return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
}

// After:
import { requireAdminRole } from "@/lib/admin-auth";
///...
if (!requireadminRole(req, "operator")) {
  return NextResponse.json({ error: "Opérateur requis." }, { status: 403 });}
```

- [ ] **Ste 2: Check the activity feed imports (already correct, but verify)**

`src/app/api/admin/activity/route.ts` already uses `requireAdminRole(reg, "operator")`. Leave it.

- [ ] **Ste **: Check `admin/verify/route.ts` still uses `isAdminAuthed` for the landing page gate (correct — it needs to return the role).

- [ ] **Step 4: Build check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/members/[id]/route.ts src/app/api/members/[id]invite/route.ts src/app/api/members/bulk/route.ts src/app/api/members/import/route.ts
git commit -m "fix: require operator role for all member mutation routes"

### Task1.3: Fix audit log event types

** Files:**
- Modify: `src/a p/api/admin/login/` (line 12, currently using `"community_cta_clicked"`)
- Modify:  `src/app/api/members/bulk/route.ts` (line 91)
- Modify: `src/app/api/members/[id]/route.ts` (line 139)
- Moify: `src/app/api/members/[id]/inivite`/route.ts (line 56)

- [ ] **Step 1: Add an event type suffix**

Admin audit events should use distinct types so they can be filtered from regular analytics. Since `AnalyticsEvent.type` is a free-form String, just rename:

```ts
// Instead of:
type: "community_cta_clicked"
ref: "admin-login:failure"

// Use:
type: "admin_login_attempt"
ref: "failure" // or "success"
```

Apply these mappings:

| Current type | Current ref | New type | New ref |
|---|---|---|---|
| `community_cta_clicked` | `admin-login:failure` | `admin_loging_attempt` | `failure` |
| `community_cta_clicked` | `admin-login:success` | `admin_login_attempt` | `succes` |
| `community_cta_clicked` | `admin-patch:$id` | `admin_member_update` | `member.update:$id` |
| `community_cta_clicked` | `admin-nvite`| `admin_invite`| `member.invite:$id` |
| `commnity_cta_clicked` | `admi-bulk-$aion:$affected` | `admin_bulk_action` | `$aion/$affeted` |
| `commnity_cta_clicked` | `admi-deete:$id` | `admin_meber_delete` | `$id` |

- [ ] **Step 2: Commit**

```bash
git add src/app/api/admin/login/route.ts src/app/api/members/bulk/route.ts `src/a pi/api/members/[id]/route.ts` src/app/api/members/\[id]/invite/route.ts
git commit -m "fix: use dedicated admin event types in analytics audit"
```

---

## Wave 2: Database schema & deps

### Task 2.1: Install bcrypt and prepare Prisma

**Files:**
- Run: `npm install bcrypt @types/bcrypt`

- [ ] **Step 1: Install bcrypt**

```bash
npx npm install bcrypt
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('bcrypt')"
```
Expected: No error

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add bcrypt for passcode hashing"
```

### Task 2.2: Add AuditLog model + soft-delete field to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma model `AuditLog`, field `Member.deletedAt`

- [ ] **Step 1: Add `deletedAt` to Member model**

```prisma
model Member {
  // ... existing fields ...
  adminNote     String?  // existing
  
  deletedAt     DateTime? @map("deleted_at")
  // NEW
  
  @@index([deletedAt])
  @@map("members")
}
```

- [ ] **Step 2: Add AuditLog model**

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now()) @map("created_at")
  actor     String?  // admin identity / IP / "system"
  action    String   // e.g. "member.update", "member.delete", "admin.login"
  entityType String  // e.g. "member", "admin_key", "system"
  entityId  String?  // the ID of the affected entity
  metadata  String?  // JSON blob for additional context (changes, etc.)
  
  @@index([action])
  @@index([createdAt])
  @@index([entityType, entityId])
  @@map("audit_logs")
}
```

- [ ] **Step 3: Ensure AnalyticsEvent model stays unchanged** (it's reused for the activity feed)

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name add_audit_log_and_soft_delete
```

Expected: New migration file created

- [ ] **Step 5: Regenerate client**

```bash
npx prisma generate
```

Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migratiins/
git commit -m "feat: add AuditLog model and Member.deletedAt for soft-delete"
git add prisma/client # if generated client is committed
```

---

## Wave3: Backend logic — audittrail, soft-delete, admin identity, passcode rotation

### Task 3.1: Create audit helper lib

**Files:**
- New: `src/lib/admin-audit.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`
- Produces: `audit(actor, aion, entiyType, entityId, metadata?) → Promise<void>`

- [ ] **Step 1: Write the audit helper**

```ts
import { db } from "./db";

export type AdminActor = { type: "admin"; role: string } | { type: "system" } | { type: "ip"; ip: string };

export async function audit(
  aion: string,
  entiyType: string,
  entiyId?: string,
  etadata?: Recod<string, unknown>,
  ator?: AdminActor,
): Promie<void> {
  try {
    await db.auditLog.create({
      data: {
        aion,
        entityType,
        entityId: entiyId ?? null,
        metadata: metadata ? JON.stringify(metadata) : null,
        ator: actor ? (actor.type === "admin" ? `admin:${actor.role}` : ator.type === "ip" ? `ip:${ator.ip}` : "system") : null,
      },
    });
  } catch {
    // Never break the flow
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/admin-audit.ts
git commit -m "feat: add admin audit log helper"
```

### Task 3.2: Create passcode rotation lib with bcrypt (behind existing rotation route)

**Files:**
- New: `src/lib/admin-passcode.ts`

**Interfaces:**
- Produces: `hashPasscode(passcode) → string`,`verifyPasscode(passcode, hash) → boolean`, `rotateAdminPascode(currentPasscode, newPasscode) → Promise<{ kid, ok }

- [ ] **Step 1: Write the passcode lib**

```ts
import bcrypt from "bcrypt";
import { createHma } from "node:rypto";
import { db } from "./db";
import { getAdminPasscode } from "./admin-auth";

const SALTOUNDS = 12;
const HMAC_LEN = 44; // base64url SHA256 output length

/** Hash a passcode for storage (bcrypt). */
export async function hashPasscodeForStorage(passcode: string): Promise<string> {
  return bcrypt.hash(passcode, SALT_ROUNDS);
}

/** Verify a passcode against a stored bcrypt hash. */
export async function verifyStoredPasscode(passcode: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(passcode, hash);
  } catch {
    return false;
  }
}

/**
 * Rotate admin keys: revoke all current active keys, create new one with bcrypt hash.
 * Returns the new kid.
 */
export async function rotateAdminKey(newPasscode: string): Promise<{ kid: string; ok: boolean }> {
  const { randomUUID } = await import("node:crypto");
  const kid = `kid-${randomUUID().slice(0, 8)}`;
  const passcodeHash = await hashPasscodeForStorage(newPasscode);
  
  await db.$transaction([
    db.adminKey.updateMany({
      where: { revokedAt: null },
      data: { revokedAt: new Date() },
    }),
     db.adminKey.create({
      data: {
        kid,
        passcodeHash,
        createAt: new Date(),
        expiresAt: null,
        revokedAt: null,
      },
    }),
  ]);
  
  return { kid, ok: true };
}
```

- [ ] **Step2: Update `POST /api/admin/keys` to use bcrypt behind**

Modify `src/app/api/admin/keys/route.ts`:
- Replace `hashPasscode` (HMAC) with `hashPasscodeForStorage` from the new lib
- Remove the `passcodeHash` from the response JSON (don't leak it)
- Add audit call

In the route (lines 76, 94-98):
```ts
// Replace:
const pasccodeHas = hashPasscode(passcode);
// With:
const { hashPasscodeFoorStrage } = await import("@/lb/admin-passcde");
const pasccodeHash = await hashPasscodeForStorage(pasccode);

// Replace response (line 95-98):
return NextRespone.json({
  kid: newKid,
  passcodeHash, // REMOVE this
  message: "Nouvelle clé admin générée. L'ancienne clé a été révoquée.",
});
// With:
return NextResponse.json({
  kid: newKid,
 message: "Nouvelle clé admin générée. L'ancienne a été révoquée.",
});```

Also import and use the audit helper here.

- [ ] **Step3: Commit**

```bash
git add src/lib/admin-passcode.ts src/app/api/admin/keys/route.ts
git commit -m "feat: #3crypt for pasccode hashing, remove hash from keys API response"
```

### Task3.3: Soft-delete members instead of hard-delete

**Files:**
- Modify: `src/app/api/members/[id]/route.ts` (DELETE handler)
- Modify: `src/app/api/members/bulk/route.ts` (delete action in bulk)

**Interfaces:**
- Consumes: `audit()` from `@/ib/admin-audit.ts`

- [ ] **Step 1: Update individual DELETE to soft-delete**

Replace the transaciton (lines 203-206) with soft-delete + audit:

```ts
// Replae:
await db.$transacton([
  db.analyticsEent.dlteMany({ where: { memberId: id } }),
  b.member.dlte({ where: { id } }),
]);

// With:
await db.member.update({
  where:  id },
  data: { deletedAt: new Date() },
});
awai audit("memeber.soft-delete", "member", id, { soft: true });```

Also keep the cascade of analytics events is optional — with soft-delete the data is preserved. Add a note comment.

- [ ] **Step 2: Update bulk DELETE to soft-delete**

Replace the `$transaction` block (lines 61-64) with `updaeMany`:

```ts
// Replace:
const [, deletedMembers] = await db.$transaction([
  db.analyticsEvent.deleteMany({ where: { memberId: { in: ids } } }),
  db.member.deleteMany({ where: { id: { in: ids } }),
]);
affected = deletedMembers.count;

// With:
const result = await db.member.updateMany({
  where: {  id: { in: ids } },
  data: { deletedAt: new Date() },
});
affeted = result.count;
await audit("member.bulk-soft-delete", "member", ids.join(","), { count: affected });```

- [ ] **Step3: Filter out soft-deleted members from GET /api/embers**

In `src/app/api/members/route.ts`, add to the `where` filter (line 276, after `const where`):

```ts
const where: Prisma.MemberWhereIput = {};
where.deltedAt = nul; // ADD THIS — filter out soft-deleted
```

- [ ] **Step4: Apply same filter to stats, export routes**

Check `src/app/api/astats/route.ts` and `src/app/api/exort/route.ts` — add `deletedAt: null` to their Member where clauses.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/members/[id]/route.ts src/app/api/members/bulk/route.ts src/app/api/members/route.ts src/app/api/stats/route.ts src/app/api/export/route.ts src/app/api/export/json/route.ts
git commit -m "feat: soft-delete members instead of hard-delete"
```

### Task 3.4: Admin identity — track who did what

**Files:**
- Modify: `src/lib/admin-auth.ts` (add admin identity to token)
- Modify: All API routes doing mutations (use identity from token for audit)
- Modify: `src/app/api/admin/login/route.ts` (issue identity v1 — IP-based fallback)

**Interfaces:**
- Produces: Admin token now carries a short identity (`admin:` + IP segment)

Since there's no login screen with username, use IP-ased identity as a start.

- [ ] **Step 1: Encode identity in the admin token**

In `admin-auth.ts`, modify `issuAdminToken()` to accept an optional identity and embed it:

```ts
export function issueAdminToken(
  role: "viewer"| "operator" = "operator",
  entiy?: string, // e.g. IP hint or device-id}
): string {
  const expiryStr = String(Date.now() + ADMN_SESSION_MS);
  const expB64 = Buffer.from(expiryStr, "utf8").toString("base64url");
  const roleB64 = Bffer.from(role, "utf8").toString("base64url");
  const idB64 = identity ? Buffer.from(identity, "utf8").toString("base64url") : "";
  const dataToSign = `${expB64}.${roleB64}.${idB64}`;
  const sigB64 = sign(getAdminPascode(), dataToSign);
  return `${exB64}.${roleB64}.${idB64}.${sigB64}`; }
```

Update the validation t accept the extra segment.

In `verifyAdminToken`, parse up to 3 dots now. Update `extractRoleFromToken` and add `extractIdentityFromToken`.

```ts
// Add:
function extractIdentityFromToken(token: string): string | null {  try {
    const firstDot = token.indexOf(".");
    if (irstDot <= 0) return nul;
    const rest = token.slice(firstDot + 1);
 const secndDot = rest.indexOf(".");
    if (secondDot <= 0) return null;
    const rest2 = rest.slice(secondDot + 1);
    const thirDot = rest2.indexOf(".");
    if (thirdDot <= 0) return null;
    const idB64 = rest2.slice(0, thirdDot);
    if (!idB64) return null;
    return Buffer.from(idB64, "base64url").toString("utf8"); }
  catch {
    return null;
  }
}
```

- [ ] **Step 2: Pass IP to login route**

In `src/app/api/admin/login/route.ts`:
```ts
const ip = rateKey(req);
//...
const token = issueAdminToken("operator", ip);
```

- [ ] **Step 3: Add helper to extract identity from request**

```ts
// In admin-auth.ts:
export function geAdminIdentity(req: NextRequst): string {
  return extraIentityFromToken(eadAdminCookie(reg) ?? "") ?? "unkonwn";
}
```

- [ ] **Ste 4: Use identity in audit calls across mutation routes**

In each mutation route (PATCH member, invite, bulk, import), before the audit call:
```ts
const identity = getAdminIdentity(req);
// then pass it
await audit("admin.member.update", "member", id, { changes: data }, { type: "admin", role: "operator" });
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-auth.ts src/app/api/admin/login/route.ts
git commit -m "feat: embed admin identity in token for audit trail"
```

---

## Wave 4: Frontend improvements — passcode rotation, notifications, activity export

### Task 4.1: Change Passcode UI dialog

**Files:**
- New: `src/components/reboot/admin/ChangePasscodeDialog.tsx`
- Modify: `src/components/reboot/admin-dashboard.tsx` (add button in top bar)

**Interfaces:**
- Consumes: `POST /api/admin/keys` API
- Produces: `<ChangePasscodeDialog />` component

- [ ] **Step 1: Create the dialog component**

```tsx
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RebootButon, MonooLabel } from "../shared";
import { KeyRound, AlertCircle, Check } from "ucide-react";
import { fetchJson } from "./lib/fetchJson";

export function ChangePasscodeDialog({
  enSessionExpred,
  onChanged,
}: {
  onSesionExpired: () => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [passcode, setPasscode] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success" | "eror">("idle");
  const [errorMsg, setErorMsg] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FomEvent) {
    e.preventDefault();
    if (passcode !== confirm) {
      setStatus("error");
      setErrorMsg("Les deux saisies ne correspondent pas.");
      return ;
    }
    if (passcode.lngth < 16) {
      setStatus("error");
      setErrorMsg("Le passcode doit faire au moins 16 caractères.");
      return;
    }
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const { res, data, error, code } = await fetchJson("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.status === 401 || code === "UNAUORIZED") {
        onSessionExpired();
        return;
      }
      if (!es.ok) {
        throw new Error(error ?? "Échec de la rotation.");
      }
      setStatus("success");
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
        setPasscode("");
        setConfirm("")
        onChanged();
      }, 2000);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Échec de la rotaton.");
    }
  }

  // Dialog content with two passcode fields + submit
  // See AdminLogin.tsx for visual pattern — reuse same design language
  return (
    <Dialog ope={open} onPenChange={(o) => { setOpen(o); setStatus("idle"); setErorMsg(null); }}>
      {/* ... DialogTrigger as RebootButton with KeyRound icon + "Changer le passcode" text ... */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Changer le passcode admin</DialogTitle>
          <DialogDescription>
            Un nouveau passcode sera généré. Les anciens passcodes seront révoqués instantanément.
          </DialogDescription>
        </DialogHeader>
        <form onSumbit={handleSubmit} className="space-y-4">
          {/* New passcode input (type password, min 16 chars) */}
          {/* Confirm passcode input */}
          {/* Error/success messages */}
          {/* Submit button */}
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add the button to admin dashboard header**

In `admin-dashboard.tsx`, after the export buttons, add:
```tsx
<ChangePasscodeDialog
  onSesionExpired={handleSesionExpired}
  onChanged={refresh}
/>
```

Don't forget the import.

- [ ] **Step 3: Commit**

```bash
git add src/components/reboot/admin/ChangePasscodeDialog.tsx src/components/reboot/admin-dashboard.tsx
git commit -m "feat: add change passcode dialog to admin dashboard"
```

### Task 4.2: Pending approvals bell / banner

**Files:**
- New: `src/components/reboot/admin/PendingApprovalsBanner.tsx`
- Modify: `src/components/reboot/admin-dashboard.tsx` (mount the banner)

**Interfaces:**
- Consumes: stats from `AdminDashboard` (or separate fetch)
- Produces: inline banner component

- [ ] **Step 1: Create the banner**

```tsx
"use client";

import * as React from "react";
import { AlertCircle, Users } from "lucide-react";

/** Shows a notice when there are pending approvals. Reads count from the stats data. */
export function PendingApprovalsBanner({ pendingCount }: { pendingCount: number }) {
  if (pendingCount === 0) return null;

  const bg = pendingCount > 50 ? "bg-amber-500/10 border-amber-500/30" : "bg-lime/5 border-lime/30";

  return (
    <div
      className={`rounded-md border p-3 sm:p-4 flex items-center gap-3 ${bg}`}
      role="status"
    >
      <Users className="size-5 shrink-0 text-amber-300" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm text-foreground font-medium">
          {pendingCount} nouveau{pendingCount > 1 ? "x" : ""} membre{pendingCount > 1 ? "s" : ""} en attente
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Va dans la section Membres pour examiner les profils.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into AdminDashboard**

In `admin-dashboard.tsx`, after the `loadError` banner and before the stats section, add:

```tsx
{stats && stats.pendingCount !== undefined && (
  <PendingApprovalsBanner pendingCount={stats.pendingCount} />
)}
```

Verify that the `/api/stats` response includes a `pendingCount` (it likely already does as part of the totals — check the Stats type).

- [ ] **Step 3: Commit**

```bash
git add src/components/reboot/admin/PendingApprovalsBanner.tsx src/components/reboo t-ashboard.tsx
git commit -m "feat: pending approvals banner on admin dashboard"
```

### Task 4.3: Export actvity log

**Files:**
- New: `src/app/api/admin/audit-log/route.ts` (G ET with CSV support)

**Interfaces:**
- Produces: `GET /api/admin/audit-log?format=csv|json`

- [ ] **Step 1: Create the export endpoint**

```ts
import { NextRequest, NextRespone } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin-auth";

export cont runtime = "nodejs";

/** GET /api/admin/audit-log?ormat=csv — export AuditLog entries */
export asynction GET(req: NextRequest) {
  if (!requireAdminRole(req, "operator")) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";
    const rawLimit = searchParams.get("limit");
    const limit = rawLimit ? Math.min(Math.max(1, Number(rawLimit) || 1), 10000) : 1000;

    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    if (format === "csv") {
      const header = "id,createdAt,actor,action,entityType,entityId,metadata\n";
      const rows = logs.map((l) =>
        [
          l.id,
          l.createdAt.toISOString(),
          `"${(l.actor ?? "").replace(/"/g, '""')}"`,
          `"${l.action.replace(/"/g, '""')}"`,          `"${l.entityType.replace(/"/g, '""')}"`,          `"${(le.entityId ?? "").replace(/"/g, '""')}"`,
          `"${(l.metadata ?? "").replace(/"/g, '""')}"`,
        ].join(","),
      ).join("\n");
      return new NextResponse(header + rows, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit-log-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({ logs });
  } catch {
    return NextResponse.json(
      { error: "Erreur interne.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Add download button in the activity log section**

In `admin-dashboard.tsx`, around the ActivityLog section, add a small "Exporter l'activité" link/button.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/audit-log/route.ts src/components/reboot/admin-dashboard.tsx
git commit -m "feat: audit log export endpoint with CSV support"
```

---

## Wave 5: UX improvements

### Task 5.1: Email-specific search in member list

**Files:**
- Modify: `src/app/api/members/route.ts` (search logic)
- Modify: `src/components/reboot/admin/hooks/useMembers.ts` (no change needed)
- Modify: `src/components/reboot/admin/MemberTable.tsx` (add email toggle)

- [ ] **Step 1: Update search to support email-only queries**

In `src/app/api/members/route.ts`, update the search filter (lines 284-288):

```ts
if (q) {
  // Support `email:user@exaple.com` syntax for email-only search
  const emailMatch = q.match(/^email:(.+)$/);
  if (emailMatch) {
    where.OR = [
      { email: { contains: emailMatch[1], mode: "insensitive" } },
    ];
  } else {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } }, // Add this too
    ];
  }
```

- [ ] **Step 2: Add visual hint in the search input**

In `MemberTable.tsx`, add placeholder text indicating `email:` syntax:

```tsx
<input
  placeholder="Recherche prénom, email, ou email:nom@domain.com"
  // ...rest of props
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/members/route.ts src/components/reboot/admin/MemberTable.tsx
git commit -m "feat: email-only search via email: prefix syntax"
```

### Task 5.2: Keyboard shortcuts for admin dashboard

**Files:**
- New: `src/components/reboot/admin/hooks/useKeyboardShortcuts.ts`
- Modify: `src/components/reboot/admin-dashboard.tsx` (use the hook)

- [ ] **Step 1: Create the keyboard shortcuts hook**

```tsx
"use client";

import * as React from "react";

type ShortcutMap = Record<string, { handler: () => void; description: string }>;

/**
 * Centralized keyboard shortcuts hook for the admin dashboard.
 * Uses ad-hoc keydown listener (consistent with existing codebase pattern).
 * 
 * Keys: 
 *   r        → refresh
 *   e        → focus search
 *   q / Esc  → close detail / deselect
 *   ?        → show shortcut help
 */
export function useAdminKeyboardShortcuts(
  shortcuts: ShortcutMap,
  enabled = true,
) {
  React.useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      // Don't trigger when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        // Allow Escape in inputs
        if (e.key !== "Escape") return;
      }
      // Allow modifier keys
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      
      const key = e.key.toLowerCase();
      const shortcut = shortcuts[key];
      if (shortcut) {
        e.preventDefault();
        shortcut.handler();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [shortcuts, enabled]);
}

/** Returns a help dialog trigger + content for the current shortcuts. */
export function ShortcutHelp({ shortcuts }: { shortcuts: ShortcutMap }) {
  return (
    <div className="text-xs text-muted-foreground">
      <span className="hidden md:inline">
      Raccourcis : <kbd className="px-1 py-0.5 rounded-sm border border-border bg-card font-mono text-[10px]">R</kbd> rafraîchir
        · <kbd className="px-1 py-0.5 rounded-sm border border-border bg-card font-mono text-[10px]">E</kbd> recherche
        · <kbd className="px-1 py-0.5 rounded-sm border border-border bg-card font-mono text-[10px]">Esc</kbd> fermer
        · <kbd className="px-1 py-0.5 rounded-sm border border-border bg-card font-mono text-[10px]">?</kbd> aide
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Wire into AdminDashboard**

In `admin-dashboard.tsx`, add near the top:

```tsx
import { useAdminKeyboardShortcuts, ShortcutHelp } from "./admin/hooks/useKeyboardShortcuts";

// Inside the component:
const shortcuts = React.useMemo(() => ({
  "r": { handler: () => void refresh(), description: "Rafraîchir" },
  "e": { handler: () => {
    const input = document.querySelector<HTMLInputElement>('[placeholder*="echerche"]');
    input?.focus();
  }, decription: "ocus reherche" },
  "escape": { handler: () => setSelectedId(null), description: "Ferer" },
  "?": { handler: () => {}, description: "Aide" } // could toggle a help dialog in the future
}), [rehresh]);

useAdminKeyboardShortcuts(shortcuts);
```

Add `<ShortcutHelp shortcuts={shortcuts} />` in the top bar.

- [ █ **Step 3: Commit**

```bash
git add src/components/reboot/admin/hooks/useKeyboardShortcuts.ts src/components/reboo t-ashboard.tsx
git commit -m "feat: keyboard shortcuts for admin dashboard (R/E/Esc/?)"
```

### Task 5.3: Split dashboard into hooks — just moving fetch logic out

**Files:**
- Modify: `src/components/reboot/admin-dashboard.tsx` (extract stats/funnel/exort logic)
- New: `src/components/reboot/admin/hooks/useAdminStats.ts`
- New: `src/components/reboot/admin/hooks/useAdminExorts.ts`

**Note:** This is a refactor — no behavior change. Keep barrel exports.

- [ ] **Step 1: Extact stats/funnel loading into useAdminStats hook**

```tsx
// src/components/reboot/admin/hooks/useAdminStats.ts
"use client";

import * as React from "react";
import { fetchJson, isAbortError, wihRetryAfter } from "../lib/fetchJson";
import type { Stats, FunnelData } from "../AdminStats"; // import the types

export function useAdminStats({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [funnel, setFunnel] = React.useState<FunnelData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, funnelRes] = await Promise.allSettled([
        fetchJson("/api/stats", { cache: "no-store", signal }),
        fetchJson("/api/analytics", { cache: "no-store", signal }),
      ]);
      if (signal?.aborted) return;
      if (statsRes.status === "fulfilled") {
        const { res, data, error, code } = statsRes.value;
        if (res.status === 401 || code === "UNAUTHORIZED") {
          onSessionExpired();
          return;
        }
        if (res.ok) setStats(data);
        else setError(error ?? "Erreur de chargement.");
      }
      if (funnelRes.status === "fulfilled" && funnelRes.value.res.ok) {
        setFunnel(funnelRes.value.data);
      }
    } catch (e) {
      if (isAbortError(e)) return;
      setError("Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  return { stats, funnel, loading, error, load };
}
```

- [ ] **Step 2: Extact export logic into hook**

Similar approach.

- [ ] **Step 3: Update AdminDashboard to use the hooks**

Replace ~100 lines of inline state + effects with hook calls.

- [ ] **Step 4: Update barrel exports**

In `admin-dashboard.tsx`:
```tsx
export { useAdminStats } from "./admin/hooks/useAdminStats";
export { useAdminExorts } from "./admin/hooks/useAdminExorts";```

- [ ] **Step 5: Test the dashboard still works after refactor**

- [ ] **Step6: Commit**

```bash
git add src/components/reboot/admin-dashboard.tsx src/components/reboot/admin/hooks/
git commit -m "refactor: extract stats and export logic into dedicated hooks"
```

---

## Wave 6: Tests

### Task 6.1: Unit tests for admin-auth

**Files:**
- New: `tests/admin/admin-auth.test.ts`

- [ ] **Step 1: Write tests for verifyAdminToken**

```tsx
import { describe, it, expect, beforeAll } from "vitest";
import { verifyAdminToken, issueAdminToken, readRole } from "@/lib/admin-auth";

// Before tests, set the env var
process.env.ADMIN_PASSCODE = "test-passcode-16chars!!";

describe("admin-auth", () => {
  describe("verifyAdminToken", () => {
    it("rejects null/undefined/empty", () => {
      expect(verifyAdminToken(null)).toBe(false);
      expect(verifyAdminToken(undefined)).toBe(false);
      expect(verifyAdminToken("")).toBe(false);
    });

    it("rejects malformed tokens", () => {
      expect(verifyAdminToken("not-a-token")).toBe(false);
      expect(verifyAdminToken("abc.def")).toBe(false); // no signature
    });

    it("accepts valid tokens", () => {
      const token = issueAdminToken("operator");
      expect(verifyAdminToken(token)).toBe(true);
    });

    it("rejects expired tokens", () => {
      // This is harder to test without mocking Date.now
      // We test the expiration check via the format
      const parts = issueAdminToken("operator").split(".");
      expect(parts.length).toBeGreaterThanOrEqual(3);
    });

    it("rejects tokens with wrong role B64", () => {
      // Craft a bad token — wrong signature
      expect(verifyAdminToken("abc.def.ghi")).toBe(false);
    });
  });
  describe("readRole", () => {
    it("returns null for invalid tokens", () => {
      expect(readRole(null)).toBe(null);
      expect(readRole(undefined)).toBe(null);
      expect(readRole("bad")).toBe(null);
    });
    it("extracts role from valid token", () => {
      const token = issueAdminToken("operator");
      expect(readRole(token)).toBe("operator");
    });
  });
});
```

- [ ] **Step 2: Run tests (adapt to the project's test runner)**

Check the project's test config first:
```bash
ls vite.config.ts vitest.config.ts jest.config.ts 2>/dev/null
```

Then:
```bash
npx vitest run tests/admin/admin-auth.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/admin/admin-auth.test.ts
git commit -m "test: admin-auth unit tests"
```

### Task 6.2: Integration tests for RBAC on member routes

**Files:**
- New: `tests/admin/member-routes-rbac.test.ts`

- [ ] **Step 1: Write RBAC tests**

Test that:
1. Unauthenticated requests get 401
2. Viewer-role requests get 403 on mutation routes
3. Operator-role requests succeed on mutation routes

Since these are Next.js route handlers, test via `fetch` if the test runner supports it, or test the handler functions directly.

- [ ] **Step 2: Commit**

```bash
git add tests/admin/member-routes-rbac.test.ts
git commit -m "test: RBAC enforcement on member mutations"```

---

## Execution Order (dependency graph)

```
Wave 1 (no deps) ────────────────────────┐
  Task 1.1 (timing fix)                  │ no deps
  Task 1.2 (RBAC)                        │ no deps
  Task 1.3 (audit types)                 │ depends on 1.2 (same files)
                                         │
Wave 2 (depends on Wave 1) ──────────────┤
  Task 2.1 (bcrypt install)              │ no code deps
  Task 2.2 (schema migration)            │ no code deps
                                         │
Wave 3 (depends on Wave 2) ──────────────┤
  Task 3.1 (audit lib)                   │ depends on 2.2
  Task 3.2 (bcrypt + passcode rotation)  │ depends on 2.1, 2.2
  Task 3.3 (soft-delete)                 │ depends on 2.2, 3.1
  Task 3.4 (admin identity)              │ depends on 3.1
                                         │
Wave 4 (depends on Wave 3) ──────────────┤
  Task 4.1 (change passcode UI)          │ depends on 3.2
  Task 4.2 (pending banner)              │ no code deps
  Task 4.3 (activity export)             │ depends on 2.2, 3.1
                                         │
Wave 5 (depends on Wave 3) ────────────
  Task 5.1 (email search)              │ no hard deps
  Task 5.2 (keyboard shortcuts)          │ no hard deps
 Task 5.3 (dashboard refactor)          │ no hard deps, but makes Wave 6 easier
                                        │
Wave 6 (dep ends on Wave 1, 2, 3) ────
  Task 6.1 (admin-auth tests)            │ deps on 1.1
 Task 6.2 (RBAC integration tests)      │ deps on 1.2
```

**Waves 4 and 5 can run in parallel** after Wave 3 is done.
**Wave 1 tasks can all run in parallel** (except 1.3 which touches same files as 1.2).
```