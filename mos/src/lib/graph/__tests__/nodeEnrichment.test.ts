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

  it('throws generic message when server error has no message', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    await expect(addEdgeFromUI('src', 'tgt', 'related_to')).rejects.toThrow('Failed to add connection');
  });
});

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

  it('throws generic message when server error has no message', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    await expect(removeEdgeFromUI('e1')).rejects.toThrow('Failed to remove connection');
  });
});

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
