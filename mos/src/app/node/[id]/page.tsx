import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { NodeDetail } from "@/components/NodeDetail";
import type { Connection } from "@/lib/graph/nodeEnrichment";

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

  // Fetch edges
  const { data: outgoingEdges } = await supabase
    .schema("mos")
    .from("edges")
    .select("id, edge_type, target_id")
    .eq("source_id", id)
    .eq("user_id", user.id);

  const { data: incomingEdges } = await supabase
    .schema("mos")
    .from("edges")
    .select("id, edge_type, source_id")
    .eq("target_id", id)
    .eq("user_id", user.id);

  // Resolve connected node titles
  const connectedIds = [
    ...(outgoingEdges ?? []).map((e) => e.target_id),
    ...(incomingEdges ?? []).map((e) => e.source_id),
  ];

  const { data: connectedNodes } =
    connectedIds.length > 0
      ? await supabase
          .schema("mos")
          .from("nodes")
          .select("id, title")
          .in("id", connectedIds)
      : { data: [] };

  const titleMap = new Map(
    (connectedNodes ?? []).map((n: { id: string; title: string }) => [n.id, n.title]),
  );

  const connections: Connection[] = [
    ...(outgoingEdges ?? []).map((e) => ({
      edgeId: e.id,
      edgeType: e.edge_type,
      nodeId: e.target_id,
      nodeTitle: titleMap.get(e.target_id) ?? "Unknown",
      direction: "outgoing" as const,
    })),
    ...(incomingEdges ?? []).map((e) => ({
      edgeId: e.id,
      edgeType: e.edge_type,
      nodeId: e.source_id,
      nodeTitle: titleMap.get(e.source_id) ?? "Unknown",
      direction: "incoming" as const,
    })),
  ];

  return <NodeDetail node={node} connections={connections} />;
}
