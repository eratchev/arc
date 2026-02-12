'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Timer } from '@/components/Timer';
import { DiagramEditor } from '@/components/diagram/DiagramEditor';
import { createClient } from '@/lib/supabase/client';

interface SessionWorkspaceProps {
  session: {
    id: string;
    started_at: string;
    mode: string;
  };
  prompt: {
    id: string;
    title: string;
    description: string;
    constraints: unknown;
    expected_components: unknown;
  };
  timeLimitMin: number;
  initialResponse: {
    id: string;
    version: number;
    architecture_text: string;
    mermaid_diagram: string | null;
    notes: string | null;
  } | null;
}

export function SessionWorkspace({
  session,
  prompt,
  timeLimitMin,
  initialResponse,
}: SessionWorkspaceProps) {
  const router = useRouter();
  const [architectureText, setArchitectureText] = useState(
    initialResponse?.architecture_text ?? '',
  );
  const [mermaidDiagram, setMermaidDiagram] = useState(
    initialResponse?.mermaid_diagram ?? '',
  );
  const [notes, setNotes] = useState(initialResponse?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeTab, setActiveTab] = useState<'architecture' | 'diagram' | 'notes'>(
    'architecture',
  );
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const saveDraft = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const supabase = createClient();
      const nextVersion = (initialResponse?.version ?? 0) + 1;

      await supabase.schema('sds').from('responses').insert({
        session_id: session.id,
        version: nextVersion,
        architecture_text: architectureText,
        mermaid_diagram: mermaidDiagram || null,
        notes: notes || null,
        is_final: false,
      });
      setLastSaved(new Date().toLocaleTimeString());
    } finally {
      setIsSaving(false);
    }
  }, [session.id, architectureText, mermaidDiagram, notes, initialResponse, isSaving]);

  const submit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const supabase = createClient();

      // Create final response
      const { data: response } = await supabase
        .schema('sds')
        .from('responses')
        .insert({
          session_id: session.id,
          version: (initialResponse?.version ?? 0) + 1,
          architecture_text: architectureText,
          mermaid_diagram: mermaidDiagram || null,
          notes: notes || null,
          is_final: true,
          submitted_at: new Date().toISOString(),
        })
        .select()
        .single();

      // Update session status
      const timeSpent = Math.floor(
        (Date.now() - new Date(session.started_at).getTime()) / 1000,
      );
      await supabase
        .schema('sds')
        .from('sessions')
        .update({
          status: 'submitted',
          ended_at: new Date().toISOString(),
          time_spent_sec: timeSpent,
        })
        .eq('id', session.id);

      // Trigger evaluation via API route
      if (response) {
        fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responseId: response.id }),
        });
      }

      router.push(`/session/${session.id}/review`);
    } finally {
      setIsSubmitting(false);
    }
  }, [session, architectureText, mermaidDiagram, notes, initialResponse, isSubmitting, router]);

  const handleExpire = useCallback(() => {
    submit();
  }, [submit]);

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">{prompt.title}</h1>
          <span className="text-xs text-gray-500">{session.mode.replace('_', ' ')}</span>
        </div>
        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-xs text-gray-600">Saved {lastSaved}</span>
          )}
          <Timer
            durationMin={timeLimitMin}
            startedAt={session.started_at}
            onExpire={handleExpire}
            isPaused={isPaused}
          />
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="rounded bg-gray-800 px-3 py-1.5 text-xs hover:bg-gray-700"
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={saveDraft}
            disabled={isSaving}
            className="rounded bg-gray-700 px-3 py-1.5 text-xs hover:bg-gray-600 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={submit}
            disabled={isSubmitting || !architectureText.trim()}
            className="rounded bg-blue-600 px-4 py-1.5 text-xs font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </header>

      {/* Prompt panel */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-4 py-3">
        <details>
          <summary className="cursor-pointer text-sm font-medium text-gray-400">
            View Prompt Details
          </summary>
          <div className="mt-3 space-y-3 text-sm">
            <p className="text-gray-300">{prompt.description}</p>
            <div>
              <span className="font-medium text-gray-400">Constraints:</span>
              <ul className="mt-1 space-y-0.5 text-gray-400">
                {(prompt.constraints as string[]).map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {(['architecture', 'diagram', 'notes'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm capitalize transition ${
              activeTab === tab
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'architecture' && (
          <textarea
            value={architectureText}
            onChange={(e) => setArchitectureText(e.target.value)}
            className="h-full w-full resize-none bg-gray-950 p-4 font-mono text-sm text-gray-200 outline-none placeholder:text-gray-600"
            placeholder="Describe your system architecture here...

Consider:
- High-level components and their responsibilities
- Data flow between components
- Storage choices (databases, caches, queues)
- Scaling strategy
- Failure handling and recovery
- Trade-offs you're making and why"
          />
        )}
        {activeTab === 'diagram' && (
          <DiagramEditor value={mermaidDiagram} onChange={setMermaidDiagram} />
        )}
        {activeTab === 'notes' && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-full w-full resize-none bg-gray-950 p-4 text-sm text-gray-200 outline-none placeholder:text-gray-600"
            placeholder="Additional notes, assumptions, or trade-off rationale..."
          />
        )}
      </div>
    </div>
  );
}
