import type { SupabaseClient } from '@supabase/supabase-js';
import type { Node } from '@arc/types';
import { createEmbeddingProvider } from '@arc/embeddings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchOptions {
  query: string;
  userId: string;
  limit?: number;
}

export interface SearchResult {
  node: Node;
  score: number;
  source: 'vector' | 'keyword' | 'hybrid';
}

/**
 * Result shape returned by the `mos.match_nodes` RPC function.
 *
 * NOTE: This RPC function must be created via a Supabase migration:
 *
 *   CREATE OR REPLACE FUNCTION mos.match_nodes(
 *     query_embedding vector(1536),
 *     match_threshold float DEFAULT 0.5,
 *     match_count int DEFAULT 10,
 *     filter_user_id uuid DEFAULT NULL
 *   ) RETURNS TABLE (
 *     id uuid,
 *     user_id uuid,
 *     type text,
 *     slug text,
 *     title text,
 *     content text,
 *     summary text,
 *     metadata jsonb,
 *     created_at timestamptz,
 *     updated_at timestamptz,
 *     similarity float
 *   )
 *   LANGUAGE sql STABLE
 *   AS $$
 *     SELECT
 *       n.id, n.user_id, n.type, n.slug, n.title, n.content, n.summary,
 *       n.metadata, n.created_at, n.updated_at,
 *       1 - (e.embedding <=> query_embedding) AS similarity
 *     FROM core.embeddings e
 *     JOIN mos.nodes n ON n.id = e.entity_id
 *     WHERE e.entity_type = 'mos_node'
 *       AND (filter_user_id IS NULL OR n.user_id = filter_user_id)
 *       AND 1 - (e.embedding <=> query_embedding) > match_threshold
 *     ORDER BY e.embedding <=> query_embedding
 *     LIMIT match_count;
 *   $$;
 */
interface VectorMatchRow {
  id: string;
  user_id: string;
  type: string;
  slug: string;
  title: string;
  content: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  similarity: number;
}

// ---------------------------------------------------------------------------
// Vector search
// ---------------------------------------------------------------------------

async function vectorSearch(
  supabase: SupabaseClient,
  queryEmbedding: number[],
  userId: string,
  limit: number,
): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc('match_nodes', {
    query_embedding: queryEmbedding,
    match_threshold: 0.5,
    match_count: limit,
    filter_user_id: userId,
  });

  if (error) throw error;

  return ((data ?? []) as VectorMatchRow[]).map((row) => ({
    node: {
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      slug: row.slug,
      title: row.title,
      content: row.content,
      summary: row.summary,
      metadata: row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as Node,
    score: row.similarity,
    source: 'vector' as const,
  }));
}

// ---------------------------------------------------------------------------
// Keyword search (full-text via tsvector column)
// ---------------------------------------------------------------------------

/**
 * Keyword search using the `search_vector` tsvector column on mos.nodes.
 *
 * NOTE: The `search_vector` column must be added via migration:
 *
 *   ALTER TABLE mos.nodes
 *     ADD COLUMN search_vector tsvector
 *     GENERATED ALWAYS AS (
 *       setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
 *       setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
 *       setweight(to_tsvector('english', coalesce(summary, '')), 'C')
 *     ) STORED;
 *
 *   CREATE INDEX idx_nodes_search ON mos.nodes USING gin(search_vector);
 */
async function keywordSearch(
  supabase: SupabaseClient,
  query: string,
  userId: string,
  limit: number,
): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .schema('mos')
    .from('nodes')
    .select()
    .eq('user_id', userId)
    .textSearch('search_vector', query, { type: 'websearch' })
    .limit(limit);

  if (error) throw error;

  // Assign decreasing scores based on result order (keyword relevance rank)
  return ((data ?? []) as Node[]).map((node, i) => ({
    node,
    score: 1 - i / Math.max(limit, 1),
    source: 'keyword' as const,
  }));
}

// ---------------------------------------------------------------------------
// Hybrid search (vector + keyword, merged with weighted scoring)
// ---------------------------------------------------------------------------

const VECTOR_WEIGHT = 0.7;
const KEYWORD_WEIGHT = 0.3;

/**
 * Hybrid search combining vector similarity and keyword full-text search.
 *
 * - Embeds the query using the configured embedding provider
 * - Runs vector search via the `match_nodes` RPC function
 * - Runs keyword search via Postgres full-text search
 * - Merges and deduplicates results with weighted scoring
 *
 * Falls back to keyword-only search if no embedding API key is configured.
 */
export async function hybridSearch(
  supabase: SupabaseClient,
  options: SearchOptions,
): Promise<SearchResult[]> {
  const { query, userId, limit = 20 } = options;

  // Attempt vector search — fall back to keyword-only if embedding fails
  let vectorResults: SearchResult[] = [];
  try {
    const embeddings = createEmbeddingProvider('openai');
    const queryEmbedding = await embeddings.embed(query);
    vectorResults = await vectorSearch(supabase, queryEmbedding, userId, limit);
  } catch {
    // No embedding API key or service unavailable — keyword-only fallback
  }

  const keywordResults = await keywordSearch(supabase, query, userId, limit);

  return mergeResults(vectorResults, keywordResults, limit);
}

/**
 * Keyword-only search. Use this as a fallback when no embedding API is
 * configured or when you want fast, lexical matching.
 */
export async function searchNodes(
  supabase: SupabaseClient,
  options: SearchOptions,
): Promise<SearchResult[]> {
  const { query, userId, limit = 20 } = options;
  return keywordSearch(supabase, query, userId, limit);
}

// ---------------------------------------------------------------------------
// Merge logic
// ---------------------------------------------------------------------------

function mergeResults(
  vectorResults: SearchResult[],
  keywordResults: SearchResult[],
  limit: number,
): SearchResult[] {
  const scoreMap = new Map<string, { node: Node; vectorScore: number; keywordScore: number }>();

  for (const r of vectorResults) {
    scoreMap.set(r.node.id, {
      node: r.node,
      vectorScore: r.score,
      keywordScore: 0,
    });
  }

  for (const r of keywordResults) {
    const existing = scoreMap.get(r.node.id);
    if (existing) {
      existing.keywordScore = r.score;
    } else {
      scoreMap.set(r.node.id, {
        node: r.node,
        vectorScore: 0,
        keywordScore: r.score,
      });
    }
  }

  const merged: SearchResult[] = [];
  for (const [, entry] of scoreMap) {
    const hasVector = entry.vectorScore > 0;
    const hasKeyword = entry.keywordScore > 0;
    const combinedScore =
      entry.vectorScore * VECTOR_WEIGHT + entry.keywordScore * KEYWORD_WEIGHT;

    merged.push({
      node: entry.node,
      score: combinedScore,
      source: hasVector && hasKeyword ? 'hybrid' : hasVector ? 'vector' : 'keyword',
    });
  }

  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, limit);
}
