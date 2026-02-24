import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { hybridSearch } from '@/lib/search/hybrid';

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { query } = await request.json();
  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const raw = await hybridSearch(supabase, { query, userId: user.id });
  const results = raw.map((r) => ({
    id: r.node.id,
    title: r.node.title,
    type: r.node.type,
    snippet: r.node.summary || r.node.content || '',
    score: r.score,
  }));
  return NextResponse.json({ results });
}
