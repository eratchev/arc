import OpenAI from 'openai';
import { createHash } from 'crypto';

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly model: string;
  readonly provider: string;
}

export class OpenAIEmbeddings implements EmbeddingProvider {
  private client: OpenAI;
  readonly model = 'text-embedding-3-small';
  readonly provider = 'openai';

  constructor(apiKey?: string) {
    this.client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    const embedding = result.data[0]?.embedding;
    if (!embedding) throw new Error('No embedding returned from OpenAI');
    return embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const result = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return result.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }
}

export function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function createEmbeddingProvider(
  provider: 'openai' = 'openai',
): EmbeddingProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIEmbeddings();
    default:
      throw new Error(`Unknown embedding provider: ${provider}`);
  }
}
