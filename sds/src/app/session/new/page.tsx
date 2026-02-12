import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

interface Props {
  searchParams: Promise<{ prompt?: string }>;
}

export default async function NewSession({ searchParams }: Props) {
  const { prompt: promptId } = await searchParams;

  if (!promptId) redirect('/');

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: prompt } = await supabase
    .schema('sds')
    .from('prompts')
    .select('*')
    .eq('id', promptId)
    .single();

  if (!prompt) redirect('/');

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">{prompt.title}</h1>
      <span className="mb-4 inline-block rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
        {prompt.category} · {prompt.difficulty}
      </span>

      <p className="mb-6 text-gray-300">{prompt.description}</p>

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-semibold text-gray-400">Constraints</h3>
        <ul className="space-y-1 text-sm text-gray-300">
          {(prompt.constraints as string[]).map((c: string, i: number) => (
            <li key={i} className="flex gap-2">
              <span className="text-blue-400">•</span> {c}
            </li>
          ))}
        </ul>
      </div>

      <h2 className="mb-4 text-xl font-semibold">Choose Timer Mode</h2>
      <form action={startSession}>
        <input type="hidden" name="prompt_id" value={promptId} />
        <div className="flex gap-4">
          <button
            type="submit"
            name="mode"
            value="30_min"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 p-6 text-center transition hover:border-blue-600"
          >
            <div className="text-3xl font-bold">30</div>
            <div className="text-sm text-gray-400">minutes</div>
          </button>
          <button
            type="submit"
            name="mode"
            value="60_min"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 p-6 text-center transition hover:border-blue-600"
          >
            <div className="text-3xl font-bold">60</div>
            <div className="text-sm text-gray-400">minutes</div>
          </button>
        </div>
      </form>
    </main>
  );
}

async function startSession(formData: FormData) {
  'use server';

  const { createServerClient } = await import('@/lib/supabase/server');
  const { redirect } = await import('next/navigation');

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  const promptId = formData.get('prompt_id') as string;
  const mode = formData.get('mode') as string;

  const { data: session, error } = await supabase
    .schema('sds')
    .from('sessions')
    .insert({
      user_id: user.id,
      prompt_id: promptId,
      mode,
    })
    .select()
    .single();

  if (error || !session) {
    throw new Error('Failed to create session');
  }

  redirect(`/session/${session.id}`);
}
