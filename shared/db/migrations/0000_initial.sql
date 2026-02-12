-- Initial schema for SDS + MOS + Core
-- Run against Supabase Postgres

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- Schema: sds (System Design Simulator)
-- ==========================================
CREATE SCHEMA IF NOT EXISTS sds;

CREATE TABLE sds.prompts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  category      TEXT NOT NULL,
  difficulty    TEXT NOT NULL DEFAULT 'medium'
                CHECK (difficulty IN ('easy', 'medium', 'hard')),
  description   TEXT NOT NULL,
  constraints   JSONB NOT NULL DEFAULT '[]',
  expected_components JSONB NOT NULL DEFAULT '[]',
  time_limit_min INTEGER NOT NULL DEFAULT 60,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sds.sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  prompt_id     UUID NOT NULL REFERENCES sds.prompts(id),
  mode          TEXT NOT NULL CHECK (mode IN ('30_min', '60_min')),
  status        TEXT NOT NULL DEFAULT 'in_progress'
                CHECK (status IN ('in_progress', 'submitted', 'evaluated')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  time_spent_sec INTEGER,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sds.responses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES sds.sessions(id),
  version         INTEGER NOT NULL DEFAULT 1,
  architecture_text TEXT NOT NULL,
  mermaid_diagram   TEXT,
  notes             TEXT,
  is_final          BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, version)
);

CREATE TABLE sds.evaluations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  response_id     UUID NOT NULL REFERENCES sds.responses(id),
  llm_provider    TEXT NOT NULL,
  llm_model       TEXT NOT NULL,
  eval_prompt_version INTEGER NOT NULL DEFAULT 1,
  parser_version    INTEGER NOT NULL DEFAULT 1,
  raw_response    TEXT NOT NULL,
  overall_score   INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  component_score INTEGER NOT NULL CHECK (component_score BETWEEN 0 AND 100),
  scaling_score   INTEGER NOT NULL CHECK (scaling_score BETWEEN 0 AND 100),
  reliability_score INTEGER NOT NULL CHECK (reliability_score BETWEEN 0 AND 100),
  tradeoff_score  INTEGER NOT NULL CHECK (tradeoff_score BETWEEN 0 AND 100),
  components_found  JSONB NOT NULL DEFAULT '[]',
  components_missing JSONB NOT NULL DEFAULT '[]',
  scaling_gaps      JSONB NOT NULL DEFAULT '[]',
  suggestions       JSONB NOT NULL DEFAULT '[]',
  evaluated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sds.sessions(user_id);
CREATE INDEX idx_sessions_started ON sds.sessions(started_at DESC);
CREATE INDEX idx_responses_session ON sds.responses(session_id);
CREATE INDEX idx_evaluations_response ON sds.evaluations(response_id);
CREATE INDEX idx_evaluations_response_time ON sds.evaluations(response_id, evaluated_at DESC);

-- Enforce exactly one final response per session
CREATE UNIQUE INDEX sds_one_final_response_per_session
  ON sds.responses(session_id) WHERE is_final = true;

-- Auto-update updated_at on SDS tables
CREATE OR REPLACE FUNCTION sds.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON sds.sessions
  FOR EACH ROW EXECUTE FUNCTION sds.update_updated_at();

CREATE TRIGGER trg_responses_updated_at
  BEFORE UPDATE ON sds.responses
  FOR EACH ROW EXECUTE FUNCTION sds.update_updated_at();

-- ==========================================
-- Schema: mos (Memory OS)
-- ==========================================
CREATE SCHEMA IF NOT EXISTS mos;

CREATE TABLE mos.nodes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  type          TEXT NOT NULL CHECK (type IN (
                  'concept', 'pattern', 'domain', 'person', 'org',
                  'project', 'note', 'artifact'
                )),
  slug          TEXT NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT,
  summary       TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  search_vector TSVECTOR,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE TABLE mos.edges (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  source_id     UUID NOT NULL REFERENCES mos.nodes(id) ON DELETE CASCADE,
  target_id     UUID NOT NULL REFERENCES mos.nodes(id) ON DELETE CASCADE,
  edge_type     TEXT NOT NULL DEFAULT 'related_to'
                CHECK (edge_type IN (
                  'related_to', 'used_in', 'practiced_at', 'knows',
                  'prepared_for', 'works_at', 'authored', 'read',
                  'connected_to', 'depends_on', 'part_of', 'custom'
                )),
  custom_label  TEXT,
  weight        REAL NOT NULL DEFAULT 1.0,
  summary       TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_edge CHECK (source_id != target_id),
  CONSTRAINT custom_label_check CHECK (
    (edge_type = 'custom' AND custom_label IS NOT NULL AND custom_label <> '') OR
    (edge_type <> 'custom')
  )
);

CREATE INDEX idx_nodes_user ON mos.nodes(user_id);
CREATE INDEX idx_nodes_type ON mos.nodes(type);
CREATE INDEX idx_nodes_slug ON mos.nodes(user_id, slug);
CREATE INDEX idx_nodes_search ON mos.nodes USING gin (search_vector);
CREATE INDEX idx_edges_source ON mos.edges(source_id);
CREATE INDEX idx_edges_target ON mos.edges(target_id);
CREATE INDEX idx_edges_type ON mos.edges(edge_type);

-- Auto-update search_vector
CREATE OR REPLACE FUNCTION mos.update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.content, '') || ' ' ||
    COALESCE(NEW.summary, ''));
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_nodes_search_vector
  BEFORE INSERT OR UPDATE ON mos.nodes
  FOR EACH ROW EXECUTE FUNCTION mos.update_search_vector();

-- Edge ownership enforcement
CREATE OR REPLACE FUNCTION mos.enforce_edge_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mos.nodes WHERE id = NEW.source_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'source node does not belong to user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM mos.nodes WHERE id = NEW.target_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'target node does not belong to user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_edge_ownership
  BEFORE INSERT OR UPDATE ON mos.edges
  FOR EACH ROW EXECUTE FUNCTION mos.enforce_edge_ownership();

-- ==========================================
-- Schema: core (shared)
-- ==========================================
CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE core.embeddings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  entity_type     TEXT NOT NULL CHECK (entity_type IN (
                    'sds_session', 'sds_prompt', 'mos_node', 'mos_edge'
                  )),
  entity_id       UUID NOT NULL,
  content_hash    TEXT NOT NULL,
  embedding       vector(1536) NOT NULL,
  model           TEXT NOT NULL,
  provider        TEXT NOT NULL DEFAULT 'openai',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, model)
);

CREATE INDEX idx_embeddings_vector ON core.embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_embeddings_entity ON core.embeddings(entity_type, entity_id);
CREATE INDEX idx_embeddings_user ON core.embeddings(user_id);

-- ==========================================
-- Graph traversal RPC function
-- ==========================================

-- Traverse graph within N hops from a starting node
CREATE OR REPLACE FUNCTION mos.traverse_graph(
  start_node_id UUID,
  max_depth INT DEFAULT 2,
  filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  node_id UUID,
  depth INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE graph AS (
    SELECT e.target_id AS nid, 1 AS d
    FROM mos.edges e
    WHERE e.source_id = start_node_id
      AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
    UNION
    SELECT e.source_id AS nid, 1 AS d
    FROM mos.edges e
    WHERE e.target_id = start_node_id
      AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
    UNION
    SELECT e.target_id, g.d + 1
    FROM mos.edges e
    JOIN graph g ON e.source_id = g.nid
    WHERE g.d < max_depth
      AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
    UNION
    SELECT e.source_id, g.d + 1
    FROM mos.edges e
    JOIN graph g ON e.target_id = g.nid
    WHERE g.d < max_depth
      AND (filter_user_id IS NULL OR e.user_id = filter_user_id)
  )
  SELECT DISTINCT g.nid AS node_id, MIN(g.d) AS depth
  FROM graph g
  WHERE g.nid != start_node_id
  GROUP BY g.nid;
END;
$$;

-- ==========================================
-- Vector search RPC functions
-- ==========================================

-- Match MOS nodes by embedding similarity (called via supabase.rpc)
CREATE OR REPLACE FUNCTION core.match_nodes(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.2,
  match_count INT DEFAULT 20,
  filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  type TEXT,
  slug TEXT,
  title TEXT,
  content TEXT,
  summary TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id, n.user_id, n.type, n.slug, n.title, n.content, n.summary, n.metadata,
    (1 - (e.embedding <=> query_embedding))::FLOAT AS similarity
  FROM core.embeddings e
  JOIN mos.nodes n ON e.entity_id = n.id AND e.entity_type = 'mos_node'
  WHERE e.model = 'text-embedding-3-small'
    AND (filter_user_id IS NULL OR n.user_id = filter_user_id)
    AND (1 - (e.embedding <=> query_embedding)) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Cross-app semantic search (SDS sessions + MOS nodes)
CREATE OR REPLACE FUNCTION core.semantic_search(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.2,
  match_count INT DEFAULT 20,
  filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID,
  display_title TEXT,
  snippet TEXT,
  node_type TEXT,
  session_score INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.entity_type, sr.entity_id, sr.display_title, sr.snippet,
    sr.node_type, sr.session_score,
    (1 - (sr.embedding <=> query_embedding))::FLOAT AS similarity
  FROM core.search_results sr
  WHERE (filter_user_id IS NULL OR sr.user_id = filter_user_id)
    AND (1 - (sr.embedding <=> query_embedding)) > match_threshold
  ORDER BY sr.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ==========================================
-- Cross-schema bridge: sds <-> mos
-- ==========================================
CREATE TABLE sds.mos_sync (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES sds.sessions(id),
  mos_node_id     UUID NOT NULL REFERENCES mos.nodes(id),
  source_type     TEXT NOT NULL CHECK (source_type IN ('session', 'concept', 'edge', 'pattern')),
  source_key      TEXT NOT NULL,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, source_type, source_key)
);

CREATE INDEX idx_mos_sync_session ON sds.mos_sync(session_id);
CREATE INDEX idx_mos_sync_node ON sds.mos_sync(mos_node_id);

-- ==========================================
-- Search results view
-- ==========================================
-- V1: filter to active embedding model to prevent duplicates if multi-model later
CREATE OR REPLACE VIEW core.search_results AS
  SELECT
    e.id AS embedding_id, e.entity_type, e.entity_id, e.embedding, e.user_id,
    n.title AS display_title,
    COALESCE(n.summary, LEFT(n.content, 200)) AS snippet,
    n.type AS node_type,
    NULL::INTEGER AS session_score
  FROM core.embeddings e
  JOIN mos.nodes n ON e.entity_id = n.id AND e.entity_type = 'mos_node'
  WHERE e.model = 'text-embedding-3-small'
  UNION ALL
  SELECT
    e.id, e.entity_type, e.entity_id, e.embedding, e.user_id,
    p.title AS display_title,
    LEFT(r.architecture_text, 200) AS snippet,
    NULL AS node_type,
    ev.overall_score AS session_score
  FROM core.embeddings e
  JOIN sds.sessions s ON e.entity_id = s.id AND e.entity_type = 'sds_session'
  JOIN sds.prompts p ON s.prompt_id = p.id
  LEFT JOIN sds.responses r ON r.session_id = s.id AND r.is_final = true
  LEFT JOIN sds.evaluations ev ON ev.response_id = r.id
  WHERE e.model = 'text-embedding-3-small';

-- ==========================================
-- RLS Policies
-- ==========================================
ALTER TABLE sds.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sds.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sds.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sds.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sds.mos_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE mos.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mos.edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.embeddings ENABLE ROW LEVEL SECURITY;

-- Prompts: everyone reads
CREATE POLICY prompts_select ON sds.prompts FOR SELECT USING (true);

-- Sessions: full CRUD scoped to user
CREATE POLICY sessions_select ON sds.sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY sessions_insert ON sds.sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY sessions_update ON sds.sessions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY sessions_delete ON sds.sessions FOR DELETE USING (user_id = auth.uid());

-- Responses: scoped via session ownership
CREATE POLICY responses_select ON sds.responses FOR SELECT
  USING (session_id IN (SELECT id FROM sds.sessions WHERE user_id = auth.uid()));
CREATE POLICY responses_insert ON sds.responses FOR INSERT
  WITH CHECK (session_id IN (SELECT id FROM sds.sessions WHERE user_id = auth.uid()));
CREATE POLICY responses_update ON sds.responses FOR UPDATE
  USING (session_id IN (SELECT id FROM sds.sessions WHERE user_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM sds.sessions WHERE user_id = auth.uid()));
CREATE POLICY responses_delete ON sds.responses FOR DELETE
  USING (session_id IN (SELECT id FROM sds.sessions WHERE user_id = auth.uid()));

-- Evaluations: scoped via response -> session ownership
CREATE POLICY evaluations_select ON sds.evaluations FOR SELECT
  USING (response_id IN (SELECT id FROM sds.responses WHERE session_id IN
    (SELECT id FROM sds.sessions WHERE user_id = auth.uid())));
CREATE POLICY evaluations_insert ON sds.evaluations FOR INSERT
  WITH CHECK (response_id IN (SELECT id FROM sds.responses WHERE session_id IN
    (SELECT id FROM sds.sessions WHERE user_id = auth.uid())));
CREATE POLICY evaluations_delete ON sds.evaluations FOR DELETE
  USING (response_id IN (SELECT id FROM sds.responses WHERE session_id IN
    (SELECT id FROM sds.sessions WHERE user_id = auth.uid())));

-- MOS: direct user_id ownership
CREATE POLICY nodes_select ON mos.nodes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY nodes_insert ON mos.nodes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY nodes_update ON mos.nodes FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY nodes_delete ON mos.nodes FOR DELETE USING (user_id = auth.uid());

CREATE POLICY edges_select ON mos.edges FOR SELECT USING (user_id = auth.uid());
CREATE POLICY edges_insert ON mos.edges FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY edges_update ON mos.edges FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY edges_delete ON mos.edges FOR DELETE USING (user_id = auth.uid());

-- mos_sync: user can read their own sync records
CREATE POLICY mos_sync_select ON sds.mos_sync FOR SELECT
  USING (session_id IN (SELECT id FROM sds.sessions WHERE user_id = auth.uid()));

-- Embeddings: direct user_id ownership
CREATE POLICY embeddings_select ON core.embeddings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY embeddings_insert ON core.embeddings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY embeddings_update ON core.embeddings FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
