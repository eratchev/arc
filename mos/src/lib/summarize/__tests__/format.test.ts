import { describe, it, expect } from 'vitest';
import { formatNodeForPrompt, formatNodeWithEdgesForPrompt } from '../index';
import type { Node, Edge } from '@arc/types';
import type { NodeWithEdges } from '@/lib/graph/engine';

function makeNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'n1',
    user_id: 'u1',
    type: 'concept',
    slug: 'test-node',
    title: 'Test Node',
    content: null,
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

describe('formatNodeForPrompt', () => {
  it('includes title and type', () => {
    const result = formatNodeForPrompt(makeNode());
    expect(result).toBe('# Test Node (concept)');
  });

  it('includes summary when present', () => {
    const result = formatNodeForPrompt(makeNode({ summary: 'A brief summary.' }));
    expect(result).toContain('Summary: A brief summary.');
  });

  it('includes content when present', () => {
    const result = formatNodeForPrompt(makeNode({ content: 'Full content here.' }));
    expect(result).toContain('Full content here.');
  });

  it('includes both summary and content', () => {
    const result = formatNodeForPrompt(makeNode({
      summary: 'Summary text',
      content: 'Content text',
    }));
    const lines = result.split('\n');
    expect(lines[0]).toBe('# Test Node (concept)');
    expect(lines[1]).toBe('Summary: Summary text');
    expect(lines[2]).toBe('Content text');
  });

  it('omits summary and content when null', () => {
    const result = formatNodeForPrompt(makeNode());
    expect(result).toBe('# Test Node (concept)');
  });
});

describe('formatNodeWithEdgesForPrompt', () => {
  it('renders node without edges', () => {
    const nwe: NodeWithEdges = {
      node: makeNode(),
      edges: [],
      connectedNodes: [],
    };
    const result = formatNodeWithEdgesForPrompt(nwe);
    expect(result).toBe('# Test Node (concept)');
    expect(result).not.toContain('Connections');
  });

  it('renders outgoing edges with ->', () => {
    const nwe: NodeWithEdges = {
      node: makeNode({ id: 'n1' }),
      edges: [makeEdge({ source_id: 'n1', target_id: 'n2', edge_type: 'related_to', weight: 0.5 })],
      connectedNodes: [{ id: 'n2', title: 'Other', type: 'concept', slug: 'other' }],
    };
    const result = formatNodeWithEdgesForPrompt(nwe);
    expect(result).toContain('->');
    expect(result).toContain('[related_to, weight=0.5]');
    expect(result).toContain('Other (concept)');
  });

  it('renders incoming edges with <-', () => {
    const nwe: NodeWithEdges = {
      node: makeNode({ id: 'n2' }),
      edges: [makeEdge({ source_id: 'n1', target_id: 'n2', edge_type: 'depends_on' })],
      connectedNodes: [{ id: 'n1', title: 'Source', type: 'pattern', slug: 'source' }],
    };
    const result = formatNodeWithEdgesForPrompt(nwe);
    expect(result).toContain('<-');
    expect(result).toContain('[depends_on, weight=1]');
    expect(result).toContain('Source (pattern)');
  });

  it('uses custom_label for custom edge types', () => {
    const nwe: NodeWithEdges = {
      node: makeNode({ id: 'n1' }),
      edges: [makeEdge({ source_id: 'n1', target_id: 'n2', edge_type: 'custom', custom_label: 'inspired_by' })],
      connectedNodes: [{ id: 'n2', title: 'Target', type: 'note', slug: 'target' }],
    };
    const result = formatNodeWithEdgesForPrompt(nwe);
    expect(result).toContain('[inspired_by');
  });

  it('falls back to "custom" when custom_label is null', () => {
    const nwe: NodeWithEdges = {
      node: makeNode({ id: 'n1' }),
      edges: [makeEdge({ source_id: 'n1', target_id: 'n2', edge_type: 'custom', custom_label: null })],
      connectedNodes: [{ id: 'n2', title: 'Target', type: 'note', slug: 'target' }],
    };
    const result = formatNodeWithEdgesForPrompt(nwe);
    expect(result).toContain('[custom,');
  });

  it('shows node id when connected node not found', () => {
    const nwe: NodeWithEdges = {
      node: makeNode({ id: 'n1' }),
      edges: [makeEdge({ source_id: 'n1', target_id: 'n99' })],
      connectedNodes: [],
    };
    const result = formatNodeWithEdgesForPrompt(nwe);
    expect(result).toContain('n99');
  });
});
