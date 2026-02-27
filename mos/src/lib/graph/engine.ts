import type { SupabaseClient } from '@supabase/supabase-js';
import type { Node, Edge, NodeType, EdgeType } from '@arc/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand for accessing the mos schema with RLS enforcement. */
function mos(supabase: SupabaseClient) {
  return supabase.schema('mos');
}

// ---------------------------------------------------------------------------
// Node operations
// ---------------------------------------------------------------------------

export interface CreateNodeInput {
  user_id: string;
  type: NodeType;
  slug: string;
  title: string;
  content?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Upsert a node by (user_id, slug). If a row with the same user_id+slug
 * already exists it will be updated; otherwise a new row is inserted.
 */
export async function createNode(
  supabase: SupabaseClient,
  input: CreateNodeInput,
): Promise<Node> {
  const { data, error } = await mos(supabase)
    .from('nodes')
    .upsert(
      {
        user_id: input.user_id,
        type: input.type,
        slug: input.slug,
        title: input.title,
        content: input.content ?? null,
        summary: input.summary ?? null,
        metadata: input.metadata ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,slug' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as Node;
}

export interface UpdateNodeInput {
  title?: string;
  content?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
  type?: NodeType;
}

export async function updateNode(
  supabase: SupabaseClient,
  id: string,
  updates: UpdateNodeInput,
): Promise<Node> {
  const { data, error } = await mos(supabase)
    .from('nodes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Node;
}

export async function deleteNode(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await mos(supabase)
    .from('nodes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getNode(
  supabase: SupabaseClient,
  id: string,
): Promise<Node | null> {
  const { data, error } = await mos(supabase)
    .from('nodes')
    .select()
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as Node | null;
}

export async function getNodeBySlug(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
): Promise<Node | null> {
  const { data, error } = await mos(supabase)
    .from('nodes')
    .select()
    .eq('user_id', userId)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  return data as Node | null;
}

export interface ListNodesOptions {
  type?: NodeType;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listNodes(
  supabase: SupabaseClient,
  options: ListNodesOptions = {},
): Promise<Node[]> {
  const { type, search, limit = 50, offset = 0 } = options;

  let query = mos(supabase)
    .from('nodes')
    .select();

  if (type) {
    query = query.eq('type', type);
  }
  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  }

  query = query.order('updated_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Node[];
}

// ---------------------------------------------------------------------------
// Edge operations
// ---------------------------------------------------------------------------

export interface CreateEdgeInput {
  user_id: string;
  source_id: string;
  target_id: string;
  edge_type: EdgeType;
  custom_label?: string | null;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export async function createEdge(
  supabase: SupabaseClient,
  input: CreateEdgeInput,
): Promise<Edge> {
  const { data, error } = await mos(supabase)
    .from('edges')
    .insert({
      user_id: input.user_id,
      source_id: input.source_id,
      target_id: input.target_id,
      edge_type: input.edge_type,
      custom_label: input.custom_label ?? null,
      weight: input.weight ?? 1.0,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) throw error;
  return data as Edge;
}

export async function deleteEdge(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await mos(supabase)
    .from('edges')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Graph traversal
// ---------------------------------------------------------------------------

export interface GetConnectionsOptions {
  depth?: number;
  direction?: 'outgoing' | 'incoming' | 'both';
}

interface ConnectionResult {
  edge: Edge;
  node: Node;
  depth: number;
}

/**
 * Retrieve connected nodes up to `depth` hops away.
 *
 * For depth=1 (the common case) this issues direct queries.
 * For depth>1 it performs iterative fetches, expanding the frontier one hop
 * at a time. A database-side recursive CTE (via an RPC function) would be
 * more efficient for large graphs but requires a Supabase migration.
 */
export async function getConnections(
  supabase: SupabaseClient,
  nodeId: string,
  options: GetConnectionsOptions = {},
): Promise<ConnectionResult[]> {
  const { depth = 1, direction = 'both' } = options;
  const visited = new Set<string>([nodeId]);
  const results: ConnectionResult[] = [];
  let frontier = [nodeId];

  for (let hop = 1; hop <= depth; hop++) {
    if (frontier.length === 0) break;

    const edges = await fetchEdgesForNodes(supabase, frontier, direction);

    const nextFrontier: string[] = [];
    const neighborIds = new Set<string>();
    const frontierSet = new Set(frontier);

    for (const edge of edges) {
      const neighborId = edge.source_id === nodeId || frontierSet.has(edge.source_id)
        ? edge.target_id
        : edge.source_id;

      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        nextFrontier.push(neighborId);
        neighborIds.add(neighborId);
      }
    }

    // Batch-fetch neighbor nodes
    const neighborNodes = neighborIds.size > 0
      ? await fetchNodesByIds(supabase, Array.from(neighborIds))
      : [];

    const nodeMap = new Map(neighborNodes.map((n) => [n.id, n]));

    for (const edge of edges) {
      const neighborId = edge.source_id === nodeId || frontierSet.has(edge.source_id)
        ? edge.target_id
        : edge.source_id;

      const node = nodeMap.get(neighborId);
      if (node) {
        results.push({ edge, node, depth: hop });
      }
    }

    frontier = nextFrontier;
  }

  return results;
}

async function fetchEdgesForNodes(
  supabase: SupabaseClient,
  nodeIds: string[],
  direction: 'outgoing' | 'incoming' | 'both',
): Promise<Edge[]> {
  const edges: Edge[] = [];

  if (direction === 'outgoing' || direction === 'both') {
    const { data, error } = await mos(supabase)
      .from('edges')
      .select()
      .in('source_id', nodeIds);

    if (error) throw error;
    edges.push(...((data ?? []) as Edge[]));
  }

  if (direction === 'incoming' || direction === 'both') {
    const { data, error } = await mos(supabase)
      .from('edges')
      .select()
      .in('target_id', nodeIds);

    if (error) throw error;
    edges.push(...((data ?? []) as Edge[]));
  }

  // Deduplicate edges that might appear in both directions
  const seen = new Set<string>();
  return edges.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

async function fetchNodesByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Node[]> {
  if (ids.length === 0) return [];

  const { data, error } = await mos(supabase)
    .from('nodes')
    .select()
    .in('id', ids);

  if (error) throw error;
  return (data ?? []) as Node[];
}

// ---------------------------------------------------------------------------
// Node + edges composite query
// ---------------------------------------------------------------------------

export interface NodeWithEdges {
  node: Node;
  edges: Edge[];
  connectedNodes: Pick<Node, 'id' | 'title' | 'type' | 'slug'>[];
}

/**
 * Fetch a node together with all its direct edges and the titles of connected
 * nodes. Useful for display and summarization.
 */
export async function getNodeWithEdges(
  supabase: SupabaseClient,
  nodeId: string,
): Promise<NodeWithEdges | null> {
  const node = await getNode(supabase, nodeId);
  if (!node) return null;

  // Fetch all edges where this node is source or target
  const [outgoing, incoming] = await Promise.all([
    mos(supabase).from('edges').select().eq('source_id', nodeId),
    mos(supabase).from('edges').select().eq('target_id', nodeId),
  ]);

  if (outgoing.error) throw outgoing.error;
  if (incoming.error) throw incoming.error;

  const allEdges = [...(outgoing.data ?? []), ...(incoming.data ?? [])] as Edge[];

  // Deduplicate
  const seenEdgeIds = new Set<string>();
  const edges = allEdges.filter((e) => {
    if (seenEdgeIds.has(e.id)) return false;
    seenEdgeIds.add(e.id);
    return true;
  });

  // Gather IDs of connected nodes (excluding the node itself)
  const connectedIds = new Set<string>();
  for (const edge of edges) {
    if (edge.source_id !== nodeId) connectedIds.add(edge.source_id);
    if (edge.target_id !== nodeId) connectedIds.add(edge.target_id);
  }

  let connectedNodes: Pick<Node, 'id' | 'title' | 'type' | 'slug'>[] = [];
  if (connectedIds.size > 0) {
    const { data, error } = await mos(supabase)
      .from('nodes')
      .select('id, title, type, slug')
      .in('id', Array.from(connectedIds));

    if (error) throw error;
    connectedNodes = (data ?? []) as Pick<Node, 'id' | 'title' | 'type' | 'slug'>[];
  }

  return { node, edges, connectedNodes };
}
