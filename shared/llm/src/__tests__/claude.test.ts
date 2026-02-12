import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return { messages: { create: mockCreate } };
    }),
  };
});

import { ClaudeEvaluator } from '../claude';

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

describe('ClaudeEvaluator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('constructs with an explicit API key', () => {
    expect(() => new ClaudeEvaluator('test-key')).not.toThrow();
  });

  it('constructs with env API key', () => {
    process.env.ANTHROPIC_API_KEY = 'env-key';
    expect(() => new ClaudeEvaluator()).not.toThrow();
  });

  it('throws when no API key is available', () => {
    expect(() => new ClaudeEvaluator()).toThrow('ANTHROPIC_API_KEY is required');
  });

  it('evaluates and returns parsed result', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: validJson }],
    });

    const evaluator = new ClaudeEvaluator('test-key');
    const result = await evaluator.evaluate(prompt, response);

    expect(result.overall_score).toBe(75);
    expect(result.component_score).toBe(80);
    expect(result.components_found).toEqual(['cache']);
    expect(result.raw_response).toBe(validJson);
  });

  it('throws when no text block is returned', async () => {
    mockCreate.mockResolvedValue({ content: [] });

    const evaluator = new ClaudeEvaluator('test-key');
    await expect(evaluator.evaluate(prompt, response)).rejects.toThrow('no text content');
  });

  it('throws when scores are invalid', async () => {
    const badJson = JSON.stringify({
      overall_score: 150,
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
      content: [{ type: 'text', text: badJson }],
    });

    const evaluator = new ClaudeEvaluator('test-key');
    await expect(evaluator.evaluate(prompt, response)).rejects.toThrow('out of range');
  });
});
