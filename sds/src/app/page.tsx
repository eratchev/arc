import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createServerClient();
  const { data: prompts } = await supabase
    .schema('sds')
    .from('prompts')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: recentSessions } = await supabase
    .schema('sds')
    .from('sessions')
    .select('*, prompts:prompt_id(title, category)')
    .order('started_at', { ascending: false })
    .limit(5);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="mb-2 text-4xl font-bold">System Design Simulator</h1>
      <p className="mb-10 text-gray-400">
        Practice system design under time pressure. Get AI-scored feedback.
      </p>

      <section className="mb-12">
        <h2 className="mb-4 text-2xl font-semibold">Start a New Session</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {prompts?.map((prompt) => (
            <Link
              key={prompt.id}
              href={`/session/new?prompt=${prompt.id}`}
              className="rounded-lg border border-gray-800 bg-gray-900 p-5 transition hover:border-blue-600"
            >
              <h3 className="mb-1 font-semibold">{prompt.title}</h3>
              <div className="mb-2 flex gap-2">
                <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                  {prompt.category}
                </span>
                <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                  {prompt.difficulty}
                </span>
              </div>
              <p className="text-sm text-gray-400">
                {prompt.description.slice(0, 120)}...
              </p>
            </Link>
          ))}
        </div>
      </section>

      {recentSessions && recentSessions.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-2xl font-semibold">Recent Sessions</h2>
          <div className="space-y-3">
            {recentSessions.map((session) => (
              <Link
                key={session.id}
                href={
                  session.status === 'in_progress'
                    ? `/session/${session.id}`
                    : `/session/${session.id}/review`
                }
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 p-4 transition hover:border-blue-600"
              >
                <div>
                  <span className="font-medium">
                    {(session.prompts as { title: string })?.title}
                  </span>
                  <span className="ml-3 text-sm text-gray-500">
                    {session.mode.replace('_', ' ')}
                  </span>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    session.status === 'evaluated'
                      ? 'bg-green-900 text-green-300'
                      : session.status === 'submitted'
                        ? 'bg-yellow-900 text-yellow-300'
                        : 'bg-blue-900 text-blue-300'
                  }`}
                >
                  {session.status}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-4">
        <Link
          href="/dashboard"
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm transition hover:bg-gray-700"
        >
          View Dashboard
        </Link>
      </div>
    </main>
  );
}
