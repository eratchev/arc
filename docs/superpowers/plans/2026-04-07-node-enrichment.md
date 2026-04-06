# Node Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to edit node fields and manage connections (edges) directly from the MOS node detail page via inline edit mode.

**Architecture:** The node detail page stays a Server Component for data fetching. It passes node + connections (with edge IDs) to a new `NodeDetail` client component that owns all edit state. Three client-side fetch helpers (`updateNodeFromUI`, `addEdgeFromUI`, `removeEdgeFromUI`) mirror the existing `createNodeFromUI` pattern. One new API endpoint — `PATCH /api/nodes/[id]` — handles node field updates; edge creation and deletion endpoints already exist.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (RLS via session JWT), Vitest, Tailwind CSS.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `mos/src/app/api/nodes/[id]/route.ts` | PATCH endpoint — update node fields |
| Create | `mos/src/app/api/nodes/[id]/__tests__/route.test.ts` | Tests for PATCH |
| Create | `mos/src/lib/graph/nodeEnrichment.ts` | Client helpers + `Connection` type + `computeSaveActions` |
| Create | `mos/src/lib/graph/__tests__/nodeEnrichment.test.ts` | Tests for helpers and save logic |
| Create | `mos/src/components/NodeDetail.tsx` | Client component — inline edit UI |
| Modify | `mos/src/app/node/[id]/page.tsx` | Pass `Connection[]` (with edge IDs) to NodeDetail |

---

## Task 1: PATCH /api/nodes/[id]

**Files:**
- Create: `mos/src/app/api/nodes/[id]/__tests__/route.test.ts`
- Create: `mos/src/app/api/nodes/[id]/route.ts`

- [ ] **Step 1.1: Write the failing tests**

Create `mos/src/app/api/nodes/[id]/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

let authUser: { id: string } | null = { id: 'u1' };

const { mockUpdateNode } = vi.hoisted(() => ({
  mockUpdateNode: vi.fn(),
}));

vi.mock('@/lib/graph/engine', () => ({
  updateNode: (...args: unknown[]) => mockUpdateNode(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(async () => ({
    auth: {
      getUser: vi.fn().mockImplementation(() =>
        Promise.resolve({ data: { user: authUser }, error: null }),
      ),
    },
  })),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn().mockImplementation((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

import { PATCH } from '../route';

function makeRequest(body: unknown) {
  return { json: () => Promise.resolve(body) } as unknown as import('next/server').NextRequest;
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/nodes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser = { id: 'u1' };
  });

  it('returns 401 when not authenticated', async () => {
    authUser = null;
    const res = await PATCH(makeRequest({}), makeContext('n1'));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('updates provided fields and returns the node', async () => {
    const updated = { id: 'n1', title: 'New Title', type: 'concept' };
    mockUpdateNode.mockResolvedValue(updated);

    const res = await PATCH(makeRequest({ title: 'New Title' }), makeContext('n1'));

    expect(mockUpdateNode).toHaveBeenCalledWith(
      expect.anything(),
      'n1',
      { title: 'New Title' },
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ node: updated });
  });

  it('handles partial update with only summary', async () => {
    const updated = { id: 'n1', summary: 'New summary' };
    mockUpdateNode.mockResolvedValue(updated);

    await PATCH(makeRequest({ summary: 'New summary' }), makeContext('n1'));

    expect(mockUpdateNode).toHaveBeenCalledWith(
      expect.anything(),
      'n1',
      { summary: 'New summary' },
    );
  });

  it('returns 404 when node not found (PGRST116)', async () => {
    mockUpdateNode.mockRejectedValue({ code: 'PGRST116' });

    const res = await PATCH(makeRequest({ title: 'X' }), makeContext('missing'));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('returns 500 on unexpected error', async () => {
    mockUpdateNode.mockRejectedValue(new Error('DB down'));

    const res = await PATCH(makeRequest({ title: 'X' }), makeContext('n1'));

    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — "Cannot find module '../route'"

- [ ] **Step 1.3: Implement the PATCH route**

Create `mos/src/app/api/nodes/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { updateNode } from '@/lib/graph/engine';
import type { UpdateNodeInput } from '@/lib/graph/engine';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { title, type, summary, content } = body;

  const updates: UpdateNodeInput = {};
  if (title !== undefined) updates.title = title;
  if (type !== undefined) updates.type = type;
  if (summary !== undefined) updates.summary = summary;
  if (content !== undefined) updates.content = content;

  try {
    const node = await updateNode(supabase, id, updates);
    return NextResponse.json({ node });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'PGRST116') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 1.4: Run tests to confirm they pass**

```bash
npm test -- mos/src/app/api/nodes/\\[id\\]/__tests__/route.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 1.5: Commit**

```bash
git add mos/src/app/api/nodes/\[id\]/route.ts mos/src/app/api/nodes/\[id\]/__tests__/route.test.ts
git commit -m "Add PATCH /api/nodes/[id] endpoint"
```

---

## Task 2: Client-side enrichment helpers

**Files:**
- Create: `mos/src/lib/graph/__tests__/nodeEnrichment.test.ts`
- Create: `mos/src/lib/graph/nodeEnrichment.ts`

- [ ] **Step 2.1: Write the failing tests**

Create `mos/src/lib/graph/__tests__/nodeEnrichment.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateNodeFromUI,
  addEdgeFromUI,
  removeEdgeFromUI,
  searchNodesFromUI,
  computeSaveActions,
} from '../nodeEnrichment';
import type { Connection } from '../nodeEnrichment';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// updateNodeFromUI
// ---------------------------------------------------------------------------

describe('updateNodeFromUI', () => {
  it('sends PATCH to /api/nodes/:id with updates', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ node: {} }) });

    await updateNodeFromUI('n1', { title: 'New title' });

    expect(mockFetch).toHaveBeenCalledWith('/api/nodes/n1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New title' }),
    });
  });

  it('throws with server error message on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found' }),
    });

    await expect(updateNodeFromUI('n1', { title: 'X' })).rejects.toThrow('Not found');
  });

  it('throws generic message when server error has no message', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    await expect(updateNodeFromUI('n1', {})).rejects.toThrow('Failed to update node');
  });
});

// ---------------------------------------------------------------------------
// addEdgeFromUI
// ---------------------------------------------------------------------------

describe('addEdgeFromUI', () => {
  it('sends POST to /api/edges with source, target, type', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ edge: { id: 'e1' } }),
    });

    const result = await addEdgeFromUI('src', 'tgt', 'related_to');

    expect(mockFetch).toHaveBeenCalledWith('/api/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: 'src', target_id: 'tgt', edge_type: 'related_to' }),
    });
    expect(result).toEqual({ edge: { id: 'e1' } });
  });

  it('throws on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Duplicate edge' }),
    });

    await expect(addEdgeFromUI('src', 'tgt', 'related_to')).rejects.toThrow('Duplicate edge');
  });
});

// ---------------------------------------------------------------------------
// removeEdgeFromUI
// ---------------------------------------------------------------------------

describe('removeEdgeFromUI', () => {
  it('sends DELETE to /api/edges?id=:edgeId', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await removeEdgeFromUI('e1');

    expect(mockFetch).toHaveBeenCalledWith('/api/edges?id=e1', { method: 'DELETE' });
  });

  it('throws on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Edge not found' }),
    });

    await expect(removeEdgeFromUI('e1')).rejects.toThrow('Edge not found');
  });
});

// ---------------------------------------------------------------------------
// searchNodesFromUI
// ---------------------------------------------------------------------------

describe('searchNodesFromUI', () => {
  it('returns results from /api/search', async () => {
    const results = [{ id: 'n1', title: 'Redis', type: 'concept' }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results }),
    });

    const out = await searchNodesFromUI('redis');

    expect(mockFetch).toHaveBeenCalledWith('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'redis' }),
    });
    expect(out).toEqual(results);
  });

  it('returns empty array for blank query without fetching', async () => {
    const out = await searchNodesFromUI('   ');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(out).toEqual([]);
  });

  it('returns empty array on fetch failure', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const out = await searchNodesFromUI('redis');
    expect(out).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeSaveActions
// ---------------------------------------------------------------------------

describe('computeSaveActions', () => {
  const conn = (edgeId: string | null, nodeId: string): Connection => ({
    edgeId,
    edgeType: 'related_to',
    nodeId,
    nodeTitle: nodeId,
    direction: 'outgoing',
  });

  it('returns no actions when nothing changed', () => {
    const original = [conn('e1', 'n2'), conn('e2', 'n3')];
    const { edgeIdsToDelete, edgesToAdd } = computeSaveActions(original, new Set(), []);
    expect(edgeIdsToDelete).toEqual([]);
    expect(edgesToAdd).toEqual([]);
  });

  it('identifies removed edges', () => {
    const original = [conn('e1', 'n2'), conn('e2', 'n3')];
    const { edgeIdsToDelete } = computeSaveActions(original, new Set(['e1']), []);
    expect(edgeIdsToDelete).toEqual(['e1']);
  });

  it('identifies added connections', () => {
    const original = [conn('e1', 'n2')];
    const added = [conn(null, 'n4')];
    const { edgesToAdd } = computeSaveActions(original, new Set(), added);
    expect(edgesToAdd).toEqual(added);
  });

  it('handles both adds and removes simultaneously', () => {
    const original = [conn('e1', 'n2'), conn('e2', 'n3')];
    const added = [conn(null, 'n5')];
    const { edgeIdsToDelete, edgesToAdd } = computeSaveActions(original, new Set(['e2']), added);
    expect(edgeIdsToDelete).toEqual(['e2']);
    expect(edgesToAdd).toEqual(added);
  });
});
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — "Cannot find module '../nodeEnrichment'"

- [ ] **Step 2.3: Implement the helpers**

Create `mos/src/lib/graph/nodeEnrichment.ts`:

```typescript
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
 * @param original  - connections as fetched from the server
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
```

- [ ] **Step 2.4: Run tests to confirm they pass**

```bash
npm test -- mos/src/lib/graph/__tests__/nodeEnrichment.test.ts
```

Expected: all 12 tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add mos/src/lib/graph/nodeEnrichment.ts mos/src/lib/graph/__tests__/nodeEnrichment.test.ts
git commit -m "Add nodeEnrichment helpers and Connection type"
```

---

## Task 3: NodeDetail client component

**Files:**
- Create: `mos/src/components/NodeDetail.tsx`

No separate test file — the component uses only the helpers tested in Task 2 and the API tested in Task 1. The save logic is covered by `computeSaveActions` tests.

- [ ] **Step 3.1: Create NodeDetail.tsx**

Create `mos/src/components/NodeDetail.tsx`:

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Node, NodeType, EdgeType } from '@arc/types';
import {
  updateNodeFromUI,
  addEdgeFromUI,
  removeEdgeFromUI,
  searchNodesFromUI,
  computeSaveActions,
  type Connection,
} from '@/lib/graph/nodeEnrichment';

const NODE_TYPES: NodeType[] = [
  'concept', 'pattern', 'domain', 'person', 'org', 'project', 'note', 'artifact',
];

const EDGE_TYPES: EdgeType[] = [
  'related_to', 'used_in', 'practiced_at', 'knows', 'prepared_for',
  'works_at', 'authored', 'read', 'connected_to', 'depends_on', 'part_of', 'custom',
];

const TYPE_BADGE: Record<string, string> = {
  person: 'bg-amber-900 text-amber-200',
  project: 'bg-blue-900 text-blue-200',
  note: 'bg-violet-900 text-violet-200',
  org: 'bg-cyan-900 text-cyan-200',
  concept: 'bg-emerald-900 text-emerald-200',
  pattern: 'bg-pink-900 text-pink-200',
  domain: 'bg-orange-900 text-orange-200',
  artifact: 'bg-red-900 text-red-200',
};

interface Props {
  node: Node;
  connections: Connection[];
}

export function NodeDetail({ node, connections: initialConnections }: Props) {
  const router = useRouter();

  // Edit mode
  const [editing, setEditing] = useState(false);

  // Editable node fields
  const [title, setTitle] = useState(node.title);
  const [type, setType] = useState<NodeType>(node.type);
  const [summary, setSummary] = useState(node.summary ?? '');
  const [content, setContent] = useState(node.content ?? '');

  // Connection diff tracking
  const [removedEdgeIds, setRemovedEdgeIds] = useState<Set<string>>(new Set());
  const [addedConnections, setAddedConnections] = useState<Connection[]>([]);

  // Add-connection form
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; type: string }[]>([]);
  const [pendingTarget, setPendingTarget] = useState<{ id: string; title: string } | null>(null);
  const [pendingEdgeType, setPendingEdgeType] = useState<EdgeType>('related_to');

  // Save state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced node search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const connectedIds = new Set([
      ...initialConnections.map((c) => c.nodeId),
      ...addedConnections.map((c) => c.nodeId),
    ]);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchNodesFromUI(searchQuery);
      setSearchResults(
        results.filter((r) => r.id !== node.id && !connectedIds.has(r.id)),
      );
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, initialConnections, addedConnections, node.id]);

  function handleCancel() {
    setTitle(node.title);
    setType(node.type);
    setSummary(node.summary ?? '');
    setContent(node.content ?? '');
    setRemovedEdgeIds(new Set());
    setAddedConnections([]);
    setSearchQuery('');
    setSearchResults([]);
    setPendingTarget(null);
    setPendingEdgeType('related_to');
    setError(null);
    setEditing(false);
  }

  function handleRemoveConnection(edgeId: string | null, addedIndex: number | null) {
    if (edgeId !== null) {
      setRemovedEdgeIds((prev) => new Set([...prev, edgeId]));
    } else if (addedIndex !== null) {
      setAddedConnections((prev) => prev.filter((_, i) => i !== addedIndex));
    }
  }

  function handleAddConnection() {
    if (!pendingTarget) return;
    setAddedConnections((prev) => [
      ...prev,
      {
        edgeId: null,
        edgeType: pendingEdgeType,
        nodeId: pendingTarget.id,
        nodeTitle: pendingTarget.title,
        direction: 'outgoing',
      },
    ]);
    setPendingTarget(null);
    setSearchQuery('');
    setSearchResults([]);
    setPendingEdgeType('related_to');
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const { edgeIdsToDelete, edgesToAdd } = computeSaveActions(
        initialConnections,
        removedEdgeIds,
        addedConnections,
      );
      const nodeChanged =
        title !== node.title ||
        type !== node.type ||
        summary !== (node.summary ?? '') ||
        content !== (node.content ?? '');

      await Promise.all([
        nodeChanged
          ? updateNodeFromUI(node.id, {
              title,
              type,
              summary: summary || null,
              content: content || null,
            })
          : Promise.resolve(),
        ...edgesToAdd.map((c) =>
          addEdgeFromUI(
            c.direction === 'outgoing' ? node.id : c.nodeId,
            c.direction === 'outgoing' ? c.nodeId : node.id,
            c.edgeType as EdgeType,
          ),
        ),
        ...edgeIdsToDelete.map(removeEdgeFromUI),
      ]);

      router.refresh();
      setEditing(false);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // Derive displayed connections from server data + local diff
  const visibleOriginal = initialConnections.filter(
    (c) => c.edgeId === null || !removedEdgeIds.has(c.edgeId),
  );
  const displayedConnections = [...visibleOriginal, ...addedConnections];

  // Group by edge type for read mode
  const grouped = new Map<string, Connection[]>();
  for (const conn of displayedConnections) {
    const existing = grouped.get(conn.edgeType) ?? [];
    existing.push(conn);
    grouped.set(conn.edgeType, existing);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Navigation */}
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          &larr; Back to graph
        </Link>
        <Link
          href={`/?focus=${node.id}`}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          View in graph
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          {editing ? (
            <>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as NodeType)}
                className="rounded-lg bg-gray-800 border border-gray-700 px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {NODE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold">{node.title}</h1>
              <span
                className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                  TYPE_BADGE[node.type] ?? 'bg-gray-800 text-gray-300'
                }`}
              >
                {node.type}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="ml-auto rounded-lg bg-gray-800 px-3 py-1 text-sm hover:bg-gray-700 transition-colors"
              >
                Edit
              </button>
            </>
          )}
        </div>
        <p className="text-sm text-gray-500">
          Updated {new Date(node.updated_at).toLocaleDateString()}
        </p>
      </div>

      {/* Summary */}
      <div className="mb-8">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Summary
        </h2>
        {editing ? (
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="A brief description of this node…"
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : node.summary ? (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-gray-300">{node.summary}</p>
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="mb-8">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
          Content
        </h2>
        {editing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="Full content, notes, or details…"
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : node.content ? (
          <pre className="whitespace-pre-wrap text-gray-300 font-sans text-sm leading-relaxed">
            {node.content}
          </pre>
        ) : null}
      </div>

      {/* Connections */}
      <div className="mb-8">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
          Connections
        </h2>

        {editing ? (
          <div className="space-y-1 mb-4">
            {displayedConnections.map((conn, i) => {
              const isAdded = conn.edgeId === null;
              const addedIndex = isAdded
                ? addedConnections.findIndex(
                    (c) => c.nodeId === conn.nodeId && c.edgeType === conn.edgeType,
                  )
                : null;
              return (
                <div
                  key={conn.edgeId ?? `added-${i}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-900"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {conn.direction === 'outgoing' ? '→' : '←'}
                    </span>
                    <span className="text-sm text-gray-200">{conn.nodeTitle}</span>
                    <span className="text-xs text-gray-500 italic">
                      {conn.edgeType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveConnection(conn.edgeId, addedIndex)}
                    className="text-gray-500 hover:text-red-400 transition-colors px-1"
                    aria-label={`Remove connection to ${conn.nodeTitle}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        ) : grouped.size > 0 ? (
          <div className="space-y-4 mb-4">
            {[...grouped.entries()].map(([edgeType, conns]) => (
              <div key={edgeType}>
                <h3 className="text-sm font-medium text-gray-300 mb-2 capitalize">
                  {edgeType.replace(/_/g, ' ')}
                </h3>
                <div className="space-y-1">
                  {conns.map((conn) => (
                    <Link
                      key={conn.edgeId ?? conn.nodeId}
                      href={`/node/${conn.nodeId}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-900 transition-colors"
                    >
                      <span className="text-xs text-gray-500">
                        {conn.direction === 'outgoing' ? '→' : '←'}
                      </span>
                      <span className="text-sm">{conn.nodeTitle}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Add connection form (edit mode only) */}
        {editing && (
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-3 space-y-2">
            <p className="text-xs text-gray-400 font-medium">Add connection</p>
            <div className="relative">
              <input
                value={pendingTarget ? pendingTarget.title : searchQuery}
                onChange={(e) => {
                  setPendingTarget(null);
                  setSearchQuery(e.target.value);
                }}
                placeholder="Search for a node…"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchResults.length > 0 && !pendingTarget && (
                <ul className="absolute z-10 w-full mt-1 rounded-lg border border-gray-700 bg-gray-900 shadow-lg overflow-hidden">
                  {searchResults.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => {
                          setPendingTarget({ id: r.id, title: r.title });
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-800 transition-colors"
                      >
                        <span className="text-gray-200">{r.title}</span>
                        <span className="text-xs text-gray-500">{r.type}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pendingEdgeType}
                onChange={(e) => setPendingEdgeType(e.target.value as EdgeType)}
                className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {EDGE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <button
                onClick={handleAddConnection}
                disabled={!pendingTarget}
                className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Footer actions */}
      {editing ? (
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-3">
          <Link
            href={`/crib/${node.id}`}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg transition-colors"
          >
            Generate crib sheet
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3.2: Confirm the file has no TypeScript errors**

```bash
npm test
```

Expected: all tests pass. If TypeScript errors appear in the test output, fix them before continuing.

- [ ] **Step 3.3: Commit**

```bash
git add mos/src/components/NodeDetail.tsx
git commit -m "Add NodeDetail client component with inline edit mode"
```

---

## Task 4: Wire up the page

**Files:**
- Modify: `mos/src/app/node/[id]/page.tsx`

- [ ] **Step 4.1: Replace page.tsx**

Replace the entire contents of `mos/src/app/node/[id]/page.tsx` with:

```typescript
import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { NodeDetail } from "@/components/NodeDetail";
import type { Connection } from "@/lib/graph/nodeEnrichment";

export default async function NodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Please sign in to view this node.</p>
      </div>
    );
  }

  const { data: node } = await supabase
    .schema("mos")
    .from("nodes")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!node) {
    notFound();
  }

  // Fetch edges
  const { data: outgoingEdges } = await supabase
    .schema("mos")
    .from("edges")
    .select("id, edge_type, target_id")
    .eq("source_id", id)
    .eq("user_id", user.id);

  const { data: incomingEdges } = await supabase
    .schema("mos")
    .from("edges")
    .select("id, edge_type, source_id")
    .eq("target_id", id)
    .eq("user_id", user.id);

  // Resolve connected node titles
  const connectedIds = [
    ...(outgoingEdges ?? []).map((e) => e.target_id),
    ...(incomingEdges ?? []).map((e) => e.source_id),
  ];

  const { data: connectedNodes } =
    connectedIds.length > 0
      ? await supabase
          .schema("mos")
          .from("nodes")
          .select("id, title")
          .in("id", connectedIds)
      : { data: [] };

  const titleMap = new Map(
    (connectedNodes ?? []).map((n: { id: string; title: string }) => [n.id, n.title]),
  );

  const connections: Connection[] = [
    ...(outgoingEdges ?? []).map((e) => ({
      edgeId: e.id,
      edgeType: e.edge_type,
      nodeId: e.target_id,
      nodeTitle: titleMap.get(e.target_id) ?? "Unknown",
      direction: "outgoing" as const,
    })),
    ...(incomingEdges ?? []).map((e) => ({
      edgeId: e.id,
      edgeType: e.edge_type,
      nodeId: e.source_id,
      nodeTitle: titleMap.get(e.source_id) ?? "Unknown",
      direction: "incoming" as const,
    })),
  ];

  return <NodeDetail node={node} connections={connections} />;
}
```

- [ ] **Step 4.2: Run all tests to confirm nothing regressed**

```bash
cd /path/to/arc && npm test
```

Expected: all existing tests pass. The new tests added in Tasks 1 and 2 also pass.

- [ ] **Step 4.3: Commit**

```bash
git add mos/src/app/node/\[id\]/page.tsx
git commit -m "Wire NodeDetail into node page, pass connections with edge IDs"
```

---

## Task 5: Final type check and full test run

- [ ] **Step 5.1: Type-check both apps**

```bash
npx tsc --project mos/tsconfig.json --noEmit && echo "MOS: OK"
npx tsc --project sds/tsconfig.json --noEmit && echo "SDS: OK"
```

Expected: "MOS: OK" and "SDS: OK" with no errors.

- [ ] **Step 5.2: Run all tests**

```bash
npm test
```

Expected: all tests pass (134+ tests).

- [ ] **Step 5.3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "Fix type errors from node enrichment implementation"
```
