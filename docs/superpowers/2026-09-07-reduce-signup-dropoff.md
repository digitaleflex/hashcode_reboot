# Reduce Signup Drop-off — UX Improvements Plan (data-driven)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce the 30% drop-off rate (40 started → 28 completed) by eliminating the biggest friction source: the mentorat conditional questions (6 extra questions when mentoring=yes/maybe).

**Architecture:** UX-only changes across 4 files. No backend changes, no schema changes.

**Tech Stack:** Next.js, React, TypeScript, Zod

---

## Data Analysis (29 members, 40 sessions)

**Funnel:** 170 views → 79 CTA → 40 started → 28 completed (70% rate)

**Drop-off by question (answers count):**
- profil group: 41-43 answers → stable
- objectifs/rythme: 41-42 → stable
- **mentoringInterest: 42 → mentoringMaybeReason: 15 (-64%!)**
- **budgetWillingness: 33 → budgetRange: 24 (-27%)**
- threeMonthGoal: 36, email: 35, phone: 35, lastName: 33, city: 33

**Root cause:** The mentorat group adds 5 conditional questions. Users who say "maybe" to mentoring face a longtext + 3 more questions. Users who say "yes" face 4 more questions.

**Unused fields:** lastName (not in profile UI), city (not in profile UI), budgetWillingness (redundant with budgetRange), mentoringMaybeReason (not used), mentoringFrequency (not used), mentoringTypes (not used).

---

## Task 1: Make `lastName` and `city` optional

**Why:** Not used in profile UI. Already optional in Prisma schema. Reduces contact friction.

**Files:** `src/lib/profiling/questions.ts`, `src/lib/profiling/validate.ts`

- [ ] Make lastName `required: false` in questions.ts, add "Facultatif" to description
- [ ] Make city `required: false` in questions.ts, add "Facultatif" to description
- [ ] Update Zod schema: `lastName: z.string().trim().max(60).optional().default("")`
- [ ] Update Zod schema: `city: z.string().trim().max(80).optional().default("")`
- [ ] Run typecheck

---

## Task 2: Reduce threeMonthGoal friction

**Why:** minChars=8 is too high for a longtext after 17 click questions.

**Files:** `src/lib/profiling/questions.ts`, `src/lib/profiling/validate.ts`, `src/lib/profiling/auto-controls.ts`

- [ ] Change minChars 8 → 4 in questions.ts
- [ ] Improve description: "Même une courte phrase suffit."
- [ ] Update Zod: `min(4, "Objectif trop court")`
- [ ] Update auto-controls: `goalLen >= 4`

---

## Task 3: Merge budgetWillingness + budgetRange into one question

**Why:** 2 questions → 1. "Pas pour le moment" replaces budgetWillingness=not_now.

**Files:** `src/lib/profiling/questions.ts`, `src/lib/profiling/auto-controls.ts`, `src/lib/profiling/validate.ts`

- [ ] Remove budgetWillingness question entirely
- [ ] Add "not_now" option to budgetRange question
- [ ] Update auto-controls high-value lead check
- [ ] Simplify superRefine in validate.ts

---

## Task 4: Improve preview screen CTA

**Why:** Users abandon after seeing their profile. Stronger CTA prevents this.

**Files:** `src/components/reboot/profiling-flow.tsx`

- [ ] Add archetype + domain to preview subtitle
- [ ] Change button "Continuer" → "Finaliser mon profil"
- [ ] Add "30 secondes" microcopy

---

## Task 5: Add contact progress indicator

**Why:** "Coordonnées (presque fini)" signals the end is near.

**Files:** `src/components/reboot/profiling-flow.tsx`, `src/lib/profiling/questions.ts`

- [ ] Update stepLabel for contact group
- [ ] Add microcopy to email and phone questions

---

## Summary

| Change | Before | After | Impact |
|---|---|---|---|
| lastName required | true | false | -1 field |
| city required | true | false | -1 field |
| threeMonthGoal minChars | 8 | 4 | Lower bar |
| Budget questions | 2 | 1 | -1 question |
| Preview CTA | "Continuer" | "Finaliser mon profil" | Motivation |
| Contact header | "Coordonnées" | "Coordonnées (presque fini)" | Urgency |

**Expected result:** 70% → ~85% completion rate.
