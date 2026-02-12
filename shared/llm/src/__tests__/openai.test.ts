import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return { chat: { completions: { create: mockCreate } } };
    }),
  };
});

import { OpenAIEvaluator } from '../openai';

const validJson = JSON.stringify({
  overall_score: 75,
  component_score: 80,
  scaling_score: 70,
  reliability_score: 65,
  tradeoff_score: 60,
  components_found: ['cache'],
  components_missing: ['CDN'],
  scaling_gaps: [],
  suggestions: ['add CDN'],
});

const prompt = {
  title: 'Test',
  description: 'Test desc',
  constraints: ['C1'],
  expected_components: ['Cache'],
};

const response = {
  architecture_text: 'Some architecture',
  mermaid_diagram: null,
  notes: null,
};

describe('OpenAIEvaluator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  it('constructs with an explicit API key', () => {
    expect(() => new OpenAIEvaluator('test-key')).not.toThrow();
  });

  it('constructs with env API key', () => {
    process.env.OPENAI_API_KEY = 'env-key';
    expect(() => new OpenAIEvaluator()).not.toThrow();
  });

  it('throws when no API key is available', () => {
    expect(() => new OpenAIEvaluator()).toThrow('OPENAI_API_KEY is required');
  });

  it('evaluates and returns parsed result', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: validJson } }],
    });

    const evaluator = new OpenAIEvaluator('test-key');
    const result = await evaluator.evaluate(prompt, response);

    expect(result.overall_score).toBe(75);
    expect(result.raw_response).toBe(validJson);
  });

  it('throws when no content is returned', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const evaluator = new OpenAIEvaluator('test-key');
    await expect(evaluator.evaluate(prompt, response)).rejects.toThrow('no content');
  });

  it('throws when scores are invalid', async () => {
    const badJson = JSON.stringify({
      overall_score: -5,
      component_score: 80,
      scaling_score: 70,
      reliability_score: 65,
      tradeoff_score: 60,
      components_found: [],
      components_missing: [],
      scaling_gaps: [],
      suggestions: [],
    });

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: badJson } }],
    });

    const evaluator = new OpenAIEvaluator('test-key');
    await expect(evaluator.evaluate(prompt, response)).rejects.toThrow('out of range');
  });
});
