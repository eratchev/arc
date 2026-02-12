import { createServerClient } from '@/lib/supabase/server';
import GraphExplorer from '@/components/GraphExplorer';
import { PracticeSuggestions } from '@/components/PracticeSuggestions';

export default async function HomePage() {
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Please sign in to view your knowledge graph.</p>
      </div>
    );
  }

  const { data: nodes } = await supabase
    .schema('mos')
    .from('nodes')
    .select('*')
    .order('updated_at', { ascending: false });

  const { data: edges } = await supabase
    .schema('mos')
    .from('edges')
    .select('*');

  const sdsUrl = process.env.NEXT_PUBLIC_SDS_URL ?? 'http://localhost:3000';

  return (
    <main className="flex h-screen">
      <GraphExplorer nodes={nodes ?? []} edges={edges ?? []} />
      <div className="absolute bottom-4 right-4 z-10 w-80">
        <PracticeSuggestions sdsUrl={sdsUrl} />
      </div>
    </main>
  );
}
