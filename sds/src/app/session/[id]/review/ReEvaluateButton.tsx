'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ReEvaluateButton({ responseId }: { responseId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleReEvaluate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Evaluation failed');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <button
        onClick={handleReEvaluate}
        disabled={loading}
        className="rounded bg-yellow-700 px-4 py-2 text-sm font-medium text-yellow-100 hover:bg-yellow-600 disabled:opacity-50"
      >
        {loading ? 'Evaluating…' : 'Re-evaluate now'}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
