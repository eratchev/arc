import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateCribSheet } from '@/lib/summarize';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ nodeId: string }> },
) {
  const { nodeId } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cribSheet = await generateCribSheet(supabase, user.id, nodeId);
  return NextResponse.json({ content: cribSheet });
}
