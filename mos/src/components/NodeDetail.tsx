'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Node, NodeType, EdgeType } from '@arc/types';
import {
  updateNodeFromUI,
  addEdgeFromUI,
  removeEdgeFromUI,
  searchNodesFromUI,
  computeSaveActions,
  type Connection,
} from '@/lib/graph/nodeEnrichment';

type LocalConnection = Connection & { uid?: string };

const NODE_TYPES: NodeType[] = [
  'concept', 'pattern', 'domain', 'person', 'org', 'project', 'note', 'artifact',
];

const EDGE_TYPES: EdgeType[] = [
  'related_to', 'used_in', 'practiced_at', 'knows', 'prepared_for',
  'works_at', 'authored', 'read', 'connected_to', 'depends_on', 'part_of', 'custom',
];

const TYPE_BADGE: Record<string, string> = {
  person: 'bg-amber-900 text-amber-200',
  project: 'bg-blue-900 text-blue-200',
  note: 'bg-violet-900 text-violet-200',
  org: 'bg-cyan-900 text-cyan-200',
  concept: 'bg-emerald-900 text-emerald-200',
  pattern: 'bg-pink-900 text-pink-200',
  domain: 'bg-orange-900 text-orange-200',
  artifact: 'bg-red-900 text-red-200',
};

interface Props {
  node: Node;
  connections: Connection[];
}

export function NodeDetail({ node, connections: initialConnections }: Props) {
  const router = useRouter();

  // Edit mode
  const [editing, setEditing] = useState(false);

  // Editable node fields
  const [title, setTitle] = useState(node.title);
  const [type, setType] = useState<NodeType>(node.type);
  const [summary, setSummary] = useState(node.summary ?? '');
  const [content, setContent] = useState(node.content ?? '');

  // Connection diff tracking
  const [removedEdgeIds, setRemovedEdgeIds] = useState<Set<string>>(new Set());
  const [addedConnections, setAddedConnections] = useState<LocalConnection[]>([]);

  // Re-sync connection diff state when server re-fetches after router.refresh()
  useEffect(() => {
    setRemovedEdgeIds(new Set());
    setAddedConnections([]);
  }, [initialConnections]);

  // Add-connection form
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; type: string }[]>([]);
  const [pendingTarget, setPendingTarget] = useState<{ id: string; title: string } | null>(null);
  const [pendingEdgeType, setPendingEdgeType] = useState<EdgeType>('related_to');

  // Save state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced node search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const connectedIds = new Set([
      ...initialConnections.map((c) => c.nodeId),
      ...addedConnections.map((c) => c.nodeId),
    ]);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchNodesFromUI(searchQuery);
      setSearchResults(
        results.filter((r) => r.id !== node.id && !connectedIds.has(r.id)),
      );
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, initialConnections, addedConnections, node.id]);

  function handleCancel() {
    setTitle(node.title);
    setType(node.type);
    setSummary(node.summary ?? '');
    setContent(node.content ?? '');
    setRemovedEdgeIds(new Set());
    setAddedConnections([]);
    setSearchQuery('');
    setSearchResults([]);
    setPendingTarget(null);
    setPendingEdgeType('related_to');
    setError(null);
    setEditing(false);
  }

  function handleRemoveConnection(edgeId: string | null, uid: string | undefined) {
    if (edgeId !== null) {
      setRemovedEdgeIds((prev) => new Set([...prev, edgeId]));
    } else if (uid !== undefined) {
      setAddedConnections((prev) => prev.filter((c) => c.uid !== uid));
    }
  }

  function handleAddConnection() {
    if (!pendingTarget) return;
    setAddedConnections((prev) => [
      ...prev,
      {
        edgeId: null,
        edgeType: pendingEdgeType,
        nodeId: pendingTarget.id,
        nodeTitle: pendingTarget.title,
        direction: 'outgoing',
        uid: Math.random().toString(36).slice(2),
      },
    ]);
    setPendingTarget(null);
    setSearchQuery('');
    setSearchResults([]);
    setPendingEdgeType('related_to');
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const { edgeIdsToDelete, edgesToAdd } = computeSaveActions(
        initialConnections,
        removedEdgeIds,
        addedConnections,
      );
      const nodeChanged =
        title !== node.title ||
        type !== node.type ||
        summary !== (node.summary ?? '') ||
        content !== (node.content ?? '');

      await Promise.all([
        nodeChanged
          ? updateNodeFromUI(node.id, {
              title,
              type,
              summary: summary || null,
              content: content || null,
            })
          : Promise.resolve(),
        ...edgesToAdd.map((c) =>
          addEdgeFromUI(
            c.direction === 'outgoing' ? node.id : c.nodeId,
            c.direction === 'outgoing' ? c.nodeId : node.id,
            c.edgeType as EdgeType,
          ),
        ),
        ...edgeIdsToDelete.map(removeEdgeFromUI),
      ]);

      router.refresh();
      setEditing(false);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Save failed');
      router.refresh(); // reload server state so UI reflects what actually persisted
    } finally {
      setSaving(false);
    }
  }

  // Derive displayed connections from server data + local diff
  const visibleOriginal: LocalConnection[] = initialConnections.filter(
    (c) => c.edgeId === null || !removedEdgeIds.has(c.edgeId),
  );
  const displayedConnections: LocalConnection[] = [...visibleOriginal, ...addedConnections];

  // Group by edge type for read mode
  const grouped = new Map<string, LocalConnection[]>();
  for (const conn of displayedConnections) {
    const existing = grouped.get(conn.edgeType) ?? [];
    existing.push(conn);
    grouped.set(conn.edgeType, existing);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Navigation */}
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          &larr; Back to graph
        </Link>
        <Link
          href={`/?focus=${node.id}`}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          View in graph
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          {editing ? (
            <>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as NodeType)}
                className="rounded-lg bg-gray-800 border border-gray-700 px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {NODE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold">{node.title}</h1>
              <span
                className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                  TYPE_BADGE[node.type] ?? 'bg-gray-800 text-gray-300'
                }`}
              >
                {node.type}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="ml-auto rounded-lg bg-gray-800 px-3 py-1 text-sm hover:bg-gray-700 transition-colors"
              >
                Edit
              </button>
            </>
          )}
        </div>
        <p className="text-sm text-gray-500">
          Updated {new Date(node.updated_at).toLocaleDateString()}
        </p>
      </div>

      {/* Summary */}
      <div className="mb-8">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Summary
        </h2>
        {editing ? (
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="A brief description of this node…"
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : node.summary ? (
          <div className="p-4 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-gray-300">{node.summary}</p>
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="mb-8">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
          Content
        </h2>
        {editing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="Full content, notes, or details…"
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : node.content ? (
          <pre className="whitespace-pre-wrap text-gray-300 font-sans text-sm leading-relaxed">
            {node.content}
          </pre>
        ) : null}
      </div>

      {/* Connections */}
      <div className="mb-8">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
          Connections
        </h2>

        {editing ? (
          <div className="space-y-1 mb-4">
            {displayedConnections.map((conn, i) => (
              <div
                key={conn.edgeId ?? conn.uid ?? `added-${i}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-900"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {conn.direction === 'outgoing' ? '→' : '←'}
                  </span>
                  <span className="text-sm text-gray-200">{conn.nodeTitle}</span>
                  <span className="text-xs text-gray-500 italic">
                    {conn.edgeType.replace(/_/g, ' ')}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveConnection(conn.edgeId, conn.uid)}
                  className="text-gray-500 hover:text-red-400 transition-colors px-1"
                  aria-label={`Remove connection to ${conn.nodeTitle}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : grouped.size > 0 ? (
          <div className="space-y-4 mb-4">
            {[...grouped.entries()].map(([edgeType, conns]) => (
              <div key={edgeType}>
                <h3 className="text-sm font-medium text-gray-300 mb-2 capitalize">
                  {edgeType.replace(/_/g, ' ')}
                </h3>
                <div className="space-y-1">
                  {conns.map((conn) => (
                    <Link
                      key={conn.edgeId ?? conn.nodeId}
                      href={`/node/${conn.nodeId}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-900 transition-colors"
                    >
                      <span className="text-xs text-gray-500">
                        {conn.direction === 'outgoing' ? '→' : '←'}
                      </span>
                      <span className="text-sm">{conn.nodeTitle}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Add connection form (edit mode only) */}
        {editing && (
          <div className="rounded-lg border border-gray-700 bg-gray-900 p-3 space-y-2">
            <p className="text-xs text-gray-400 font-medium">Add connection</p>
            <div className="relative">
              <input
                value={pendingTarget ? pendingTarget.title : searchQuery}
                onChange={(e) => {
                  setPendingTarget(null);
                  setSearchQuery(e.target.value);
                }}
                placeholder="Search for a node…"
                className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchResults.length > 0 && !pendingTarget && (
                <ul className="absolute z-10 w-full mt-1 rounded-lg border border-gray-700 bg-gray-900 shadow-lg overflow-hidden">
                  {searchResults.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => {
                          setPendingTarget({ id: r.id, title: r.title });
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-800 transition-colors"
                      >
                        <span className="text-gray-200">{r.title}</span>
                        <span className="text-xs text-gray-500">{r.type}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pendingEdgeType}
                onChange={(e) => setPendingEdgeType(e.target.value as EdgeType)}
                className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {EDGE_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <button
                onClick={handleAddConnection}
                disabled={!pendingTarget}
                className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Footer actions */}
      {editing ? (
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-3">
          <Link
            href={`/crib/${node.id}`}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg transition-colors"
          >
            Generate crib sheet
          </Link>
        </div>
      )}
    </div>
  );
}
