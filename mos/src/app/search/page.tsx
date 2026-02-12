"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

interface SearchResult {
  id: string;
  title: string;
  type: string;
  snippet: string;
  score: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
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

      <h1 className="text-2xl font-bold mb-6">Search your memory</h1>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by meaning, not just keywords..."
            className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {loading && (
        <div className="text-center py-12 text-gray-400">Searching...</div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No results found for &ldquo;{query}&rdquo;
        </div>
      )}

      <div className="space-y-4">
        {results.map((result) => (
          <Link
            key={result.id}
            href={`/node/${result.id}`}
            className="block p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-medium">{result.title}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {Math.round(result.score * 100)}% match
                </span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                  {result.type}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-400 line-clamp-2">{result.snippet}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
