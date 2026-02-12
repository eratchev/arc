import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createNode } from '@/lib/graph/engine';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: nodes, error } = await supabase
    .schema('mos')
    .from('nodes')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ nodes });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { title, type, slug, content, metadata } = await request.json();
  if (!title || !type) {
    return NextResponse.json({ error: 'title and type are required' }, { status: 400 });
  }

  const nodeSlug = slug ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const node = await createNode(supabase, {
    user_id: user.id,
    title,
    type,
    slug: nodeSlug,
    content: content ?? null,
    metadata: metadata ?? {},
  });

  return NextResponse.json({ node }, { status: 201 });
}
