export type {
  EvaluatorProvider,
  EvaluationPromptInput,
  EvaluationResponseInput,
  LLMEvaluationOutput,
} from './types';

export { ClaudeEvaluator } from './claude';
export { OpenAIEvaluator } from './openai';
export { SYSTEM_PROMPT, buildEvaluationPrompt, EVAL_PROMPT_VERSION } from './prompt';
export { parseEvaluationResponse, validateScores } from './parse';
export { chat } from './chat';
export type { ChatOptions } from './chat';

import { ClaudeEvaluator } from './claude';
import { OpenAIEvaluator } from './openai';
import type { EvaluatorProvider } from './types';

/**
 * Factory function that returns the appropriate evaluator implementation.
 *
 * @param provider - Which LLM provider to use
 * @param apiKey - Optional API key override (falls back to env vars)
 */
export function createEvaluator(
  provider: 'claude' | 'openai',
  apiKey?: string,
): EvaluatorProvider {
  switch (provider) {
    case 'claude':
      return new ClaudeEvaluator(apiKey);
    case 'openai':
      return new OpenAIEvaluator(apiKey);
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unknown evaluator provider: ${exhaustive}`);
    }
  }
}
