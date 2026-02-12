import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session, Evaluation } from '@arc/types';

// Mock the graph engine
const mockCreateNode = vi.fn();
const mockCreateEdge = vi.fn();
const mockGetNodeBySlug = vi.fn();

vi.mock('@/lib/graph/engine', () => ({
  createNode: (...args: unknown[]) => mockCreateNode(...args),
  createEdge: (...args: unknown[]) => mockCreateEdge(...args),
  getNodeBySlug: (...args: unknown[]) => mockGetNodeBySlug(...args),
}));

import { syncSessionToMOS } from '../sds';

const session: Session = {
  id: 'sess-1234-5678-abcd-efgh',
  user_id: 'u1',
  prompt_id: 'p1',
  mode: '60_min',
  status: 'evaluated',
  started_at: '2024-01-01T00:00:00Z',
  ended_at: '2024-01-01T01:00:00Z',
  time_spent_sec: 3600,
  updated_at: '2024-01-01T01:00:00Z',
};

const evaluation: Evaluation = {
  id: 'eval-1',
  response_id: 'r1',
  llm_provider: 'claude',
  llm_model: 'claude-sonnet-4-5-20250929',
  eval_prompt_version: 1,
  parser_version: 1,
  raw_response: '{}',
  overall_score: 75,
  component_score: 80,
  scaling_score: 70,
  reliability_score: 65,
  tradeoff_score: 60,
  components_found: ['Load Balancer', 'Cache'],
  components_missing: ['CDN'],
  scaling_gaps: [],
  suggestions: [],
  evaluated_at: '2024-01-01T01:05:00Z',
};

function createMockAdminClient() {
  const chain: Record<string, unknown> = {};
  ['from', 'select', 'upsert', 'eq'].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

  return {
    schema: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(chain) }),
    _chain: chain,
  } as unknown as Parameters<typeof syncSessionToMOS>[0];
}

describe('syncSessionToMOS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates session node and concept nodes', async () => {
    const sessionNode = { id: 'sn1', user_id: 'u1', type: 'note', slug: 'sds-session-sess-1234-5678-abcd-efgh', title: 'SDS Session: sess-123' };
    const conceptNode1 = { id: 'cn1', user_id: 'u1', type: 'concept', slug: 'load-balancer', title: 'Load Balancer' };
    const conceptNode2 = { id: 'cn2', user_id: 'u1', type: 'concept', slug: 'cache', title: 'Cache' };

    mockCreateNode
      .mockResolvedValueOnce(sessionNode)
      .mockResolvedValueOnce(conceptNode1)
      .mockResolvedValueOnce(conceptNode2);

    const edge1 = { id: 'e1' };
    const edge2 = { id: 'e2' };
    mockCreateEdge
      .mockResolvedValueOnce(edge1)
      .mockResolvedValueOnce(edge2);

    // recordSync: newly inserted
    const admin = createMockAdminClient();
    const chain = (admin as unknown as { _chain: Record<string, unknown> })._chain;
    (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [{ id: 'sync1' }], error: null });
    // isSynced: not synced yet
    (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });

    const result = await syncSessionToMOS(admin, session, evaluation);

    expect(result.sessionNodeId).toBe('sn1');
    expect(result.conceptNodeIds).toEqual(['cn1', 'cn2']);
    expect(result.edgeIds).toEqual(['e1', 'e2']);
    expect(mockCreateNode).toHaveBeenCalledTimes(3);
    expect(mockCreateEdge).toHaveBeenCalledTimes(2);
  });

  it('skips already-synced concepts', async () => {
    const sessionNode = { id: 'sn1' };
    mockCreateNode.mockResolvedValueOnce(sessionNode);
    mockGetNodeBySlug.mockResolvedValue({ id: 'existing-cn' });

    const admin = createMockAdminClient();
    const chain = (admin as unknown as { _chain: Record<string, unknown> })._chain;
    // recordSync returns data for session sync
    (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [{ id: 's1' }], error: null });
    // isSynced returns true for concepts
    (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: 'existing' }, error: null });

    const result = await syncSessionToMOS(admin, session, evaluation);

    expect(result.skipped).toBeGreaterThan(0);
    expect(result.conceptNodeIds).toContain('existing-cn');
    // createNode should only be called once for the session node
    expect(mockCreateNode).toHaveBeenCalledTimes(1);
  });

  it('produces correct edge weights', async () => {
    const sessionNode = { id: 'sn1' };
    const conceptNode = { id: 'cn1' };

    mockCreateNode
      .mockResolvedValueOnce(sessionNode)
      .mockResolvedValueOnce(conceptNode);
    mockCreateEdge.mockResolvedValue({ id: 'e1' });

    const evalOneComponent = {
      ...evaluation,
      components_found: ['Cache'],
      component_score: 80,
    };

    const admin = createMockAdminClient();
    const chain = (admin as unknown as { _chain: Record<string, unknown> })._chain;
    (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [{ id: 's1' }], error: null });
    (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });

    await syncSessionToMOS(admin, session, evalOneComponent);

    expect(mockCreateEdge).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ weight: 0.8 }),
    );
  });
});
