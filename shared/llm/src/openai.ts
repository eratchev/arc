import OpenAI from 'openai';
import type { EvaluationResult } from '@arc/types';
import type {
  EvaluationPromptInput,
  EvaluationResponseInput,
  EvaluatorProvider,
  LLMEvaluationOutput,
} from './types';
import { SYSTEM_PROMPT, buildEvaluationPrompt } from './prompt';
import { parseEvaluationResponse, validateScores } from './parse';

const MODEL = 'gpt-4o';
const MAX_TOKENS = 4096;

export class OpenAIEvaluator implements EvaluatorProvider {
  readonly name = 'openai';
  readonly model = MODEL;

  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error(
        'OPENAI_API_KEY is required. Pass it explicitly or set the environment variable.',
      );
    }
    this.client = new OpenAI({ apiKey: key });
  }

  async evaluate(
    prompt: EvaluationPromptInput,
    response: EvaluationResponseInput,
  ): Promise<EvaluationResult> {
    const userMessage = buildEvaluationPrompt(prompt, response);

    const completion = await this.client.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    const rawResponse = completion.choices[0]?.message?.content;
    if (!rawResponse) {
      throw new Error('OpenAI returned no content in the response.');
    }

    const parsed = parseEvaluationResponse(rawResponse);
    validateScores(parsed);

    return {
      ...parsed,
      raw_response: rawResponse,
    };
  }
}
