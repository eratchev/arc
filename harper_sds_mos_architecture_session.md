# Claude Code Session

## SDS (System Design Simulator) + MOS (Memory OS) Architecture Planning

**Context**

This session captures the design and iterative refinement of two connected applications:

* **SDS** — A system design simulator that generates prompts, time-boxes thinking, and evaluates architectural quality using LLMs.
* **MOS** — A personal knowledge graph that connects interviews, concepts, projects, and learning into a navigable graph.

SDS feeds MOS automatically — every session enriches the knowledge graph.

The transcript reflects schema evolution, RLS design, embedding strategy, idempotent cross-schema sync, and deployment decisions.

---

# High-Level Architecture

## Stack

| Choice      | Value                                   |
| ----------- | --------------------------------------- |
| Stack       | Next.js + TypeScript                    |
| LLM         | Configurable (Claude + OpenAI)          |
| DB          | Supabase (Postgres + pgvector)          |
| Auth        | Supabase Auth                           |
| Deploy      | Vercel (SDS + MOS as separate projects) |
| Repo Layout | `/arc` parent directory                 |

---

# Database Design

Single Supabase Postgres instance with 3 schemas:

* `sds` — Sessions, prompts, responses, evaluations
* `mos` — Knowledge graph (nodes + edges)
* `core` — Shared infrastructure (embeddings)

---

# Key Design Decisions

### 1. pgvector Extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

(Supabase uses `vector`, not `pgvector`.)

---

### 2. No Postgres ENUMs

All enums replaced with:

* `TEXT + CHECK (...)`

Reason: Avoid migration friction during iteration.

---

### 3. Generic Graph Node Types

Instead of overly specific types like `ski_gear`, use:

```
concept | pattern | domain | person | org | project | note | artifact
```

Subtyping goes in:

```json
metadata.subtype
```

---

### 4. Embedding Strategy (V1 Decision)

Committed to:

```
vector(1536)
text-embedding-3-small
```

Local embeddings deferred to V2.

---

# Schema: SDS

## Prompts

```sql
CREATE TABLE sds.prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium'
    CHECK (difficulty IN ('easy','medium','hard')),
  description TEXT NOT NULL,
  constraints JSONB NOT NULL DEFAULT '[]',
  expected_components JSONB NOT NULL DEFAULT '[]',
  time_limit_min INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Sessions

```sql
CREATE TABLE sds.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  prompt_id UUID NOT NULL REFERENCES sds.prompts(id),
  mode TEXT NOT NULL CHECK (mode IN ('30_min','60_min')),
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','submitted','evaluated')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  time_spent_sec INTEGER
);
```

---

## Responses (Supports Drafts + Revisions)

```sql
CREATE TABLE sds.responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sds.sessions(id),
  version INTEGER NOT NULL DEFAULT 1,
  architecture_text TEXT NOT NULL,
  mermaid_diagram TEXT,
  notes TEXT,
  is_final BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  UNIQUE (session_id, version)
);
```

`submitted_at` is only set when `is_final = true`.

---

## Evaluations (Supports Multiple Versions)

```sql
CREATE TABLE sds.evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  response_id UUID NOT NULL REFERENCES sds.responses(id),
  llm_provider TEXT NOT NULL,
  llm_model TEXT NOT NULL,
  eval_prompt_version INTEGER NOT NULL DEFAULT 1,
  parser_version INTEGER NOT NULL DEFAULT 1,
  raw_response TEXT NOT NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  component_score INTEGER NOT NULL CHECK (component_score BETWEEN 0 AND 100),
  scaling_score INTEGER NOT NULL CHECK (scaling_score BETWEEN 0 AND 100),
  reliability_score INTEGER NOT NULL CHECK (reliability_score BETWEEN 0 AND 100),
  tradeoff_score INTEGER NOT NULL CHECK (tradeoff_score BETWEEN 0 AND 100),
  components_found JSONB NOT NULL DEFAULT '[]',
  components_missing JSONB NOT NULL DEFAULT '[]',
  scaling_gaps JSONB NOT NULL DEFAULT '[]',
  suggestions JSONB NOT NULL DEFAULT '[]',
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Supports:

* Multiple model runs
* Prompt version changes
* Parser evolution

---

# Schema: MOS (Graph)

## Nodes

```sql
CREATE TABLE mos.nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (
    type IN ('concept','pattern','domain','person','org','project','note','artifact')
  ),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);
```

Deduplication is slug-based — not title-based.

---

## Edges

```sql
CREATE TABLE mos.edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  source_id UUID NOT NULL REFERENCES mos.nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES mos.nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL DEFAULT 'related_to',
  custom_label TEXT,
  weight REAL NOT NULL DEFAULT 1.0,
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_edge CHECK (source_id != target_id)
);
```

---

## Edge Ownership Trigger

Prevents cross-user corruption:

```sql
CREATE FUNCTION mos.enforce_edge_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM mos.nodes
    WHERE id = NEW.source_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'source node does not belong to user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mos.nodes
    WHERE id = NEW.target_id AND user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'target node does not belong to user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

# Schema: core.embeddings

Single universal embedding table.

```sql
CREATE TABLE core.embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  entity_type TEXT NOT NULL CHECK (
    entity_type IN ('sds_session','sds_prompt','mos_node','mos_edge')
  ),
  entity_id UUID NOT NULL,
  content_hash TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'openai',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, model)
);
```

Re-embed strategy:

```sql
ON CONFLICT(entity_type, entity_id, model)
DO UPDATE
SET embedding = EXCLUDED.embedding,
    content_hash = EXCLUDED.content_hash,
    updated_at = NOW();
```

---

# SDS ↔ MOS Bridge

```sql
CREATE TABLE sds.mos_sync (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sds.sessions(id),
  mos_node_id UUID NOT NULL REFERENCES mos.nodes(id),
  source_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, source_type, source_key)
);
```

Idempotent sync prevents duplicate nodes.

---

# RLS Strategy

* Supabase client for user-scoped operations
* Drizzle (service role) for system operations
* No manual JWT injection into Postgres

Every table has explicit RLS policies using:

```
user_id = auth.uid()
```

For nested relationships (responses, evaluations), policies use subqueries to validate ownership via sessions.

---

# Search Strategy

## Vector Search

```sql
SELECT e.entity_type, e.entity_id,
  (1 - (e.embedding <=> $1::vector)) AS vector_score
FROM core.embeddings e
ORDER BY e.embedding <=> $1::vector
LIMIT 20;
```

## Hybrid Search

```sql
SELECT n.*,
  (1 - (e.embedding <=> $1::vector)) * 0.7 +
  ts_rank(n.search_vector, plainto_tsquery('english', $2)) * 0.3 AS score
FROM mos.nodes n
JOIN core.embeddings e
  ON e.entity_id = n.id AND e.entity_type = 'mos_node'
ORDER BY score DESC
LIMIT 20;
```

---

# Deployment Model

* Supabase → Postgres + pgvector + Auth
* Vercel → SDS + MOS (separate apps)
* Shared `/arc/shared` package for:

    * LLM abstraction
    * Embedding abstraction
    * DB helpers
    * Auth helpers

---

# System Properties Achieved

* Idempotent cross-schema sync
* Slug-based graph dedupe
* Versioned evaluations
* Draftable responses
* RLS-safe ownership boundaries
* Embedding re-embed via UPSERT
* Hybrid vector + keyword search
* SSR-safe Mermaid rendering

---

# End of Session

This session reflects iterative architectural refinement with explicit handling of:

* RLS correctness
* Embedding lifecycle
* Sync idempotency
* Schema evolution
* Supabase operational constraints
* LLM evaluation versioning

---
