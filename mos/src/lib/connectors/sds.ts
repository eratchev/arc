import type { SupabaseClient } from '@supabase/supabase-js';
import type { Session, Evaluation, Node, Edge, MosSyncSourceType } from '@arc/types';
import { createNode, createEdge, getNodeBySlug } from '@/lib/graph/engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncResult {
  sessionNodeId: string;
  conceptNodeIds: string[];
  edgeIds: string[];
  skipped: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a URL-safe slug from a string. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Record a sync entry in sds.mos_sync. Uses the UNIQUE constraint on
 * (session_id, source_type, source_key) for idempotency — if the row
 * already exists, this is a no-op (via onConflict ignore).
 *
 * Returns true if a new row was inserted, false if it already existed.
 */
async function recordSync(
  adminClient: SupabaseClient,
  sessionId: string,
  mosNodeId: string,
  sourceType: MosSyncSourceType,
  sourceKey: string,
): Promise<boolean> {
  const { data, error } = await adminClient
    .schema('sds')
    .from('mos_sync')
    .upsert(
      {
        session_id: sessionId,
        mos_node_id: mosNodeId,
        source_type: sourceType,
        source_key: sourceKey,
      },
      { onConflict: 'session_id,source_type,source_key', ignoreDuplicates: true },
    )
    .select('id');

  if (error) throw error;
  // If data has a row, it was newly inserted; empty means it was a duplicate
  return (data?.length ?? 0) > 0;
}

/**
 * Check if a sync entry already exists for a given session + source.
 */
async function isSynced(
  adminClient: SupabaseClient,
  sessionId: string,
  sourceType: MosSyncSourceType,
  sourceKey: string,
): Promise<boolean> {
  const { data, error } = await adminClient
    .schema('sds')
    .from('mos_sync')
    .select('id')
    .eq('session_id', sessionId)
    .eq('source_type', sourceType)
    .eq('source_key', sourceKey)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

/**
 * Sync an evaluated SDS session into the MOS knowledge graph.
 *
 * This is a system-level operation that should be called with a service-role
 * Supabase client (bypasses RLS) since it writes to both `mos` and `sds`
 * schemas on behalf of the user.
 *
 * Steps:
 * 1. Create/upsert a 'note' node (subtype='interview') for the session.
 * 2. For each component found in the evaluation, upsert a 'concept' node.
 * 3. Create 'practiced_at' edges from the session note to each concept node,
 *    weighted by the dimension score from the evaluation.
 * 4. Record all mappings in sds.mos_sync (idempotent via UNIQUE constraint).
 */
export async function syncSessionToMOS(
  adminClient: SupabaseClient,
  session: Session,
  evaluation: Evaluation,
): Promise<SyncResult> {
  const userId = session.user_id;
  let skipped = 0;

  // -----------------------------------------------------------------------
  // 1. Create/upsert the session node
  // -----------------------------------------------------------------------
  const sessionSlug = `sds-session-${session.id}`;
  const sessionNode = await createNode(adminClient, {
    user_id: userId,
    type: 'note',
    slug: sessionSlug,
    title: `SDS Session: ${session.id.slice(0, 8)}`,
    content: [
      `System Design Session — ${session.mode} mode`,
      `Status: ${session.status}`,
      `Started: ${session.started_at}`,
      session.ended_at ? `Ended: ${session.ended_at}` : null,
      session.time_spent_sec ? `Time spent: ${session.time_spent_sec}s` : null,
      `Overall score: ${evaluation.overall_score}/100`,
      `Components: ${evaluation.component_score}/100`,
      `Scaling: ${evaluation.scaling_score}/100`,
      `Reliability: ${evaluation.reliability_score}/100`,
      `Tradeoffs: ${evaluation.tradeoff_score}/100`,
    ]
      .filter(Boolean)
      .join('\n'),
    metadata: {
      subtype: 'interview',
      sds_session_id: session.id,
      sds_evaluation_id: evaluation.id,
      prompt_id: session.prompt_id,
      overall_score: evaluation.overall_score,
    },
  });

  // Record sync for the session node
  const sessionIsNew = await recordSync(
    adminClient,
    session.id,
    sessionNode.id,
    'session',
    session.id,
  );
  if (!sessionIsNew) skipped++;

  // -----------------------------------------------------------------------
  // 2. Upsert concept nodes for each component found
  // -----------------------------------------------------------------------
  const conceptNodeIds: string[] = [];
  const edgeIds: string[] = [];

  for (const component of evaluation.components_found) {
    const conceptSlug = slugify(component);

    // Check if this concept edge was already synced for this session
    const alreadySynced = await isSynced(adminClient, session.id, 'concept', conceptSlug);
    if (alreadySynced) {
      // Fetch the existing node to get its ID for the result
      const existing = await getNodeBySlug(adminClient, userId, conceptSlug);
      if (existing) conceptNodeIds.push(existing.id);
      skipped++;
      continue;
    }

    const conceptNode = await createNode(adminClient, {
      user_id: userId,
      type: 'concept',
      slug: conceptSlug,
      title: component,
      metadata: {
        source: 'sds',
        auto_created: true,
      },
    });

    conceptNodeIds.push(conceptNode.id);

    await recordSync(adminClient, session.id, conceptNode.id, 'concept', conceptSlug);

    // ---------------------------------------------------------------------
    // 3. Create 'practiced_at' edge from session note -> concept
    // ---------------------------------------------------------------------

    // Check if this edge was already synced
    const edgeKey = `${sessionSlug}::${conceptSlug}`;
    const edgeAlreadySynced = await isSynced(adminClient, session.id, 'edge', edgeKey);
    if (edgeAlreadySynced) {
      skipped++;
      continue;
    }

    // Weight the edge by the component dimension score (normalized to 0-1)
    const weight = evaluation.component_score / 100;

    const edge = await createEdge(adminClient, {
      user_id: userId,
      source_id: sessionNode.id,
      target_id: conceptNode.id,
      edge_type: 'practiced_at',
      weight,
      metadata: {
        sds_session_id: session.id,
        component_score: evaluation.component_score,
      },
    });

    edgeIds.push(edge.id);

    await recordSync(adminClient, session.id, edge.id, 'edge', edgeKey);
  }

  return {
    sessionNodeId: sessionNode.id,
    conceptNodeIds,
    edgeIds,
    skipped,
  };
}
