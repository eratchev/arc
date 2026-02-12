import { describe, it, expect } from 'vitest';
import { slugify } from '../connectors/sds';

describe('slugify', () => {
  it('converts spaces to dashes', () => {
    expect(slugify('Load Balancer')).toBe('load-balancer');
  });

  it('lowercases the output', () => {
    expect(slugify('CDN')).toBe('cdn');
  });

  it('replaces parentheses with dashes', () => {
    expect(slugify('Cache (Redis)')).toBe('cache-redis');
  });

  it('collapses multiple non-alphanumeric chars into a single dash', () => {
    expect(slugify('one---two')).toBe('one-two');
    expect(slugify('a   b')).toBe('a-b');
  });

  it('removes leading and trailing dashes', () => {
    expect(slugify('--hello--')).toBe('hello');
    expect(slugify('  spaced  ')).toBe('spaced');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles already-slugified input', () => {
    expect(slugify('already-good')).toBe('already-good');
  });

  it('handles numbers', () => {
    expect(slugify('Level 3 Cache')).toBe('level-3-cache');
  });
});
