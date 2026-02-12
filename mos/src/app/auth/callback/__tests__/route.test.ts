import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExchangeCodeForSession = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn().mockImplementation(async () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

let redirectUrl: string;
vi.mock('next/server', () => ({
  NextResponse: {
    redirect: vi.fn().mockImplementation((url: string) => ({
      redirected: true,
      url,
    })),
  },
}));

import { GET } from '../route';

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exchanges code for session and redirects to origin', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: {}, error: null });

    const request = new Request('http://localhost:3000/auth/callback?code=abc123');
    const response = await GET(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(response).toEqual({ redirected: true, url: 'http://localhost:3000' });
  });

  it('redirects to origin without exchanging when no code is present', async () => {
    const request = new Request('http://localhost:3000/auth/callback');
    const response = await GET(request);

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(response).toEqual({ redirected: true, url: 'http://localhost:3000' });
  });

  it('redirects even if exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: null,
      error: { message: 'Invalid code' },
    });

    const request = new Request('http://localhost:3000/auth/callback?code=bad');
    const response = await GET(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('bad');
    expect(response).toEqual({ redirected: true, url: 'http://localhost:3000' });
  });
});
