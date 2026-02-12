'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'strict',
});

let renderCount = 0;

export function MermaidRenderer({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current || !source.trim()) return;

    setError(null);
    const id = `mermaid-${++renderCount}`;

    mermaid
      .render(id, source)
      .then(({ svg }) => {
        if (ref.current) {
          ref.current.innerHTML = svg;
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Invalid diagram syntax');
      });
  }, [source]);

  if (error) {
    return (
      <div className="rounded border border-red-800 bg-red-950 p-3 text-sm text-red-300">
        Diagram error: {error}
      </div>
    );
  }

  return <div ref={ref} className="overflow-auto" />;
}
