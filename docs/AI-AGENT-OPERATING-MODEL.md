# HashCode Reboot — AI Agent Operating Model

## Purpose
Use GitHub Copilot custom agents as a specialized engineering team. Agents implement bounded issues and open reviewable PRs; product and architecture decisions remain human-reviewed.

## Agent map
| Area | Agent | Main scope |
|---|---|---|
| Orchestration | HashCode Orchestrator | Cross-milestone planning |
| Architecture | HashCode Architecture | Structural/domain/database changes |
| Core | HashCode Core | #142-#159 |
| Localization | HashCode Localization | #141 |
| UX | HashCode UX | #127-#140 |
| Security | HashCode Security | #117 #118 #121 #145 #153 |
| Data/Growth | HashCode Data Growth | #156 #160-#175 |
| Community | HashCode Community | #107 #108 #110 #151 #152 #157 |
| QA | HashCode QA | #112 #113 #139 #159 #175 |

## Milestone order
1. Foundation & Trust
2. Core Member Journey
3. Community & Mentoring
4. Data & Lifecycle
5. Acquisition Engine
6. Growth & Readiness
7. Public UX V2

UX can proceed in parallel after #141 terminology and the product states affecting UI are stable.

## Workflow
1. Read issue and linked issues.
2. Audit existing implementation.
3. Write a short plan in the agent session.
4. Implement only bounded scope.
5. Add or update tests.
6. Run validation.
7. Open a PR.
8. Human reviews acceptance evidence.
9. Merge only after required checks are green.

## Parallelism
Safe when domains and files are independent. Do not parallelize competing Prisma migrations, localization rewrites, or changes to the same landing architecture. Dependent state-model work waits for its source of truth to merge.

## Definition of Done
A task is done only when code is implemented, acceptance criteria are satisfied, important state is persisted, relevant tests pass, existing protections remain intact, and the PR contains evidence and limitations.

## Milestone gates
- Gate 1 Technical: build/typecheck/lint/tests.
- Gate 2 Product: complete user behavior from the relevant entry state.
- Gate 3 Data: important state/events/progress are persisted and observable.
- Gate 4 Proof: E2E/test evidence and explicit acceptance mapping.

## Product principle
Close the first user kilometer before adding breadth: visitor -> understand -> orient -> profile -> activate -> first action -> first realization -> progress -> return.
