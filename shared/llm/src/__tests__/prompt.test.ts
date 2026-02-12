import { describe, it, expect } from 'vitest';
import { buildEvaluationPrompt, SYSTEM_PROMPT } from '../prompt';

const minimalPrompt = {
  title: 'Design a URL Shortener',
  description: 'Build a system that shortens URLs.',
  constraints: ['100M URLs/day'],
  expected_components: ['Database', 'Cache'],
};

const minimalResponse = {
  architecture_text: 'Use a hash-based approach with a KV store.',
  mermaid_diagram: null,
  notes: null,
};

describe('buildEvaluationPrompt', () => {
  it('includes title and description', () => {
    const result = buildEvaluationPrompt(minimalPrompt, minimalResponse);
    expect(result).toContain('Design a URL Shortener');
    expect(result).toContain('Build a system that shortens URLs.');
  });

  it('formats constraints as a list', () => {
    const result = buildEvaluationPrompt(minimalPrompt, minimalResponse);
    expect(result).toContain('- 100M URLs/day');
  });

  it('formats expected components as a list', () => {
    const result = buildEvaluationPrompt(minimalPrompt, minimalResponse);
    expect(result).toContain('- Database');
    expect(result).toContain('- Cache');
  });

  it('includes architecture text', () => {
    const result = buildEvaluationPrompt(minimalPrompt, minimalResponse);
    expect(result).toContain('Use a hash-based approach');
  });

  it('omits diagram section when null', () => {
    const result = buildEvaluationPrompt(minimalPrompt, minimalResponse);
    expect(result).not.toContain('### Diagram');
  });

  it('includes diagram when provided', () => {
    const response = { ...minimalResponse, mermaid_diagram: 'graph TD; A-->B' };
    const result = buildEvaluationPrompt(minimalPrompt, response);
    expect(result).toContain('### Diagram');
    expect(result).toContain('graph TD; A-->B');
  });

  it('omits notes section when null', () => {
    const result = buildEvaluationPrompt(minimalPrompt, minimalResponse);
    expect(result).not.toContain('### Additional Notes');
  });

  it('includes notes when provided', () => {
    const response = { ...minimalResponse, notes: 'Consider rate limiting.' };
    const result = buildEvaluationPrompt(minimalPrompt, response);
    expect(result).toContain('### Additional Notes');
    expect(result).toContain('Consider rate limiting.');
  });

  it('includes full response with diagram and notes', () => {
    const response = {
      architecture_text: 'Full arch',
      mermaid_diagram: 'graph LR; X-->Y',
      notes: 'Extra notes',
    };
    const result = buildEvaluationPrompt(minimalPrompt, response);
    expect(result).toContain('### Diagram');
    expect(result).toContain('### Additional Notes');
    expect(result).toContain('Full arch');
  });

  it('includes scoring rubric', () => {
    const result = buildEvaluationPrompt(minimalPrompt, minimalResponse);
    expect(result).toContain('component_score');
    expect(result).toContain('scaling_score');
    expect(result).toContain('reliability_score');
    expect(result).toContain('tradeoff_score');
  });

  it('includes multiple constraints', () => {
    const prompt = { ...minimalPrompt, constraints: ['C1', 'C2', 'C3'] };
    const result = buildEvaluationPrompt(prompt, minimalResponse);
    expect(result).toContain('- C1');
    expect(result).toContain('- C2');
    expect(result).toContain('- C3');
  });
});

describe('SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it('mentions JSON', () => {
    expect(SYSTEM_PROMPT).toContain('JSON');
  });
});
