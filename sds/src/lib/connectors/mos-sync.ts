import { createClient } from '@supabase/supabase-js';

/**
 * Sync an evaluated SDS session into the MOS knowledge graph.
 * Uses the service role client to bypass RLS (system operation).
 *
 * Called after evaluation completes. Idempotent via sds.mos_sync UNIQUE constraint.
 */
export async function syncSessionToMOS(session: {
  id: string;
  user_id: string;
  prompt_id: string;
  mode: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  time_spent_sec: number | null;
}, evaluation: {
  id: string;
  overall_score: number;
  component_score: number;
  scaling_score: number;
  reliability_score: number;
  tradeoff_score: number;
  components_found: string[];
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn('MOS sync skipped: missing SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }

  const admin = createClient(url, serviceKey);

  const sessionSlug = `sds-session-${session.id}`;

  // 1. Upsert session note node in MOS
  const { data: sessionNode } = await admin
    .schema('mos')
    .from('nodes')
    .upsert(
      {
        user_id: session.user_id,
        type: 'note',
        slug: sessionSlug,
        title: `SDS Session: ${session.id.slice(0, 8)}`,
        content: [
          `System Design Session — ${session.mode} mode`,
          `Overall score: ${evaluation.overall_score}/100`,
          `Components: ${evaluation.component_score}/100`,
          `Scaling: ${evaluation.scaling_score}/100`,
          `Reliability: ${evaluation.reliability_score}/100`,
          `Trade-offs: ${evaluation.tradeoff_score}/100`,
        ].join('\n'),
        metadata: {
          subtype: 'interview',
          sds_session_id: session.id,
          sds_evaluation_id: evaluation.id,
          prompt_id: session.prompt_id,
          overall_score: evaluation.overall_score,
        },
      },
      { onConflict: 'user_id,slug' },
    )
    .select('id')
    .single();

  if (!sessionNode) return null;

  // Record sync
  await admin
    .schema('sds')
    .from('mos_sync')
    .upsert(
      {
        session_id: session.id,
        mos_node_id: sessionNode.id,
        source_type: 'session',
        source_key: session.id,
      },
      { onConflict: 'session_id,source_type,source_key', ignoreDuplicates: true },
    );

  // 2. Upsert concept nodes for each component found
  const conceptNodeIds: string[] = [];
  for (const component of evaluation.components_found) {
    const conceptSlug = component
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const { data: conceptNode } = await admin
      .schema('mos')
      .from('nodes')
      .upsert(
        {
          user_id: session.user_id,
          type: 'concept',
          slug: conceptSlug,
          title: component,
          metadata: { source: 'sds', auto_created: true },
        },
        { onConflict: 'user_id,slug' },
      )
      .select('id')
      .single();

    if (!conceptNode) continue;
    conceptNodeIds.push(conceptNode.id);

    // Record concept sync
    await admin
      .schema('sds')
      .from('mos_sync')
      .upsert(
        {
          session_id: session.id,
          mos_node_id: conceptNode.id,
          source_type: 'concept',
          source_key: conceptSlug,
        },
        { onConflict: 'session_id,source_type,source_key', ignoreDuplicates: true },
      );

    // 3. Create practiced_at edge
    const edgeKey = `${sessionSlug}::${conceptSlug}`;

    // Check if edge sync already exists
    const { data: existingSync } = await admin
      .schema('sds')
      .from('mos_sync')
      .select('id')
      .eq('session_id', session.id)
      .eq('source_type', 'edge')
      .eq('source_key', edgeKey)
      .maybeSingle();

    if (!existingSync) {
      const weight = evaluation.component_score / 100;

      const { data: edge } = await admin
        .schema('mos')
        .from('edges')
        .insert({
          user_id: session.user_id,
          source_id: sessionNode.id,
          target_id: conceptNode.id,
          edge_type: 'practiced_at',
          weight,
          metadata: {
            sds_session_id: session.id,
            component_score: evaluation.component_score,
          },
        })
        .select('id')
        .single();

      if (edge) {
        await admin
          .schema('sds')
          .from('mos_sync')
          .upsert(
            {
              session_id: session.id,
              mos_node_id: edge.id,
              source_type: 'edge',
              source_key: edgeKey,
            },
            { onConflict: 'session_id,source_type,source_key', ignoreDuplicates: true },
          );
      }
    }
  }

  return { sessionNodeId: sessionNode.id, conceptNodeIds };
}
