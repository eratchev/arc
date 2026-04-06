import type { NodeType, EdgeType } from '@arc/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Connection {
  edgeId: string | null; // null for newly added connections not yet saved
  edgeType: string;
  nodeId: string;
  nodeTitle: string;
  direction: 'outgoing' | 'incoming';
}

export interface UpdateNodePayload {
  title?: string;
  type?: NodeType;
  summary?: string | null;
  content?: string | null;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Node update
// ---------------------------------------------------------------------------

export async function updateNodeFromUI(
  id: string,
  updates: UpdateNodePayload,
): Promise<void> {
  const res = await fetch(`/api/nodes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? 'Failed to update node');
  }
}

// ---------------------------------------------------------------------------
// Edge management
// ---------------------------------------------------------------------------

export async function addEdgeFromUI(
  sourceId: string,
  targetId: string,
  edgeType: EdgeType,
): Promise<{ edge: { id: string } }> {
  const res = await fetch('/api/edges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_id: sourceId, target_id: targetId, edge_type: edgeType }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? 'Failed to add connection');
  }
  return res.json();
}

export async function removeEdgeFromUI(edgeId: string): Promise<void> {
  const res = await fetch(`/api/edges?id=${edgeId}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? 'Failed to remove connection');
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchNodesFromUI(
  query: string,
): Promise<{ id: string; title: string; type: string }[]> {
  if (!query.trim()) return [];
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

// ---------------------------------------------------------------------------
// Save diff
// ---------------------------------------------------------------------------

export interface SaveActions {
  edgeIdsToDelete: string[];
  edgesToAdd: Connection[];
}

/**
 * Compute which edges to delete and which to add based on the diff between
 * the original server-fetched connections and the current local state.
 *
 * @param original - connections as fetched from the server
 * @param removedEdgeIds - set of edge IDs the user has removed in the UI
 * @param addedConnections - connections the user has added (edgeId === null)
 */
export function computeSaveActions(
  original: Connection[],
  removedEdgeIds: Set<string>,
  addedConnections: Connection[],
): SaveActions {
  const edgeIdsToDelete = original
    .filter((c) => c.edgeId !== null && removedEdgeIds.has(c.edgeId as string))
    .map((c) => c.edgeId as string);
  return { edgeIdsToDelete, edgesToAdd: addedConnections };
}
