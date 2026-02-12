import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { DashboardCharts } from './DashboardCharts';

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch all evaluated sessions with their scores
  const { data: sessions } = await supabase
    .schema('sds')
    .from('sessions')
    .select(`
      id, mode, started_at, time_spent_sec, status,
      prompts:prompt_id(title, category, difficulty),
      responses!inner(
        id, is_final,
        evaluations(
          overall_score, component_score, scaling_score,
          reliability_score, tradeoff_score, evaluated_at
        )
      )
    `)
    .eq('status', 'evaluated')
    .eq('responses.is_final', true)
    .order('started_at', { ascending: true });

  type SessionRow = {
    id: string;
    mode: string;
    started_at: string;
    time_spent_sec: number | null;
    prompts: { title: string; category: string; difficulty: string };
    responses: Array<{
      evaluations: Array<{
        overall_score: number;
        component_score: number;
        scaling_score: number;
        reliability_score: number;
        tradeoff_score: number;
        evaluated_at: string;
      }>;
    }>;
  };

  const chartData = (sessions as unknown as SessionRow[] ?? []).map((s) => {
    const eval_ = s.responses?.[0]?.evaluations?.[0];
    return {
      date: new Date(s.started_at).toLocaleDateString(),
      title: s.prompts?.title ?? 'Unknown',
      category: s.prompts?.category ?? '',
      overall: eval_?.overall_score ?? 0,
      components: eval_?.component_score ?? 0,
      scaling: eval_?.scaling_score ?? 0,
      reliability: eval_?.reliability_score ?? 0,
      tradeoffs: eval_?.tradeoff_score ?? 0,
    };
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Link
          href="/"
          className="rounded bg-gray-800 px-3 py-1.5 text-sm hover:bg-gray-700"
        >
          Back to Home
        </Link>
      </div>

      {chartData.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center">
          <p className="text-gray-400">No evaluated sessions yet.</p>
          <Link href="/" className="mt-2 inline-block text-blue-400 hover:underline">
            Start your first session
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-4 gap-4">
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center">
              <div className="text-2xl font-bold">{chartData.length}</div>
              <div className="text-xs text-gray-500">Sessions</div>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">
                {Math.round(
                  chartData.reduce((sum, d) => sum + d.overall, 0) / chartData.length,
                )}
              </div>
              <div className="text-xs text-gray-500">Avg Score</div>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                {Math.max(...chartData.map((d) => d.overall))}
              </div>
              <div className="text-xs text-gray-500">Best Score</div>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center">
              <div className="text-2xl font-bold">
                {new Set(chartData.map((d) => d.category)).size}
              </div>
              <div className="text-xs text-gray-500">Categories</div>
            </div>
          </div>

          <DashboardCharts data={chartData} />
        </>
      )}
    </main>
  );
}
