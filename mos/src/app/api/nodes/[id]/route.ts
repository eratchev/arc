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

  // Parse request body with error handling
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { id } = await params;
  const { title, type, summary, content, metadata } = body;

  const updates: UpdateNodeInput = {};
  if (title !== undefined) updates.title = title;
  if (type !== undefined) updates.type = type;
  if (summary !== undefined) updates.summary = summary;
  if (content !== undefined) updates.content = content;
  if (metadata !== undefined) updates.metadata = metadata;

  // Guard against empty update
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

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
