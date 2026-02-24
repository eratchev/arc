import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { ScoreRadar } from './ScoreRadar';
import { ReEvaluateButton } from './ReEvaluateButton';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReviewPage({ params }: Props) {
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

  const { data: prompt } = await supabase
    .schema('sds')
    .from('prompts')
    .select('*')
    .eq('id', session.prompt_id)
    .single();

  const { data: response } = await supabase
    .schema('sds')
    .from('responses')
    .select('*')
    .eq('session_id', id)
    .eq('is_final', true)
    .maybeSingle();

  const evaluation = response
    ? (
        await supabase
          .schema('sds')
          .from('evaluations')
          .select('*')
          .eq('response_id', response.id)
          .order('evaluated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data
    : null;

  // Fetch MOS sync records for "View in your graph" links
  const { data: mosSyncRecords } = await supabase
    .schema('sds')
    .from('mos_sync')
    .select('*')
    .eq('session_id', id);

  const mosBaseUrl = process.env.NEXT_PUBLIC_MOS_URL ?? 'http://localhost:3001';

  const timeSpent = session.time_spent_sec
    ? `${Math.floor(session.time_spent_sec / 60)}m ${session.time_spent_sec % 60}s`
    : 'N/A';

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{prompt?.title}</h1>
          <p className="text-sm text-gray-500">
            {session.mode.replace('_', ' ')} · {timeSpent} · {session.status}
          </p>
        </div>
        <Link
          href="/"
          className="rounded bg-gray-800 px-3 py-1.5 text-sm hover:bg-gray-700"
        >
          Back to Home
        </Link>
      </div>

      {session.status === 'submitted' && !evaluation && (
        <div className="mb-8 rounded-lg border border-yellow-800 bg-yellow-950 p-4 text-yellow-300">
          <p>Your submission is being evaluated. Refresh this page in a moment.</p>
          {response && <ReEvaluateButton responseId={response.id} />}
        </div>
      )}

      {evaluation && (
        <>
          {/* Overall Score */}
          <div className="mb-8 rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
            <div className="text-6xl font-bold text-blue-400">
              {evaluation.overall_score}
            </div>
            <div className="mt-1 text-sm text-gray-500">Overall Score</div>
          </div>

          {/* Score Breakdown */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
              <ScoreRadar
                scores={{
                  Components: evaluation.component_score,
                  Scaling: evaluation.scaling_score,
                  Reliability: evaluation.reliability_score,
                  'Trade-offs': evaluation.tradeoff_score,
                }}
              />
            </div>
            <div className="space-y-3">
              {[
                { label: 'Components', score: evaluation.component_score, color: 'blue' },
                { label: 'Scaling', score: evaluation.scaling_score, color: 'green' },
                { label: 'Reliability', score: evaluation.reliability_score, color: 'yellow' },
                { label: 'Trade-offs', score: evaluation.tradeoff_score, color: 'purple' },
              ].map(({ label, score, color }) => (
                <div
                  key={label}
                  className="rounded-lg border border-gray-800 bg-gray-900 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">{label}</span>
                    <span className="font-mono font-bold">{score}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-800">
                    <div
                      className={`h-full rounded-full bg-${color}-500`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Components Analysis */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <h3 className="mb-3 font-semibold text-green-400">
                Components Found ({(evaluation.components_found as string[]).length})
              </h3>
              <ul className="space-y-1 text-sm">
                {(evaluation.components_found as string[]).map((c, i) => (
                  <li key={i} className="text-gray-300">
                    <span className="text-green-500">✓</span> {c}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
              <h3 className="mb-3 font-semibold text-red-400">
                Components Missing ({(evaluation.components_missing as string[]).length})
              </h3>
              <ul className="space-y-1 text-sm">
                {(evaluation.components_missing as string[]).map((c, i) => (
                  <li key={i} className="text-gray-300">
                    <span className="text-red-500">✗</span> {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Scaling Gaps */}
          {(evaluation.scaling_gaps as string[]).length > 0 && (
            <div className="mb-8 rounded-lg border border-gray-800 bg-gray-900 p-4">
              <h3 className="mb-3 font-semibold text-yellow-400">Scaling Gaps</h3>
              <ul className="space-y-1 text-sm text-gray-300">
                {(evaluation.scaling_gaps as string[]).map((g, i) => (
                  <li key={i}>• {g}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          <div className="mb-8 rounded-lg border border-gray-800 bg-gray-900 p-4">
            <h3 className="mb-3 font-semibold text-blue-400">Suggestions</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              {(evaluation.suggestions as string[]).map((s, i) => (
                <li key={i}>• {s}</li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* View in MOS Graph */}
      {mosSyncRecords && mosSyncRecords.length > 0 && (
        <div className="mb-8 rounded-lg border border-blue-800/50 bg-blue-950/30 p-4">
          <h3 className="mb-3 font-semibold text-blue-400">
            View in Your Knowledge Graph
          </h3>
          <p className="mb-3 text-sm text-gray-400">
            This session has been synced to your Memory OS graph.
          </p>
          <div className="flex flex-wrap gap-2">
            {mosSyncRecords
              .filter((r) => r.source_type === 'session')
              .map((r) => (
                <a
                  key={r.id}
                  href={`${mosBaseUrl}/node/${r.mos_node_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-blue-900 px-3 py-1.5 text-xs text-blue-200 transition hover:bg-blue-800"
                >
                  Session Node
                </a>
              ))}
            {mosSyncRecords
              .filter((r) => r.source_type === 'concept')
              .map((r) => (
                <a
                  key={r.id}
                  href={`${mosBaseUrl}/node/${r.mos_node_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-300 transition hover:bg-gray-700"
                >
                  {r.source_key.replace(/-/g, ' ')}
                </a>
              ))}
          </div>
          <a
            href={mosBaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs text-blue-400 hover:underline"
          >
            Open full graph explorer
          </a>
        </div>
      )}

      {/* Submitted Response */}
      {response && (
        <details className="rounded-lg border border-gray-800 bg-gray-900">
          <summary className="cursor-pointer p-4 text-sm font-medium text-gray-400">
            View Your Response
          </summary>
          <div className="border-t border-gray-800 p-4">
            <pre className="whitespace-pre-wrap text-sm text-gray-300">
              {response.architecture_text}
            </pre>
            {response.notes && (
              <div className="mt-4 border-t border-gray-800 pt-4">
                <h4 className="mb-2 text-sm font-medium text-gray-400">Notes</h4>
                <p className="text-sm text-gray-300">{response.notes}</p>
              </div>
            )}
          </div>
        </details>
      )}
    </main>
  );
}
