import { describe, it, expect } from 'vitest';
import { mergeResults } from '../hybrid';
import type { SearchResult } from '../hybrid';
import type { Node } from '@arc/types';

function makeNode(id: string, title = `Node ${id}`): Node {
  return {
    id,
    user_id: 'u1',
    type: 'concept',
    slug: id,
    title,
    content: null,
    summary: null,
    metadata: {},
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

function makeResult(id: string, score: number, source: SearchResult['source']): SearchResult {
  return { node: makeNode(id), score, source };
}

describe('mergeResults', () => {
  it('returns empty array when both inputs are empty', () => {
    expect(mergeResults([], [], 10)).toEqual([]);
  });

  it('returns vector-only results with vector source', () => {
    const vector = [makeResult('a', 0.9, 'vector')];
    const result = mergeResults(vector, [], 10);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('vector');
    expect(result[0].score).toBeCloseTo(0.9 * 0.7);
  });

  it('returns keyword-only results with keyword source', () => {
    const keyword = [makeResult('a', 0.8, 'keyword')];
    const result = mergeResults([], keyword, 10);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('keyword');
    expect(result[0].score).toBeCloseTo(0.8 * 0.3);
  });

  it('merges overlapping results as hybrid', () => {
    const vector = [makeResult('a', 0.9, 'vector')];
    const keyword = [makeResult('a', 0.8, 'keyword')];
    const result = mergeResults(vector, keyword, 10);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('hybrid');
    expect(result[0].score).toBeCloseTo(0.9 * 0.7 + 0.8 * 0.3);
  });

  it('respects the limit parameter', () => {
    const vector = [
      makeResult('a', 0.9, 'vector'),
      makeResult('b', 0.8, 'vector'),
      makeResult('c', 0.7, 'vector'),
    ];
    const result = mergeResults(vector, [], 2);
    expect(result).toHaveLength(2);
  });

  it('sorts by combined score descending', () => {
    const vector = [
      makeResult('a', 0.5, 'vector'),
      makeResult('b', 0.9, 'vector'),
    ];
    const keyword = [makeResult('a', 1.0, 'keyword')];
    const result = mergeResults(vector, keyword, 10);
    // a: 0.5*0.7 + 1.0*0.3 = 0.65
    // b: 0.9*0.7 + 0   = 0.63
    expect(result[0].node.id).toBe('a');
    expect(result[1].node.id).toBe('b');
  });

  it('deduplicates nodes by id', () => {
    const vector = [makeResult('a', 0.9, 'vector')];
    const keyword = [makeResult('a', 0.8, 'keyword')];
    const result = mergeResults(vector, keyword, 10);
    expect(result).toHaveLength(1);
  });

  it('handles mixed unique and overlapping results', () => {
    const vector = [makeResult('a', 0.9, 'vector'), makeResult('b', 0.7, 'vector')];
    const keyword = [makeResult('a', 0.8, 'keyword'), makeResult('c', 0.6, 'keyword')];
    const result = mergeResults(vector, keyword, 10);
    expect(result).toHaveLength(3);

    const sources = new Map(result.map((r) => [r.node.id, r.source]));
    expect(sources.get('a')).toBe('hybrid');
    expect(sources.get('b')).toBe('vector');
    expect(sources.get('c')).toBe('keyword');
  });
});
