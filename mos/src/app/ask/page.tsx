"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

interface SourceNode {
  id: string;
  title: string;
  type: string;
}

interface Answer {
  text: string;
  sources: SourceNode[];
}

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });

      if (!res.ok) {
        throw new Error(res.status === 401 ? "Please sign in first" : "Failed to get answer");
      }

      const data = await res.json();
      setAnswer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          &larr; Back to graph
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-2">Ask your memory</h1>
      <p className="text-gray-400 mb-8">
        What do I know about...?
      </p>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What do I know about React Server Components?"
            className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? "Thinking..." : "Ask"}
          </button>
        </div>
      </form>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          <p className="mt-3 text-gray-400">Synthesizing from your knowledge graph...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {answer && (
        <div className="space-y-6">
          <div className="p-6 bg-gray-900 border border-gray-800 rounded-lg">
            <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">
              {answer.text}
            </div>
          </div>

          {answer.sources.length > 0 && (
            <div>
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Sources used
              </h2>
              <div className="grid gap-2">
                {answer.sources.map((source) => (
                  <Link
                    key={source.id}
                    href={`/node/${source.id}`}
                    className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors"
                  >
                    <span className="text-sm">{source.title}</span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-800 text-gray-400">
                      {source.type}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
