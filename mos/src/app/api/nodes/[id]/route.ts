import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { updateNode } from '@/lib/graph/engine';
import type { UpdateNodeInput } from '@/lib/graph/engine';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { title, type, summary, content } = body;

  const updates: UpdateNodeInput = {};
  if (title !== undefined) updates.title = title;
  if (type !== undefined) updates.type = type;
  if (summary !== undefined) updates.summary = summary;
  if (content !== undefined) updates.content = content;

  try {
    const node = await updateNode(supabase, id, updates);
    return NextResponse.json({ node });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'PGRST116') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
