# Contributing

This is a monorepo built from a fixed PRD (see [`README.md`](./README.md)) and a UI prototype (see `samagama_prototype (1).jsx`).

## Where things live

- **Source of truth (product):** `README.md` (PRD).
- **Source of truth (engineering):** [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md). Read this first.
- **Decision log:** [`samagama.md`](./samagama.md). Append to this every time you ship something architecturally meaningful.
- **Workspaces:** `apps/client`, `apps/server`, `packages/shared`.

## Setup

```bash
npm install
npm run build:shared

cp apps/server/.env.example apps/server/.env   # then fill JWT secrets (≥32 chars each)
cp apps/client/.env.example apps/client/.env

# Seed (idempotent — safe to re-run)
npm --workspace @samagama/server run seed:accounts
npm --workspace @samagama/server run seed:faqs
npm --workspace @samagama/server run seed:chat-feedback

npm run dev:server
npm run dev:client   # in another terminal
```

Local accounts are listed in [`README.md` — Appendix A](./README.md#appendix-a--implementation-notes-non-prd). Re-running `seed:accounts` preserves Spurti Points balances and Q&A activity; it only refreshes name / role / password hash.

## Verify before opening a PR

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All four must pass. If any fails, fix it — don't merge with red.

## Style

- TypeScript strict mode is on. Prefer types derived from Zod schemas over hand-written types.
- Backend: thin controllers, business logic in services. Throw `ApiError`. Validate with `validate(schema)`.
- Frontend: feature folders under `src/features/<domain>/`. Use TanStack Query for server state.
- No new dependencies without a one-line justification in `samagama.md`.

## Commit style

Conventional commits:

```
feat(qna): add personal/community type to question model
fix(auth): bump tokenVersion on password change
refactor(shared): move pagination schema to common.schema
docs(context): document RAG fallback behavior
test(faq): cover sort-by-recency default
chore(deps): bump zod to 3.23.8
```
