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
