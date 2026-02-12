import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createNode,
  updateNode,
  deleteNode,
  getNode,
  getNodeBySlug,
  listNodes,
  createEdge,
  deleteEdge,
  getConnections,
  getNodeWithEdges,
} from '../engine';
import type { Node, Edge } from '@arc/types';

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

function createChain(resolveWith: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['from', 'select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'or', 'order', 'range', 'limit'];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn().mockResolvedValue(resolveWith);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolveWith);
  // When awaited directly (like listNodes does)
  chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => resolve(resolveWith));
  return chain;
}

function createMockClient(chain: ReturnType<typeof createChain>) {
  return {
    schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(chain) }),
  } as unknown as Parameters<typeof createNode>[0];
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const nodeFixture: Node = {
  id: 'n1',
  user_id: 'u1',
  type: 'concept',
  slug: 'test',
  title: 'Test',
  content: null,
  summary: null,
  metadata: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const edgeFixture: Edge = {
  id: 'e1',
  user_id: 'u1',
  source_id: 'n1',
  target_id: 'n2',
  edge_type: 'related_to',
  custom_label: null,
  weight: 1.0,
  summary: null,
  metadata: {},
  created_at: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createNode', () => {
  it('returns the created node', async () => {
    const chain = createChain({ data: nodeFixture, error: null });
    const client = createMockClient(chain);
    const result = await createNode(client, {
      user_id: 'u1',
      type: 'concept',
      slug: 'test',
      title: 'Test',
    });
    expect(result).toEqual(nodeFixture);
    expect(chain.upsert).toHaveBeenCalled();
    expect(chain.single).toHaveBeenCalled();
  });

  it('throws on error', async () => {
    const chain = createChain({ data: null, error: { message: 'conflict' } });
    const client = createMockClient(chain);
    await expect(createNode(client, {
      user_id: 'u1', type: 'concept', slug: 'test', title: 'Test',
    })).rejects.toEqual({ message: 'conflict' });
  });
});

describe('updateNode', () => {
  it('returns the updated node', async () => {
    const updated = { ...nodeFixture, title: 'Updated' };
    const chain = createChain({ data: updated, error: null });
    const client = createMockClient(chain);
    const result = await updateNode(client, 'n1', { title: 'Updated' });
    expect(result.title).toBe('Updated');
    expect(chain.update).toHaveBeenCalled();
  });
});

describe('deleteNode', () => {
  it('completes without error', async () => {
    const chain = createChain({ data: null, error: null });
    // deleteNode doesn't call .single(), it awaits the chain directly
    chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
      resolve({ data: null, error: null }));
    const client = createMockClient(chain);
    await expect(deleteNode(client, 'n1')).resolves.toBeUndefined();
    expect(chain.delete).toHaveBeenCalled();
  });
});

describe('getNode', () => {
  it('returns a node when found', async () => {
    const chain = createChain({ data: nodeFixture, error: null });
    const client = createMockClient(chain);
    const result = await getNode(client, 'n1');
    expect(result).toEqual(nodeFixture);
  });

  it('returns null when not found', async () => {
    const chain = createChain({ data: null, error: null });
    const client = createMockClient(chain);
    const result = await getNode(client, 'n999');
    expect(result).toBeNull();
  });
});

describe('getNodeBySlug', () => {
  it('returns a node matching user_id and slug', async () => {
    const chain = createChain({ data: nodeFixture, error: null });
    const client = createMockClient(chain);
    const result = await getNodeBySlug(client, 'u1', 'test');
    expect(result).toEqual(nodeFixture);
    expect(chain.eq).toHaveBeenCalledTimes(2);
  });
});

describe('listNodes', () => {
  it('returns an array of nodes', async () => {
    const chain = createChain();
    chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
      resolve({ data: [nodeFixture], error: null }));
    const client = createMockClient(chain);
    const result = await listNodes(client);
    expect(result).toEqual([nodeFixture]);
  });

  it('filters by type', async () => {
    const chain = createChain();
    chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
      resolve({ data: [], error: null }));
    const client = createMockClient(chain);
    await listNodes(client, { type: 'concept' });
    expect(chain.eq).toHaveBeenCalledWith('type', 'concept');
  });

  it('searches by title or content', async () => {
    const chain = createChain();
    chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
      resolve({ data: [], error: null }));
    const client = createMockClient(chain);
    await listNodes(client, { search: 'test' });
    expect(chain.or).toHaveBeenCalled();
  });
});

describe('createEdge', () => {
  it('returns the created edge', async () => {
    const chain = createChain({ data: edgeFixture, error: null });
    const client = createMockClient(chain);
    const result = await createEdge(client, {
      user_id: 'u1',
      source_id: 'n1',
      target_id: 'n2',
      edge_type: 'related_to',
    });
    expect(result).toEqual(edgeFixture);
    expect(chain.insert).toHaveBeenCalled();
  });
});

describe('deleteEdge', () => {
  it('completes without error', async () => {
    const chain = createChain();
    chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
      resolve({ data: null, error: null }));
    const client = createMockClient(chain);
    await expect(deleteEdge(client, 'e1')).resolves.toBeUndefined();
  });
});

describe('getConnections', () => {
  it('returns depth-1 connections', async () => {
    const neighbor: Node = { ...nodeFixture, id: 'n2', title: 'Neighbor' };

    // We need to mock schema().from() to return different results for edges vs nodes
    const edgeResult = { data: [edgeFixture], error: null };
    const nodeResult = { data: [neighbor], error: null };

    let callCount = 0;
    const mockFrom = vi.fn().mockImplementation(() => {
      const chain = createChain();
      callCount++;
      // First two calls are for edges (outgoing + incoming for 'both' direction)
      // Third call is for fetching neighbor nodes
      if (callCount <= 2) {
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) => r(edgeResult));
      } else {
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) => r(nodeResult));
      }
      return chain;
    });

    const client = {
      schema: vi.fn().mockReturnValue({ from: mockFrom }),
    } as unknown as Parameters<typeof getConnections>[0];

    const result = await getConnections(client, 'n1', { depth: 1 });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].depth).toBe(1);
  });
});

describe('getNodeWithEdges', () => {
  it('returns null when node not found', async () => {
    const chain = createChain({ data: null, error: null });
    const client = createMockClient(chain);
    const result = await getNodeWithEdges(client, 'n999');
    expect(result).toBeNull();
  });

  it('returns node with edges and connected nodes', async () => {
    let callCount = 0;
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      callCount++;
      const chain = createChain();
      if (table === 'nodes' && callCount === 1) {
        // getNode call
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: nodeFixture, error: null });
      } else if (table === 'edges') {
        // outgoing or incoming edges — return edge on first, empty on second
        const isOutgoing = callCount === 2;
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({ data: isOutgoing ? [edgeFixture] : [], error: null }));
      } else if (table === 'nodes') {
        // connected nodes fetch
        chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
          r({ data: [{ id: 'n2', title: 'Neighbor', type: 'concept', slug: 'neighbor' }], error: null }));
      }
      return chain;
    });

    const client = {
      schema: vi.fn().mockReturnValue({ from: mockFrom }),
    } as unknown as Parameters<typeof getNodeWithEdges>[0];

    const result = await getNodeWithEdges(client, 'n1');
    expect(result).not.toBeNull();
    expect(result!.node).toEqual(nodeFixture);
    expect(result!.edges).toHaveLength(1);
    expect(result!.connectedNodes).toHaveLength(1);
  });
});
