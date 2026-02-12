import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track all supabase operations
let operations: { schema: string; table: string; op: string; args?: unknown }[];
let mockData: Record<string, unknown>;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockImplementation(() => {
    function makeChain(schemaName: string, tableName: string) {
      const chain: Record<string, unknown> = {};

      chain.upsert = vi.fn().mockImplementation((data: unknown, opts: unknown) => {
        operations.push({ schema: schemaName, table: tableName, op: 'upsert', args: data });
        return chain;
      });
      chain.insert = vi.fn().mockImplementation((data: unknown) => {
        operations.push({ schema: schemaName, table: tableName, op: 'insert', args: data });
        return chain;
      });
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);

      chain.single = vi.fn().mockImplementation(() => {
        const key = `${schemaName}.${tableName}.single`;
        const queue = mockData[key] as unknown[] | undefined;
        if (queue && Array.isArray(queue) && queue.length > 0) {
          return Promise.resolve(queue.shift());
        }
        return Promise.resolve({ data: null, error: null });
      });

      chain.maybeSingle = vi.fn().mockImplementation(() => {
        const key = `${schemaName}.${tableName}.maybeSingle`;
        const queue = mockData[key] as unknown[] | undefined;
        if (queue && Array.isArray(queue) && queue.length > 0) {
          return Promise.resolve(queue.shift());
        }
        return Promise.resolve({ data: null, error: null });
      });

      // For upsert without select().single() (ignoreDuplicates)
      chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ data: null, error: null }));

      return chain;
    }

    return {
      schema: vi.fn().mockImplementation((schemaName: string) => ({
        from: vi.fn().mockImplementation((tableName: string) =>
          makeChain(schemaName, tableName)),
      })),
    };
  }),
}));

import { syncSessionToMOS } from '../mos-sync';

const session = {
  id: 'sess-1234-5678',
  user_id: 'u1',
  prompt_id: 'p1',
  mode: '60_min',
  status: 'evaluated',
  started_at: '2024-01-01T00:00:00Z',
  ended_at: '2024-01-01T01:00:00Z',
  time_spent_sec: 3600,
};

const evaluation = {
  id: 'eval-1',
  overall_score: 75,
  component_score: 80,
  scaling_score: 70,
  reliability_score: 65,
  tradeoff_score: 60,
  components_found: ['Cache', 'Load Balancer'],
};

describe('syncSessionToMOS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    operations = [];
    mockData = {};
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });

  it('returns null when env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await syncSessionToMOS(session, evaluation);
    expect(result).toBeNull();
  });

  it('creates session node and concept nodes', async () => {
    // Session node upsert → returns id
    mockData['mos.nodes.single'] = [
      { data: { id: 'sn1' }, error: null },
      // Concept nodes
      { data: { id: 'cn1' }, error: null },
      { data: { id: 'cn2' }, error: null },
    ];

    // Edge sync checks → not synced
    mockData['sds.mos_sync.maybeSingle'] = [
      { data: null, error: null },
      { data: null, error: null },
    ];

    // Edge inserts
    mockData['mos.edges.single'] = [
      { data: { id: 'e1' }, error: null },
      { data: { id: 'e2' }, error: null },
    ];

    const result = await syncSessionToMOS(session, evaluation);

    expect(result).not.toBeNull();
    expect(result!.sessionNodeId).toBe('sn1');
    expect(result!.conceptNodeIds).toEqual(['cn1', 'cn2']);
  });

  it('skips edge creation when sync already exists', async () => {
    mockData['mos.nodes.single'] = [
      { data: { id: 'sn1' }, error: null },
      { data: { id: 'cn1' }, error: null },
      { data: { id: 'cn2' }, error: null },
    ];

    // Edge sync checks → already synced
    mockData['sds.mos_sync.maybeSingle'] = [
      { data: { id: 'existing' }, error: null },
      { data: { id: 'existing' }, error: null },
    ];

    const result = await syncSessionToMOS(session, evaluation);
    expect(result).not.toBeNull();

    // No edge inserts should have happened
    const edgeInserts = operations.filter((o) => o.schema === 'mos' && o.table === 'edges' && o.op === 'insert');
    expect(edgeInserts).toHaveLength(0);
  });
});
