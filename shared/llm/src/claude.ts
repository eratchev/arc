import Anthropic from '@anthropic-ai/sdk';
import type { EvaluationResult } from '@arc/types';
import type {
  EvaluationPromptInput,
  EvaluationResponseInput,
  EvaluatorProvider,
  LLMEvaluationOutput,
} from './types';
import { SYSTEM_PROMPT, buildEvaluationPrompt } from './prompt';
import { parseEvaluationResponse, validateScores } from './parse';

const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 4096;

export class ClaudeEvaluator implements EvaluatorProvider {
  readonly name = 'claude';
  readonly model = MODEL;

  private client: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        'ANTHROPIC_API_KEY is required. Pass it explicitly or set the environment variable.',
      );
    }
    this.client = new Anthropic({ apiKey: key });
  }

  async evaluate(
    prompt: EvaluationPromptInput,
    response: EvaluationResponseInput,
  ): Promise<EvaluationResult> {
    const userMessage = buildEvaluationPrompt(prompt, response);

    const completion = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = completion.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text content in the response.');
    }

    const rawResponse = textBlock.text;
    const parsed = parseEvaluationResponse(rawResponse);
    validateScores(parsed);

    return {
      ...parsed,
      raw_response: rawResponse,
    };
  }
}
