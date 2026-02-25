# Arc

Monorepo containing SDS (System Design Simulator) and MOS (Memory OS).

## Structure

- `sds/` — System Design Simulator (Next.js)
- `mos/` — Memory OS (Next.js)
- `shared/db/` — Drizzle schema, migrations, seed script
- `shared/llm/` — LLM evaluator (Claude + OpenAI)
- `shared/embeddings/` — Embedding utilities

## Commands

```bash
# Run all tests
npx vitest run

# Seed the database
cd shared/db && npm run seed

# Run SDS dev server
cd sds && npm run dev

# Run MOS dev server
cd mos && npm run dev
```

## Tech Stack

- Next.js 15 (App Router), TypeScript, Tailwind
- Supabase (Postgres + Auth + RLS)
- Drizzle ORM
- Vitest

## Key Conventions

- `@/` alias points to `mos/src/` in vitest config
- Supabase auth with RLS policies on all tables
- Login pages use `window.location.href` (not `router.push`) for hard navigation after auth
- LLM provider set via `LLM_PROVIDER` env var (`claude` or `openai`, defaults to `claude`)
