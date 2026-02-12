import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Returns practice suggestions based on MOS graph analysis.
 * Finds concepts that haven't been practiced recently in SDS sessions.
 */
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all concept nodes that were auto-created from SDS
  const { data: concepts } = await supabase
    .schema('mos')
    .from('nodes')
    .select('id, title, slug, metadata, updated_at')
    .eq('type', 'concept')
    .order('updated_at', { ascending: true });

  if (!concepts || concepts.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  // Get all practiced_at edges to find when each concept was last practiced
  const { data: edges } = await supabase
    .schema('mos')
    .from('edges')
    .select('target_id, created_at, metadata')
    .eq('edge_type', 'practiced_at');

  // Build a map of concept_id → last practiced date
  const lastPracticed = new Map<string, string>();
  for (const edge of edges ?? []) {
    const existing = lastPracticed.get(edge.target_id);
    if (!existing || edge.created_at > existing) {
      lastPracticed.set(edge.target_id, edge.created_at);
    }
  }

  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const suggestions = concepts
    .map((concept) => {
      const practiced = lastPracticed.get(concept.id);
      const isStale = !practiced || practiced < twoWeeksAgo;
      const daysSince = practiced
        ? Math.floor((Date.now() - new Date(practiced).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        concept_id: concept.id,
        title: concept.title,
        slug: concept.slug,
        last_practiced: practiced ?? null,
        days_since_practice: daysSince,
        is_stale: isStale,
        from_sds: (concept.metadata as Record<string, unknown>)?.source === 'sds',
      };
    })
    .filter((s) => s.is_stale)
    .sort((a, b) => {
      // Never practiced first, then oldest practice
      if (a.days_since_practice === null) return -1;
      if (b.days_since_practice === null) return 1;
      return b.days_since_practice - a.days_since_practice;
    })
    .slice(0, 10);

  return NextResponse.json({ suggestions });
}
