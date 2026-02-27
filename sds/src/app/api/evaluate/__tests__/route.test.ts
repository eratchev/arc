import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSingle = vi.fn();
const mockInsertChain = { then: vi.fn() };

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(async () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null,
      }),
    },
    schema: vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'responses') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: mockSingle,
          };
        }
        if (table === 'evaluations') {
          return {
            insert: vi.fn().mockReturnValue({
              then: vi.fn().mockImplementation((r: (v: unknown) => void) =>
                r({ data: null, error: null }),
              ),
            }),
          };
        }
        // sessions update
        return {
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: vi.fn().mockImplementation((r: (v: unknown) => void) =>
            r({ data: null, error: null }),
          ),
        };
      }),
    }),
  })),
}));

vi.mock('@arc/llm', () => ({
  createEvaluator: vi.fn().mockReturnValue({
    name: 'claude',
    model: 'claude-test',
    evaluate: vi.fn().mockResolvedValue({
      raw_response: 'raw',
      overall_score: 80,
      component_score: 75,
      scaling_score: 70,
      reliability_score: 85,
      tradeoff_score: 90,
      components_found: [],
      components_missing: [],
      scaling_gaps: [],
      suggestions: [],
    }),
  }),
}));

vi.mock('@/lib/connectors/mos-sync', () => ({
  syncSessionToMOS: vi.fn().mockResolvedValue(null),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn().mockImplementation((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

import { POST } from '../route';

function makeRequest(body: unknown) {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as import('next/server').NextRequest;
}

const responseFixture = {
  id: 'r1',
  architecture_text: 'design text',
  mermaid_diagram: null,
  notes: null,
  sessions: {
    id: 's1',
    user_id: 'u1',
    prompt_id: 'p1',
    mode: '60_min',
    started_at: '2024-01-01T00:00:00Z',
    ended_at: null,
    time_spent_sec: null,
    prompts: {
      title: 'Design a URL shortener',
      description: 'Build a scalable URL shortener',
      constraints: ['handle 1B requests/day'],
      expected_components: ['cache', 'database'],
    },
  },
};

describe('POST /api/evaluate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when responseId is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'responseId required' });
  });

  it('returns 404 when response is not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });
    const res = await POST(makeRequest({ responseId: 'r1' }));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Response not found' });
  });

  it('returns 404 when session join is null', async () => {
    mockSingle.mockResolvedValue({
      data: { ...responseFixture, sessions: null },
      error: null,
    });
    const res = await POST(makeRequest({ responseId: 'r1' }));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Session not found' });
  });

  it('returns 404 when prompt join is null', async () => {
    mockSingle.mockResolvedValue({
      data: { ...responseFixture, sessions: { ...responseFixture.sessions, prompts: null } },
      error: null,
    });
    const res = await POST(makeRequest({ responseId: 'r1' }));
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Prompt not found' });
  });

  it('returns success on valid evaluation', async () => {
    mockSingle.mockResolvedValue({ data: responseFixture, error: null });
    const res = await POST(makeRequest({ responseId: 'r1' }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});
