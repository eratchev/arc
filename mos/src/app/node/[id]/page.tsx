import { createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Connection {
  edgeType: string;
  nodeId: string;
  nodeTitle: string;
  direction: "outgoing" | "incoming";
}

export default async function NodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Please sign in to view this node.</p>
      </div>
    );
  }

  const { data: node } = await supabase
    .schema("mos")
    .from("nodes")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!node) {
    notFound();
  }

  // Fetch outgoing edges
  const { data: outgoingEdges } = await supabase
    .schema("mos")
    .from("edges")
    .select("id, edge_type, target_id")
    .eq("source_id", id)
    .eq("user_id", user.id);

  // Fetch incoming edges
  const { data: incomingEdges } = await supabase
    .schema("mos")
    .from("edges")
    .select("id, edge_type, source_id")
    .eq("target_id", id)
    .eq("user_id", user.id);

  // Gather connected node IDs
  const connectedIds = [
    ...(outgoingEdges ?? []).map((e) => e.target_id),
    ...(incomingEdges ?? []).map((e) => e.source_id),
  ];

  // Fetch connected node titles
  const { data: connectedNodes } = connectedIds.length > 0
    ? await supabase
        .schema("mos")
        .from("nodes")
        .select("id, title")
        .in("id", connectedIds)
    : { data: [] };

  const titleMap = new Map(
    (connectedNodes ?? []).map((n) => [n.id, n.title]),
  );

  // Build connections list
  const connections: Connection[] = [
    ...(outgoingEdges ?? []).map((e) => ({
      edgeType: e.edge_type,
      nodeId: e.target_id,
      nodeTitle: titleMap.get(e.target_id) ?? "Unknown",
      direction: "outgoing" as const,
    })),
    ...(incomingEdges ?? []).map((e) => ({
      edgeType: e.edge_type,
      nodeId: e.source_id,
      nodeTitle: titleMap.get(e.source_id) ?? "Unknown",
      direction: "incoming" as const,
    })),
  ];

  // Group by edge type
  const grouped = new Map<string, Connection[]>();
  for (const conn of connections) {
    const existing = grouped.get(conn.edgeType) ?? [];
    existing.push(conn);
    grouped.set(conn.edgeType, existing);
  }

  const typeBadgeColor: Record<string, string> = {
    person: "bg-amber-900 text-amber-200",
    project: "bg-blue-900 text-blue-200",
    topic: "bg-emerald-900 text-emerald-200",
    note: "bg-violet-900 text-violet-200",
    event: "bg-red-900 text-red-200",
    organization: "bg-cyan-900 text-cyan-200",
    document: "bg-orange-900 text-orange-200",
    idea: "bg-pink-900 text-pink-200",
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          &larr; Back to graph
        </Link>
        <Link
          href={`/?focus=${id}`}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          View in graph
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">{node.title}</h1>
          <span
            className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
              typeBadgeColor[node.type] ?? "bg-gray-800 text-gray-300"
            }`}
          >
            {node.type}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          Updated {new Date(node.updated_at).toLocaleDateString()}
        </p>
      </div>

      {/* Summary */}
      {node.summary && (
        <div className="mb-8 p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Summary
          </h2>
          <p className="text-gray-300">{node.summary}</p>
        </div>
      )}

      {/* Content */}
      {node.content && (
        <div className="mb-8">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Content
          </h2>
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-gray-300 font-sans text-sm leading-relaxed">
              {node.content}
            </pre>
          </div>
        </div>
      )}

      {/* Connections */}
      {grouped.size > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            Connections
          </h2>
          <div className="space-y-4">
            {[...grouped.entries()].map(([edgeType, conns]) => (
              <div key={edgeType}>
                <h3 className="text-sm font-medium text-gray-300 mb-2 capitalize">
                  {edgeType.replace(/_/g, " ")}
                </h3>
                <div className="space-y-1">
                  {conns.map((conn) => (
                    <Link
                      key={conn.nodeId}
                      href={`/node/${conn.nodeId}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-900 transition-colors"
                    >
                      <span className="text-xs text-gray-500">
                        {conn.direction === "outgoing" ? "\u2192" : "\u2190"}
                      </span>
                      <span className="text-sm">{conn.nodeTitle}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href={`/crib/${id}`}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-sm rounded-lg transition-colors"
        >
          Generate crib sheet
        </Link>
      </div>
    </div>
  );
}
