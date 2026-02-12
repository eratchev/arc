import { describe, it, expect, vi } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return { messages: { create: vi.fn() } };
    }),
  };
});

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return { chat: { completions: { create: vi.fn() } } };
    }),
  };
});

import { createEvaluator } from '../index';
import { ClaudeEvaluator } from '../claude';
import { OpenAIEvaluator } from '../openai';

describe('createEvaluator', () => {
  it('returns a ClaudeEvaluator for "claude"', () => {
    const evaluator = createEvaluator('claude', 'test-key');
    expect(evaluator).toBeInstanceOf(ClaudeEvaluator);
    expect(evaluator.name).toBe('claude');
  });

  it('returns an OpenAIEvaluator for "openai"', () => {
    const evaluator = createEvaluator('openai', 'test-key');
    expect(evaluator).toBeInstanceOf(OpenAIEvaluator);
    expect(evaluator.name).toBe('openai');
  });
});
