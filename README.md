# Arc

Two connected apps for interview prep and personal knowledge management.

- **SDS (System Design Simulator)** — Practice system design under time pressure, get AI-scored feedback
- **MOS (Memory OS)** — Personal knowledge graph connecting everything you learn, prep, and build

SDS feeds into MOS: every evaluated session creates nodes (tech concepts, architectures, scores) that enrich your graph. MOS surfaces what you haven't practiced recently.

## Architecture

```
arc/
  sds/              Next.js app — System Design Simulator (port 3000)
  mos/              Next.js app — Memory OS (port 3001)
  shared/
    types/          Shared TypeScript types
    db/             Supabase client, Drizzle ORM schema, migrations, seed data
    llm/            LLM provider abstraction (Claude + OpenAI evaluator)
    embeddings/     Embedding provider (OpenAI text-embedding-3-small)
    auth/           Supabase Auth helpers (server, client, middleware)
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) + TypeScript |
| Database | Supabase (Postgres + pgvector) |
| Auth | Supabase Auth |
| ORM | Drizzle (admin/migrations), Supabase client (user-scoped with RLS) |
| LLM | Configurable — Claude (claude-sonnet-4-5-20250929) or OpenAI (gpt-4o) |
| Embeddings | OpenAI text-embedding-3-small (1536 dimensions) |
| Charts | Recharts |
| Diagrams | Mermaid.js |
| Graph viz | react-force-graph-2d |
| Monorepo | npm workspaces |

### Database

Single Supabase Postgres database with three schemas:

- **`sds`** — prompts, sessions, responses, evaluations, mos_sync
- **`mos`** — nodes (knowledge graph), edges (relationships)
- **`core`** — embeddings (pgvector), search_results view

All tables have Row Level Security (RLS) enabled. User-scoped queries go through the Supabase client (JWT-based RLS). Admin operations (migrations, SDS-to-MOS sync, embedding pipeline) use Drizzle with the service role.

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project with the `vector` extension enabled

### Environment

Copy `.env.local` and fill in your keys:

```bash
cp .env.local .env.local.filled
```

Required variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_URL=postgresql://postgres:...@db.your-project.supabase.co:5432/postgres

ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Optional
LLM_PROVIDER=claude          # or "openai"
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
NEXT_PUBLIC_SDS_URL=http://localhost:3000
NEXT_PUBLIC_MOS_URL=http://localhost:3001
```

### Install & Run

```bash
cd arc
npm install

# Apply database schema
npm run db:migrate

# Seed prompts (4 built-in system design scenarios)
npm run db:seed

# Run both apps
npm run dev:sds   # http://localhost:3000
npm run dev:mos   # http://localhost:3001
```

### Build

```bash
npm run build:sds
npm run build:mos
```

## SDS — System Design Simulator

Practice system design interviews with timed sessions and AI evaluation.

### Flow

1. **Pick a prompt** — Choose from system design scenarios (webhook reliability, AI extraction, provider orchestration, etc.)
2. **Choose a mode** — 30-minute or 60-minute time limit
3. **Design** — Write your architecture in a text editor, draw diagrams with Mermaid, add notes
4. **Submit** — Auto-submits on timer expiry, or submit early
5. **Get evaluated** — LLM scores your design on four dimensions
6. **Review** — See scores, radar chart, component analysis, and improvement suggestions

### Evaluation Dimensions

| Dimension | What it measures |
|-----------|-----------------|
| Components | Did you include the right building blocks? (caches, queues, databases, etc.) |
| Scaling | Horizontal scaling, partitioning, replication considerations |
| Reliability | Retries, circuit breakers, dead letter queues, failure handling |
| Trade-offs | CAP theorem, consistency vs availability, cost vs performance |

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing — start new session or view history |
| `/session/[id]` | Active session — timer, editor, diagram |
| `/session/[id]/review` | Post-session — evaluation results, suggestions |
| `/dashboard` | Score history charts and trends |

## MOS — Memory OS

Personal knowledge graph that grows automatically from your practice sessions.

### Node Types

`concept` · `pattern` · `domain` · `person` · `org` · `project` · `note` · `artifact`

Subtyping via `metadata.subtype` (e.g., `{type: 'artifact', metadata: {subtype: 'ski_gear'}}`).

### Edge Types

`related_to` · `used_in` · `practiced_at` · `knows` · `prepared_for` · `works_at` · `authored` · `read` · `connected_to` · `depends_on` · `part_of` · `custom`

### Features

- **Graph explorer** — Force-directed visualization with type filters and search
- **Semantic search** — Hybrid vector + keyword search across all nodes
- **"What do I know about X?"** — LLM synthesizes an answer by walking your graph
- **Crib sheet generator** — Given a node, walks connections and produces a structured prep doc
- **Practice suggestions** — Surfaces concepts you haven't practiced in over 2 weeks

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Graph explorer — visual node map |
| `/search` | Semantic search interface |
| `/node/[id]` | Node detail + connections |
| `/crib/[nodeId]` | Generated crib sheet for a node |
| `/ask` | "What do I know about X?" conversational interface |

## SDS + MOS Integration

When an SDS session is evaluated, the system automatically:

1. Creates a `note` node in MOS for the session (with scores in metadata)
2. Upserts `concept` nodes for each architectural component found in the design
3. Creates `practiced_at` edges linking concepts to the session node
4. Records all mappings in `sds.mos_sync` for idempotent re-runs

The SDS review page links to the synced MOS nodes. The MOS home page shows practice suggestions for stale concepts with links back to SDS.

## Database Migrations

The initial migration is at `shared/db/migrations/0000_initial.sql`. It creates all schemas, tables, indexes, RLS policies, triggers, and functions including:

- `mos.update_search_vector()` — auto-updates tsvector on node insert/update
- `mos.enforce_edge_ownership()` — validates edge source/target belong to the same user
- `sds.update_updated_at()` — maintains `updated_at` timestamps
- `mos.traverse_graph()` — recursive CTE for N-hop graph traversal
- `core.semantic_search()` — cosine similarity search over embeddings
- `core.search_results` — view joining embeddings to display metadata
