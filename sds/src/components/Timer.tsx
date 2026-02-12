'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface TimerProps {
  durationMin: number;
  startedAt: string;
  onExpire: () => void;
  isPaused?: boolean;
}

export function Timer({ durationMin, startedAt, onExpire, isPaused = false }: TimerProps) {
  const [remainingSec, setRemainingSec] = useState(() => {
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    return Math.max(0, durationMin * 60 - elapsed);
  });
  const expireCalled = useRef(false);

  useEffect(() => {
    if (isPaused || remainingSec <= 0) return;

    const interval = setInterval(() => {
      setRemainingSec((prev) => {
        const next = prev - 1;
        if (next <= 0 && !expireCalled.current) {
          expireCalled.current = true;
          onExpire();
          return 0;
        }
        return Math.max(0, next);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, remainingSec, onExpire]);

  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  const isUrgent = remainingSec < 300; // < 5 minutes
  const isCritical = remainingSec < 60; // < 1 minute

  return (
    <div
      className={`rounded-lg px-4 py-2 font-mono text-2xl font-bold tabular-nums ${
        isCritical
          ? 'bg-red-950 text-red-400 animate-pulse'
          : isUrgent
            ? 'bg-yellow-950 text-yellow-400'
            : 'bg-gray-800 text-gray-200'
      }`}
    >
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      {isPaused && <span className="ml-2 text-sm text-gray-500">PAUSED</span>}
    </div>
  );
}
