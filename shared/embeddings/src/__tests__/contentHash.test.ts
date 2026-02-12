import { describe, it, expect } from 'vitest';
import { contentHash } from '../index';

describe('contentHash', () => {
  it('returns a deterministic hash', () => {
    const hash1 = contentHash('hello world');
    const hash2 = contentHash('hello world');
    expect(hash1).toBe(hash2);
  });

  it('returns different hashes for different inputs', () => {
    const hash1 = contentHash('hello');
    const hash2 = contentHash('world');
    expect(hash1).not.toBe(hash2);
  });

  it('returns a 64-character hex string', () => {
    const hash = contentHash('test');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles empty string', () => {
    const hash = contentHash('');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles unicode', () => {
    const hash = contentHash('日本語テスト');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
