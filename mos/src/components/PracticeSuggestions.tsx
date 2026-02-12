'use client';

import { useEffect, useState } from 'react';

interface Suggestion {
  concept_id: string;
  title: string;
  slug: string;
  last_practiced: string | null;
  days_since_practice: number | null;
  is_stale: boolean;
}

export function PracticeSuggestions({ sdsUrl }: { sdsUrl: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/suggestions')
      .then((r) => r.json())
      .then((data) => setSuggestions(data.suggestions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-lg border border-yellow-800/50 bg-yellow-950/20 p-4">
      <h3 className="mb-3 text-sm font-semibold text-yellow-400">
        Practice Suggestions
      </h3>
      <p className="mb-3 text-xs text-gray-400">
        These concepts haven&apos;t been practiced in over 2 weeks:
      </p>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <div
            key={s.concept_id}
            className="flex items-center justify-between rounded bg-gray-900 px-3 py-2"
          >
            <div>
              <span className="text-sm text-gray-200">{s.title}</span>
              <span className="ml-2 text-xs text-gray-500">
                {s.days_since_practice === null
                  ? 'Never practiced'
                  : `${s.days_since_practice}d ago`}
              </span>
            </div>
            <a
              href={sdsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-yellow-900 px-2 py-1 text-xs text-yellow-200 transition hover:bg-yellow-800"
            >
              Practice
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
