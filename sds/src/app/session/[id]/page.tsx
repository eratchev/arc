import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { SessionWorkspace } from './SessionWorkspace';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: session } = await supabase
    .schema('sds')
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (!session) redirect('/');
  if (session.status !== 'in_progress') redirect(`/session/${id}/review`);

  const { data: prompt } = await supabase
    .schema('sds')
    .from('prompts')
    .select('*')
    .eq('id', session.prompt_id)
    .single();

  if (!prompt) redirect('/');

  // Get latest response draft if any
  const { data: latestResponse } = await supabase
    .schema('sds')
    .from('responses')
    .select('*')
    .eq('session_id', id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const timeLimitMin = session.mode === '30_min' ? 30 : 60;

  return (
    <SessionWorkspace
      session={session}
      prompt={prompt}
      timeLimitMin={timeLimitMin}
      initialResponse={latestResponse}
    />
  );
}
