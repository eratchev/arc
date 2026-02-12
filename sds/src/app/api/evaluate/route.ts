import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const { responseId } = await request.json();
  if (!responseId) {
    return NextResponse.json({ error: 'responseId required' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch the response and its session/prompt
  const { data: response } = await supabase
    .schema('sds')
    .from('responses')
    .select('*, sessions:session_id(*, prompts:prompt_id(*))')
    .eq('id', responseId)
    .single();

  if (!response) {
    return NextResponse.json({ error: 'Response not found' }, { status: 404 });
  }

  const session = response.sessions as Record<string, unknown>;
  const prompt = session.prompts as Record<string, unknown>;

  // Dynamically import evaluator to keep it server-only
  const { createEvaluator } = await import('@arc/llm');
  const provider = process.env.LLM_PROVIDER === 'openai' ? 'openai' : 'claude';
  const evaluator = createEvaluator(provider);

  const result = await evaluator.evaluate(
    {
      title: prompt.title as string,
      description: prompt.description as string,
      constraints: prompt.constraints as string[],
      expected_components: prompt.expected_components as string[],
    },
    {
      architecture_text: response.architecture_text,
      mermaid_diagram: response.mermaid_diagram,
      notes: response.notes,
    },
  );

  // Store evaluation
  const { error: evalError } = await supabase.schema('sds').from('evaluations').insert({
    response_id: responseId,
    llm_provider: evaluator.name,
    llm_model: evaluator.model,
    raw_response: result.raw_response,
    overall_score: result.overall_score,
    component_score: result.component_score,
    scaling_score: result.scaling_score,
    reliability_score: result.reliability_score,
    tradeoff_score: result.tradeoff_score,
    components_found: result.components_found,
    components_missing: result.components_missing,
    scaling_gaps: result.scaling_gaps,
    suggestions: result.suggestions,
  });

  if (evalError) {
    console.error('Failed to store evaluation:', evalError);
    return NextResponse.json({ error: 'Failed to store evaluation' }, { status: 500 });
  }

  // Update session status to evaluated
  await supabase
    .schema('sds')
    .from('sessions')
    .update({ status: 'evaluated' })
    .eq('id', session.id as string);

  // Sync to MOS knowledge graph (fire-and-forget, don't block response)
  import('@/lib/connectors/mos-sync').then(({ syncSessionToMOS }) => {
    syncSessionToMOS(
      {
        id: session.id as string,
        user_id: session.user_id as string,
        prompt_id: session.prompt_id as string,
        mode: session.mode as string,
        status: 'evaluated',
        started_at: session.started_at as string,
        ended_at: session.ended_at as string | null,
        time_spent_sec: session.time_spent_sec as number | null,
      },
      {
        id: responseId,
        overall_score: result.overall_score,
        component_score: result.component_score,
        scaling_score: result.scaling_score,
        reliability_score: result.reliability_score,
        tradeoff_score: result.tradeoff_score,
        components_found: result.components_found,
      },
    ).catch((err) => console.error('MOS sync failed:', err));
  });

  return NextResponse.json({ success: true });
}
