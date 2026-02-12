'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

const MermaidRenderer = dynamic(() =>
  import('./MermaidRenderer').then((mod) => ({ default: mod.MermaidRenderer })),
  { ssr: false, loading: () => <div className="p-4 text-gray-500">Loading diagram renderer...</div> },
);

const TEMPLATES = {
  microservices: `graph TD
    Client[Client] --> LB[Load Balancer]
    LB --> API[API Gateway]
    API --> SvcA[Service A]
    API --> SvcB[Service B]
    SvcA --> DB1[(Database A)]
    SvcB --> DB2[(Database B)]
    SvcA --> Queue[Message Queue]
    Queue --> SvcB`,
  'event-driven': `graph TD
    Producer[Event Producer] --> Broker[Message Broker]
    Broker --> Consumer1[Consumer 1]
    Broker --> Consumer2[Consumer 2]
    Consumer1 --> DB[(Database)]
    Consumer2 --> Cache[(Cache)]
    Broker --> DLQ[Dead Letter Queue]`,
  pipeline: `graph LR
    Input[Input] --> Stage1[Stage 1]
    Stage1 --> Stage2[Stage 2]
    Stage2 --> Stage3[Stage 3]
    Stage3 --> Output[Output]
    Stage1 --> Error[Error Handler]
    Stage2 --> Error
    Stage3 --> Error`,
};

interface DiagramEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function DiagramEditor({ value, onChange }: DiagramEditorProps) {
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  const applyTemplate = useCallback(
    (key: string) => {
      onChange(TEMPLATES[key as keyof typeof TEMPLATES]);
      setActiveTemplate(key);
    },
    [onChange],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-gray-800 p-2">
        <span className="text-xs text-gray-500">Templates:</span>
        {Object.keys(TEMPLATES).map((key) => (
          <button
            key={key}
            onClick={() => applyTemplate(key)}
            className={`rounded px-2 py-1 text-xs transition ${
              activeTemplate === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-2 divide-x divide-gray-800">
        <div className="flex flex-col">
          <div className="border-b border-gray-800 px-3 py-1.5 text-xs font-medium text-gray-500">
            Mermaid Source
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 resize-none bg-gray-950 p-3 font-mono text-sm text-gray-200 outline-none placeholder:text-gray-600"
            placeholder="Enter Mermaid diagram syntax..."
            spellCheck={false}
          />
        </div>
        <div className="flex flex-col">
          <div className="border-b border-gray-800 px-3 py-1.5 text-xs font-medium text-gray-500">
            Preview
          </div>
          <div className="flex-1 overflow-auto bg-gray-900 p-4">
            {value.trim() ? (
              <MermaidRenderer source={value} />
            ) : (
              <p className="text-sm text-gray-600">
                Enter Mermaid syntax or select a template to get started.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
