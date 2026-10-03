# HashCode Reboot — Copilot Instructions

## Mission
HashCode Reboot is a production-oriented Next.js 16 + TypeScript + Prisma/PostgreSQL community onboarding platform. Work from the existing product and architecture; do not redesign the backend casually.

## Rules
- Audit existing code before changing it.
- Prefer reuse over duplication.
- Never invent data, metrics, testimonials, partners, events, capabilities, or product states.
- Preserve existing routes, APIs, auth/session behavior, analytics, profiling, admin protections, and database constraints unless the issue requires a change.
- Technical identifiers, routes, model names, API keys, variables, and code symbols stay unchanged. User-facing copy should be French.
- Never expose secrets or commit .env values.
- Database changes require Prisma schema/migrations and appropriate tests; never use destructive production commands.
- UI uses the existing Tailwind 4, shadcn/ui, Lucide and Framer Motion stack. Respect reduced motion and mobile behavior.
- Security-sensitive work must fail closed where appropriate and include regression tests.
- An issue is not complete merely because code compiles: validate acceptance criteria and behavior.

## Validation
Use Bun. Run relevant checks, and when practical:
- bun run typecheck
- bun run lint
- bun run test:unit
- bun run test:e2e for user-facing flow changes

If a check cannot run, state why in the PR.

## PR contract
Every PR must contain:
1. What changed
2. Issues addressed
3. Files/areas affected
4. Tests executed and results
5. Risks/migrations
6. Acceptance evidence
7. Follow-up work, if any

Never merge your own PR unless explicitly instructed.
