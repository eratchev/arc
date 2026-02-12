import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to track calls to from() to return different data for 'nodes' vs 'edges'
let fromResults: Record<string, { data: unknown; error: unknown }>;

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(async () => {
    function makeChain(tableName: string) {
      const chain: Record<string, unknown> = {};
      ['select', 'eq', 'order', 'limit'].forEach((m) => {
        chain[m] = vi.fn().mockReturnValue(chain);
      });
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
        resolve(fromResults[tableName] ?? { data: null, error: null }));
      return chain;
    }

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: fromResults._user ?? null },
          error: null,
        }),
      },
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => makeChain(table)),
      }),
    };
  }),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn().mockImplementation((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

import { GET } from '../route';

describe('GET /api/suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
    fromResults = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 401 when not authenticated', async () => {
    fromResults = { _user: null } as typeof fromResults;
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns empty suggestions when no concepts exist', async () => {
    fromResults = {
      _user: { id: 'u1' },
      nodes: { data: [], error: null },
      edges: { data: [], error: null },
    } as typeof fromResults;

    const response = await GET();
    expect(response.body).toEqual({ suggestions: [] });
  });

  it('returns stale concepts (not practiced in 14 days)', async () => {
    fromResults = {
      _user: { id: 'u1' },
      nodes: {
        data: [
          { id: 'c1', title: 'Caching', slug: 'caching', metadata: { source: 'sds' }, updated_at: '2024-01-01T00:00:00Z' },
          { id: 'c2', title: 'Sharding', slug: 'sharding', metadata: {}, updated_at: '2024-01-02T00:00:00Z' },
        ],
        error: null,
      },
      edges: {
        data: [
          { target_id: 'c1', created_at: '2024-05-01T00:00:00Z', metadata: {} },
        ],
        error: null,
      },
    } as typeof fromResults;

    const response = await GET();
    const suggestions = response.body.suggestions;

    expect(suggestions).toHaveLength(2);
    // c2 (never practiced) should come first
    expect(suggestions[0].concept_id).toBe('c2');
    expect(suggestions[0].days_since_practice).toBeNull();
    // c1 practiced 31 days ago
    expect(suggestions[1].concept_id).toBe('c1');
    expect(suggestions[1].days_since_practice).toBe(31);
  });

  it('filters out recently practiced concepts', async () => {
    fromResults = {
      _user: { id: 'u1' },
      nodes: {
        data: [
          { id: 'c1', title: 'Fresh', slug: 'fresh', metadata: {}, updated_at: '2024-01-01T00:00:00Z' },
        ],
        error: null,
      },
      edges: {
        data: [
          { target_id: 'c1', created_at: '2024-05-29T00:00:00Z', metadata: {} },
        ],
        error: null,
      },
    } as typeof fromResults;

    const response = await GET();
    expect(response.body.suggestions).toHaveLength(0);
  });

  it('marks from_sds correctly', async () => {
    fromResults = {
      _user: { id: 'u1' },
      nodes: {
        data: [
          { id: 'c1', title: 'SDS Concept', slug: 'sds-concept', metadata: { source: 'sds' }, updated_at: '2024-01-01T00:00:00Z' },
          { id: 'c2', title: 'Manual Concept', slug: 'manual', metadata: {}, updated_at: '2024-01-01T00:00:00Z' },
        ],
        error: null,
      },
      edges: { data: [], error: null },
    } as typeof fromResults;

    const response = await GET();
    const suggestions = response.body.suggestions;

    const sds = suggestions.find((s: { concept_id: string }) => s.concept_id === 'c1');
    const manual = suggestions.find((s: { concept_id: string }) => s.concept_id === 'c2');
    expect(sds.from_sds).toBe(true);
    expect(manual.from_sds).toBe(false);
  });

  it('limits results to 10', async () => {
    const concepts = Array.from({ length: 15 }, (_, i) => ({
      id: `c${i}`,
      title: `Concept ${i}`,
      slug: `concept-${i}`,
      metadata: {},
      updated_at: '2024-01-01T00:00:00Z',
    }));

    fromResults = {
      _user: { id: 'u1' },
      nodes: { data: concepts, error: null },
      edges: { data: [], error: null },
    } as typeof fromResults;

    const response = await GET();
    expect(response.body.suggestions).toHaveLength(10);
  });
});
