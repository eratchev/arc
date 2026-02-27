import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockMessagesCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: mockMessagesCreate } };
  }),
}));

vi.mock('@/lib/graph/engine', () => ({
  getNodeWithEdges: vi.fn(),
  getConnections: vi.fn(),
}));

vi.mock('@/lib/search/hybrid', () => ({
  hybridSearch: vi.fn(),
}));

import { summarizeNode, whatDoIKnow, generateCribSheet } from '../index';
import { getNodeWithEdges, getConnections } from '@/lib/graph/engine';
import { hybridSearch } from '@/lib/search/hybrid';
import type { Node, Edge } from '@arc/types';
import type { NodeWithEdges } from '@/lib/graph/engine';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'n1',
    user_id: 'u1',
    type: 'concept',
    slug: 'caching',
    title: 'Caching',
    content: 'Content about caching.',
    summary: null,
    metadata: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeEdge(overrides: Partial<Edge> = {}): Edge {
  return {
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
    ...overrides,
  };
}

function makeNodeWithEdges(overrides: Partial<NodeWithEdges> = {}): NodeWithEdges {
  return {
    node: makeNode(),
    edges: [],
    connectedNodes: [],
    ...overrides,
  };
}

const mockSupabase = {} as Parameters<typeof whatDoIKnow>[0];

// ---------------------------------------------------------------------------
// chat() — tested indirectly through summarizeNode
// ---------------------------------------------------------------------------

describe('chat() (via summarizeNode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('throws when ANTHROPIC_API_KEY is not set', async () => {
    await expect(summarizeNode(makeNodeWithEdges())).rejects.toThrow(
      'ANTHROPIC_API_KEY is required for summarization',
    );
  });

  it('throws when Claude returns no text content', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockMessagesCreate.mockResolvedValue({ content: [{ type: 'tool_use', id: 'x' }] });
    await expect(summarizeNode(makeNodeWithEdges())).rejects.toThrow(
      'Claude returned no text content.',
    );
  });

  it('returns the text content from Claude', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'A summary of caching.' }],
    });
    const result = await summarizeNode(makeNodeWithEdges());
    expect(result).toBe('A summary of caching.');
  });
});

// ---------------------------------------------------------------------------
// summarizeNode
// ---------------------------------------------------------------------------

describe('summarizeNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('calls Claude with node and edge context', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Summary text.' }],
    });

    const nwe = makeNodeWithEdges({
      edges: [makeEdge()],
      connectedNodes: [makeNode({ id: 'n2', title: 'Redis', slug: 'redis' })],
    });

    await summarizeNode(nwe);

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const call = mockMessagesCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain('Caching');
    expect(call.messages[0].content).toContain('Redis');
  });
});

// ---------------------------------------------------------------------------
// whatDoIKnow
// ---------------------------------------------------------------------------

describe('whatDoIKnow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('returns early message when no nodes found', async () => {
    vi.mocked(hybridSearch).mockResolvedValue([]);
    const result = await whatDoIKnow(mockSupabase, 'u1', 'distributed tracing');
    expect(result).toContain('distributed tracing');
    expect(result).toContain("don't have any nodes");
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('calls Claude with search results when nodes found', async () => {
    vi.mocked(hybridSearch).mockResolvedValue([
      { node: makeNode(), score: 0.9 },
    ]);
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Here is what you know about caching.' }],
    });

    const result = await whatDoIKnow(mockSupabase, 'u1', 'caching');

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const call = mockMessagesCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain('caching');
    expect(call.messages[0].content).toContain('Caching');
    expect(result).toBe('Here is what you know about caching.');
  });
});

// ---------------------------------------------------------------------------
// generateCribSheet
// ---------------------------------------------------------------------------

describe('generateCribSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('throws when node not found', async () => {
    vi.mocked(getNodeWithEdges).mockResolvedValue(null);
    await expect(generateCribSheet(mockSupabase, 'u1', 'n-missing')).rejects.toThrow(
      'Node n-missing not found.',
    );
  });

  it('calls Claude with graph context and returns crib sheet', async () => {
    const root = makeNodeWithEdges();
    const neighbor = makeNodeWithEdges({ node: makeNode({ id: 'n2', title: 'Redis', slug: 'redis' }) });

    vi.mocked(getNodeWithEdges)
      .mockResolvedValueOnce(root)    // root node
      .mockResolvedValueOnce(neighbor); // direct neighbor detail

    vi.mocked(getConnections).mockResolvedValue([
      { edge: makeEdge(), node: makeNode({ id: 'n2', title: 'Redis', slug: 'redis' }), depth: 1 },
    ]);

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '## Overview\nCaching is important.' }],
    });

    const result = await generateCribSheet(mockSupabase, 'u1', 'n1');

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    const call = mockMessagesCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain('Central Node');
    expect(call.messages[0].content).toContain('Caching');
    expect(result).toContain('## Overview');
  });

  it('includes extended network section when depth-2 nodes exist', async () => {
    const root = makeNodeWithEdges();

    vi.mocked(getNodeWithEdges).mockResolvedValue(root);
    vi.mocked(getConnections).mockResolvedValue([
      { edge: makeEdge(), node: makeNode({ id: 'n2', title: 'Redis', slug: 'redis' }), depth: 1 },
      { edge: makeEdge({ id: 'e2' }), node: makeNode({ id: 'n3', title: 'Memcached', slug: 'memcached' }), depth: 2 },
    ]);

    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Crib sheet content.' }],
    });

    await generateCribSheet(mockSupabase, 'u1', 'n1');

    const call = mockMessagesCreate.mock.calls[0][0];
    expect(call.messages[0].content).toContain('Extended Network');
    expect(call.messages[0].content).toContain('Memcached');
  });
});
