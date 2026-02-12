import { createServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { generateCribSheet } from '@/lib/summarize';

export default async function CribSheetPage({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  const { nodeId } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Please sign in to view crib sheets.</p>
      </div>
    );
  }

  const { data: node } = await supabase
    .schema('mos')
    .from('nodes')
    .select('*')
    .eq('id', nodeId)
    .single();

  if (!node) notFound();

  const cribSheet = await generateCribSheet(supabase, user.id, nodeId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <Link
          href={`/node/${nodeId}`}
          className="text-sm text-gray-400 transition-colors hover:text-gray-200"
        >
          &larr; Back to {node.title}
        </Link>
      </div>

      <h1 className="mb-2 text-2xl font-bold">Crib Sheet</h1>
      <p className="mb-8 text-gray-400">Prep doc for: {node.title}</p>

      <div className="prose prose-invert max-w-none rounded-lg border border-gray-800 bg-gray-900 p-6">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
          {cribSheet}
        </div>
      </div>
    </div>
  );
}
