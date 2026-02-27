import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEmbeddingsCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return { embeddings: { create: mockEmbeddingsCreate } };
    }),
  };
});

import { OpenAIEmbeddings, createEmbeddingProvider } from '../index';

describe('OpenAIEmbeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('embed', () => {
    it('returns a single embedding vector', async () => {
      const vector = [0.1, 0.2, 0.3];
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: vector, index: 0 }],
      });

      const provider = new OpenAIEmbeddings('test-key');
      const result = await provider.embed('hello');

      expect(result).toEqual(vector);
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'hello',
      });
    });

    it('throws when API returns empty data array', async () => {
      mockEmbeddingsCreate.mockResolvedValue({ data: [] });
      const provider = new OpenAIEmbeddings('test-key');
      await expect(provider.embed('hello')).rejects.toThrow('No embedding returned from OpenAI');
    });
  });

  describe('embedBatch', () => {
    it('returns sorted embedding vectors', async () => {
      mockEmbeddingsCreate.mockResolvedValue({
        data: [
          { embedding: [0.3], index: 1 },
          { embedding: [0.1], index: 0 },
        ],
      });

      const provider = new OpenAIEmbeddings('test-key');
      const result = await provider.embedBatch(['a', 'b']);

      expect(result).toEqual([[0.1], [0.3]]);
    });
  });

  it('has correct model and provider', () => {
    const provider = new OpenAIEmbeddings('test-key');
    expect(provider.model).toBe('text-embedding-3-small');
    expect(provider.provider).toBe('openai');
  });
});

describe('createEmbeddingProvider', () => {
  it('returns an OpenAIEmbeddings instance', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const provider = createEmbeddingProvider('openai');
    expect(provider).toBeInstanceOf(OpenAIEmbeddings);
  });
});
