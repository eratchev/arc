import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createEdge, deleteEdge } from "@/lib/graph/engine";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { source_id, target_id, edge_type } = body;

  if (!source_id || !target_id || !edge_type) {
    return NextResponse.json(
      { error: "source_id, target_id, and edge_type are required" },
      { status: 400 },
    );
  }

  const edge = await createEdge(supabase, {
    user_id: user.id,
    source_id,
    target_id,
    edge_type,
  });

  return NextResponse.json({ edge }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const edgeId = searchParams.get("id");

  if (!edgeId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await deleteEdge(supabase, edgeId);

  return NextResponse.json({ success: true });
}
