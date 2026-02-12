import { vi } from 'vitest';

/**
 * Chainable Supabase query builder mock.
 *
 * All chainable methods (`.from()`, `.select()`, `.eq()`, etc.) return `this`.
 * Terminal methods (`.single()`, `.maybeSingle()`) resolve with configurable
 * `data` and `error` values. Call `mockResult()` before the query to set what
 * the terminal will return.
 */
export function createMockQueryBuilder(initialData: unknown = null, initialError: unknown = null) {
  let _data: unknown = initialData;
  let _error: unknown = initialError;

  const builder: Record<string, unknown> = {};

  const chainMethods = [
    'from',
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'in',
    'or',
    'ilike',
    'textSearch',
    'order',
    'limit',
    'range',
    'filter',
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  // Terminal methods that resolve the query
  builder.single = vi.fn().mockImplementation(() =>
    Promise.resolve({ data: _data, error: _error }),
  );
  builder.maybeSingle = vi.fn().mockImplementation(() =>
    Promise.resolve({ data: _data, error: _error }),
  );
  // When the builder is awaited directly (no .single()/.maybeSingle())
  builder.then = vi.fn().mockImplementation((resolve: (value: unknown) => void) =>
    resolve({ data: _data, error: _error }),
  );

  /** Set what the next terminal call will return. */
  builder.mockResult = (data: unknown, error: unknown = null) => {
    _data = data;
    _error = error;
    return builder;
  };

  return builder;
}

/**
 * Create a mock Supabase client with `.schema()` and `.from()` chains,
 * `.rpc()`, and `.auth.getUser()`.
 */
export function createMockSupabaseClient() {
  const queryBuilder = createMockQueryBuilder();

  const schemaFn = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue(queryBuilder),
  });

  const client = {
    schema: schemaFn,
    from: vi.fn().mockReturnValue(queryBuilder),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    _queryBuilder: queryBuilder,
  };

  return client;
}
