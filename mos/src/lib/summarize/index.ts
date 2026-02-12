import type { SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { Node } from '@arc/types';
import type { NodeWithEdges } from '@/lib/graph/engine';
import { getNodeWithEdges, getConnections } from '@/lib/graph/engine';
import { hybridSearch } from '@/lib/search/hybrid';

// ---------------------------------------------------------------------------
// Simple chat completion wrapper
// ---------------------------------------------------------------------------

const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 4096;

/**
 * Minimal chat-completion wrapper around the Anthropic SDK.
 * Unlike the evaluator interface in @arc/llm (which is SDS-specific), this
 * provides a general-purpose system+user prompt -> text response.
 */
async function chat(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is required for summarization. Set the environment variable.',
    );
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content.');
  }

  return textBlock.text;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatNodeForPrompt(node: Node): string {
  const parts = [`# ${node.title} (${node.type})`];
  if (node.summary) parts.push(`Summary: ${node.summary}`);
  if (node.content) parts.push(node.content);
  return parts.join('\n');
}

export function formatNodeWithEdgesForPrompt(nwe: NodeWithEdges): string {
  const lines = [formatNodeForPrompt(nwe.node)];

  if (nwe.edges.length > 0) {
    lines.push('\n## Connections:');
    const nodeMap = new Map(nwe.connectedNodes.map((n) => [n.id, n]));

    for (const edge of nwe.edges) {
      const otherId = edge.source_id === nwe.node.id ? edge.target_id : edge.source_id;
      const other = nodeMap.get(otherId);
      const direction = edge.source_id === nwe.node.id ? '->' : '<-';
      const label = edge.edge_type === 'custom' ? (edge.custom_label ?? 'custom') : edge.edge_type;
      const otherTitle = other ? `${other.title} (${other.type})` : otherId;
      lines.push(`  ${direction} [${label}, weight=${edge.weight}] ${otherTitle}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// summarizeNode
// ---------------------------------------------------------------------------

/**
 * Summarize a single node and its connections using an LLM.
 * Returns the generated summary text.
 */
export async function summarizeNode(nodeWithEdges: NodeWithEdges): Promise<string> {
  const systemPrompt = [
    'You are a knowledge-graph summarizer for a personal memory system.',
    'Given a node and its connections, produce a concise 2-4 sentence summary.',
    'Focus on what this node represents, how it relates to connected nodes,',
    'and why it matters in the user\'s knowledge graph.',
  ].join(' ');

  const userPrompt = formatNodeWithEdgesForPrompt(nodeWithEdges);

  return chat(systemPrompt, userPrompt);
}

// ---------------------------------------------------------------------------
// whatDoIKnow
// ---------------------------------------------------------------------------

/**
 * Gathers nodes related to a topic via hybrid search, then synthesizes
 * a narrative answer to "what do I know about <topic>?".
 */
export async function whatDoIKnow(
  supabase: SupabaseClient,
  userId: string,
  topic: string,
): Promise<string> {
  const results = await hybridSearch(supabase, {
    query: topic,
    userId,
    limit: 15,
  });

  if (results.length === 0) {
    return `You don't have any nodes related to "${topic}" yet.`;
  }

  const systemPrompt = [
    'You are a personal knowledge assistant. The user wants to know what they',
    'have recorded about a specific topic. Given the relevant nodes from their',
    'knowledge graph, synthesize a clear, structured summary of everything',
    'they know. Use headings, bullet points, and highlight key relationships.',
    'If the data is sparse, acknowledge what is known and suggest what might',
    'be worth adding.',
  ].join(' ');

  const nodeTexts = results.map((r) => formatNodeForPrompt(r.node));
  const userPrompt = [
    `Topic: ${topic}`,
    '',
    `Found ${results.length} related nodes:`,
    '',
    ...nodeTexts,
  ].join('\n');

  return chat(systemPrompt, userPrompt);
}

// ---------------------------------------------------------------------------
// generateCribSheet
// ---------------------------------------------------------------------------

/**
 * Walk the graph from a target node, gather connected nodes (up to 2 hops),
 * and produce a structured preparation document ("crib sheet").
 *
 * Useful for interview prep, meeting prep, or studying a concept cluster.
 */
export async function generateCribSheet(
  supabase: SupabaseClient,
  userId: string,
  nodeId: string,
): Promise<string> {
  const rootWithEdges = await getNodeWithEdges(supabase, nodeId);
  if (!rootWithEdges) {
    throw new Error(`Node ${nodeId} not found.`);
  }

  // Gather depth-2 connections for richer context
  const connections = await getConnections(supabase, nodeId, { depth: 2, direction: 'both' });

  // Also fetch full NodeWithEdges for the direct neighbors (depth=1)
  const directNeighborIds = connections
    .filter((c) => c.depth === 1)
    .map((c) => c.node.id);

  const neighborDetails = await Promise.all(
    directNeighborIds.slice(0, 10).map((id) => getNodeWithEdges(supabase, id)),
  );

  const systemPrompt = [
    'You are a personal knowledge assistant creating a preparation document ("crib sheet").',
    'Given a central node and its connected graph neighborhood, produce a structured',
    'document with these sections:',
    '',
    '## Overview',
    'Brief description of the central topic.',
    '',
    '## Key Concepts',
    'Bullet points of important related concepts and their relationships.',
    '',
    '## Key Connections',
    'How different nodes relate to each other and the central topic.',
    '',
    '## Quick Reference',
    'Key facts, definitions, or data points worth remembering.',
    '',
    '## Gaps & Questions',
    'What seems to be missing or underexplored based on the graph.',
    '',
    'Be concise but thorough. Use markdown formatting.',
  ].join('\n');

  const sections: string[] = [
    '# Central Node',
    formatNodeWithEdgesForPrompt(rootWithEdges),
    '',
    '# Direct Neighbors (detail)',
  ];

  for (const detail of neighborDetails) {
    if (detail) {
      sections.push(formatNodeWithEdgesForPrompt(detail));
      sections.push('');
    }
  }

  if (connections.filter((c) => c.depth === 2).length > 0) {
    sections.push('# Extended Network (2 hops)');
    for (const conn of connections.filter((c) => c.depth === 2)) {
      sections.push(`- ${conn.node.title} (${conn.node.type}) via [${conn.edge.edge_type}]`);
    }
  }

  const userPrompt = sections.join('\n');

  return chat(systemPrompt, userPrompt);
}
