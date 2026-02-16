"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createNodeFromUI } from "@/lib/graph/createNodeFromUI";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface Node {
  id: string;
  title: string;
  type: string;
  content?: string;
  summary?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface Edge {
  id: string;
  source_id: string;
  target_id: string;
  edge_type: string;
  user_id: string;
}

interface GraphExplorerProps {
  nodes: Node[];
  edges: Edge[];
}

const NODE_TYPES = [
  "concept", "pattern", "domain", "person", "org", "project", "note", "artifact",
] as const;

const TYPE_COLORS: Record<string, string> = {
  person: "#f59e0b",
  project: "#3b82f6",
  topic: "#10b981",
  note: "#8b5cf6",
  event: "#ef4444",
  organization: "#06b6d4",
  document: "#f97316",
  idea: "#ec4899",
};

function getNodeColor(type: string): string {
  return TYPE_COLORS[type] ?? "#6b7280";
}

export default function GraphExplorer({ nodes, edges }: GraphExplorerProps) {
  const router = useRouter();
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("concept");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const allTypes = useMemo(
    () => [...new Set(nodes.map((n) => n.type))].sort(),
    [nodes],
  );

  const filteredNodes = useMemo(() => {
    let result = nodes;
    if (selectedTypes.size > 0) {
      result = result.filter((n) => selectedTypes.has(n.type));
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter((n) => n.title.toLowerCase().includes(lower));
    }
    return result;
  }, [nodes, selectedTypes, searchTerm]);

  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  );

  const graphData = useMemo(() => {
    const graphNodes = filteredNodes.map((n) => ({
      id: n.id,
      label: n.title,
      type: n.type,
      color: getNodeColor(n.type),
    }));

    const links = edges
      .filter(
        (e) => filteredNodeIds.has(e.source_id) && filteredNodeIds.has(e.target_id),
      )
      .map((e) => ({
        source: e.source_id,
        target: e.target_id,
        label: e.edge_type,
      }));

    return { nodes: graphNodes, links };
  }, [filteredNodes, filteredNodeIds, edges]);

  const handleNodeClick = useCallback(
    (node: { id?: string | number }) => {
      if (node.id) {
        router.push(`/node/${node.id}`);
      }
    },
    [router],
  );

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError("");
    try {
      await createNodeFromUI(newTitle, newType);
      setNewTitle("");
      setNewType("concept");
      setShowCreateForm(false);
      router.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create node");
    } finally {
      setCreating(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setDimensions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      {/* Sidebar */}
      <aside className="w-72 border-r border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-semibold mb-3">Memory OS</h1>
          <input
            type="text"
            placeholder="Filter nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-2 w-full px-3 py-2 text-sm rounded-lg transition-colors bg-blue-600 hover:bg-blue-500 text-white"
            >
              + New
            </button>
          )}
          {showCreateForm && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                placeholder="Node title..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setShowCreateForm(false);
                    setNewTitle("");
                    setCreateError("");
                  }
                }}
                autoFocus
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {NODE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {createError && (
                <p className="text-xs text-red-400">{createError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={creating || !newTitle.trim()}
                  className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewTitle("");
                    setCreateError("");
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Type filters */}
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Types
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {allTypes.map((type) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                  selectedTypes.size === 0 || selectedTypes.has(type)
                    ? "border-transparent text-white"
                    : "border-gray-700 text-gray-500 bg-transparent"
                }`}
                style={
                  selectedTypes.size === 0 || selectedTypes.has(type)
                    ? { backgroundColor: getNodeColor(type) }
                    : undefined
                }
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Node list */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            {filteredNodes.map((node) => (
              <button
                key={node.id}
                onClick={() => router.push(`/node/${node.id}`)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getNodeColor(node.type) }}
                  />
                  <span className="text-sm truncate">{node.title}</span>
                </div>
                <span className="text-xs text-gray-500 ml-4">{node.type}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation links */}
        <div className="p-4 border-t border-gray-800 space-y-1">
          <a
            href="/search"
            className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Search
          </a>
          <a
            href="/ask"
            className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Ask a question
          </a>
        </div>
      </aside>

      {/* Graph canvas */}
      <div className="flex-1 relative" ref={containerRef}>
        <ForceGraph2D
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel="label"
          nodeColor="color"
          nodeRelSize={6}
          linkColor={() => "#374151"}
          linkWidth={1}
          onNodeClick={handleNodeClick}
          backgroundColor="#030712"
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = (node as { label?: string }).label ?? "";
            const color = (node as { color?: string }).color ?? "#6b7280";
            const x = node.x ?? 0;
            const y = node.y ?? 0;
            const size = 5;

            // Draw node circle
            ctx.beginPath();
            ctx.arc(x, y, size, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();

            // Draw label
            const fontSize = Math.max(12 / globalScale, 2);
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = "#d1d5db";
            ctx.fillText(label, x, y + size + 2);
          }}
        />
      </div>
    </>
  );
}
