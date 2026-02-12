import { describe, it, expect } from 'vitest';

// The vector custom type is not directly exported, so we test the
// toDriver/fromDriver logic inline.
describe('vector toDriver / fromDriver', () => {
  // Replicate the toDriver / fromDriver logic from core.ts
  function toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  }

  function fromDriver(value: string): number[] {
    return value
      .slice(1, -1)
      .split(',')
      .map(Number);
  }

  it('converts an array to a pgvector string', () => {
    expect(toDriver([1, 2, 3])).toBe('[1,2,3]');
  });

  it('parses a pgvector string back to an array', () => {
    expect(fromDriver('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('handles an empty array', () => {
    expect(toDriver([])).toBe('[]');
  });

  it('round-trips correctly', () => {
    const original = [0.123, -0.456, 0.789];
    expect(fromDriver(toDriver(original))).toEqual(original);
  });

  it('handles a 1536-element vector', () => {
    const large = Array.from({ length: 1536 }, (_, i) => i / 1536);
    const roundTripped = fromDriver(toDriver(large));
    expect(roundTripped).toHaveLength(1536);
    expect(roundTripped[0]).toBeCloseTo(large[0]);
    expect(roundTripped[1535]).toBeCloseTo(large[1535]);
  });

  it('handles negative numbers and decimals', () => {
    const values = [-1.5, 0, 0.001, 999.999];
    expect(fromDriver(toDriver(values))).toEqual(values);
  });
});
