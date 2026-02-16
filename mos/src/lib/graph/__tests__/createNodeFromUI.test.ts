import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNodeFromUI } from '../createNodeFromUI';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('createNodeFromUI', () => {
  it('posts title and type to /api/nodes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ node: { id: '1', title: 'Redis', type: 'concept' } }),
    });

    const result = await createNodeFromUI('Redis', 'concept');

    expect(mockFetch).toHaveBeenCalledWith('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Redis', type: 'concept' }),
    });
    expect(result).toEqual({ node: { id: '1', title: 'Redis', type: 'concept' } });
  });

  it('trims the title before sending', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ node: { id: '1', title: 'Redis', type: 'concept' } }),
    });

    await createNodeFromUI('  Redis  ', 'concept');

    expect(mockFetch).toHaveBeenCalledWith('/api/nodes', expect.objectContaining({
      body: JSON.stringify({ title: 'Redis', type: 'concept' }),
    }));
  });

  it('throws if title is empty or whitespace', async () => {
    await expect(createNodeFromUI('', 'concept')).rejects.toThrow('Title is required');
    await expect(createNodeFromUI('   ', 'concept')).rejects.toThrow('Title is required');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws with server error message on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Duplicate slug' }),
    });

    await expect(createNodeFromUI('Redis', 'concept')).rejects.toThrow('Duplicate slug');
  });

  it('throws generic message when server error has no message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    await expect(createNodeFromUI('Redis', 'concept')).rejects.toThrow('Failed to create node');
  });
});
