import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock embeddings provider
const mockEmbed = vi.fn();
vi.mock('@arc/embeddings', () => ({
  createEmbeddingProvider: vi.fn().mockReturnValue({
    embed: (...args: unknown[]) => mockEmbed(...args),
  }),
}));

import { hybridSearch, searchNodes } from '../hybrid';
import type { Node } from '@arc/types';

function makeNode(id: string): Node {
  return {
    id,
    user_id: 'u1',
    type: 'concept',
    slug: id,
    title: `Node ${id}`,
    content: null,
    summary: null,
    metadata: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

function createMockClient(options: {
  rpcData?: unknown[];
  rpcError?: unknown;
  keywordData?: unknown[];
  keywordError?: unknown;
}) {
  const {
    rpcData = [],
    rpcError = null,
    keywordData = [],
    keywordError = null,
  } = options;

  const keywordChain: Record<string, unknown> = {};
  ['from', 'select', 'eq', 'textSearch', 'limit'].forEach((m) => {
    keywordChain[m] = vi.fn().mockReturnValue(keywordChain);
  });
  keywordChain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
    resolve({ data: keywordData, error: keywordError }));

  return {
    rpc: vi.fn().mockResolvedValue({ data: rpcData, error: rpcError }),
    schema: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(keywordChain),
    }),
  } as unknown as Parameters<typeof hybridSearch>[0];
}

describe('hybridSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('combines vector and keyword results', async () => {
    mockEmbed.mockResolvedValue([0.1, 0.2, 0.3]);

    const vectorRow = {
      ...makeNode('v1'),
      similarity: 0.9,
    };

    const client = createMockClient({
      rpcData: [vectorRow],
      keywordData: [makeNode('k1')],
    });

    const results = await hybridSearch(client, {
      query: 'test',
      userId: 'u1',
    });

    expect(results.length).toBeGreaterThan(0);
  });

  it('falls back to keyword-only when embedding fails', async () => {
    mockEmbed.mockRejectedValue(new Error('API key missing'));

    const client = createMockClient({
      keywordData: [makeNode('k1')],
    });

    const results = await hybridSearch(client, {
      query: 'test',
      userId: 'u1',
    });

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('keyword');
  });

  it('returns empty when no results from either source', async () => {
    mockEmbed.mockResolvedValue([0.1]);

    const client = createMockClient({});

    const results = await hybridSearch(client, {
      query: 'nonexistent',
      userId: 'u1',
    });

    expect(results).toEqual([]);
  });
});

describe('searchNodes', () => {
  it('returns keyword-only results', async () => {
    const node = makeNode('k1');

    const chain: Record<string, unknown> = {};
    ['from', 'select', 'eq', 'textSearch', 'limit'].forEach((m) => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });
    chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
      resolve({ data: [node], error: null }));

    const client = {
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue(chain),
      }),
    } as unknown as Parameters<typeof searchNodes>[0];

    const results = await searchNodes(client, {
      query: 'test',
      userId: 'u1',
    });

    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('keyword');
    expect(results[0].score).toBe(1);
  });
});
