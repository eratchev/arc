import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export interface ChatOptions {
  provider?: 'claude' | 'openai';
  model?: string;
  maxTokens?: number;
}

/**
 * General-purpose chat completion for MOS summarization, crib sheets, etc.
 * Simpler than the evaluator — just system + user prompt → text response.
 */
export async function chat(
  systemPrompt: string,
  userPrompt: string,
  options: ChatOptions = {},
): Promise<string> {
  const provider = options.provider ?? (process.env.LLM_PROVIDER as 'claude' | 'openai') ?? 'claude';

  if (provider === 'claude') {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: options.model ?? 'claude-sonnet-4-5-20250929',
      max_tokens: options.maxTokens ?? 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock?.text ?? '';
  }

  if (provider === 'openai') {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: options.model ?? 'gpt-4o',
      max_tokens: options.maxTokens ?? 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });
    return response.choices[0]?.message?.content ?? '';
  }

  throw new Error(`Unknown chat provider: ${provider}`);
}
