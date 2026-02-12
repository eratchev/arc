import { describe, it, expect } from 'vitest';
import { parseEvaluationResponse, validateScores } from '../parse';
import type { LLMEvaluationOutput } from '../types';

const validOutput: LLMEvaluationOutput = {
  overall_score: 75,
  component_score: 80,
  scaling_score: 70,
  reliability_score: 65,
  tradeoff_score: 60,
  components_found: ['load balancer', 'cache'],
  components_missing: ['CDN'],
  scaling_gaps: ['no sharding'],
  suggestions: ['add CDN'],
};

describe('parseEvaluationResponse', () => {
  it('parses valid JSON', () => {
    const result = parseEvaluationResponse(JSON.stringify(validOutput));
    expect(result).toEqual(validOutput);
  });

  it('parses JSON wrapped in markdown code fences', () => {
    const fenced = '```json\n' + JSON.stringify(validOutput) + '\n```';
    expect(parseEvaluationResponse(fenced)).toEqual(validOutput);
  });

  it('parses JSON wrapped in plain code fences', () => {
    const fenced = '```\n' + JSON.stringify(validOutput) + '\n```';
    expect(parseEvaluationResponse(fenced)).toEqual(validOutput);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseEvaluationResponse('not json')).toThrow('Failed to parse LLM response as JSON');
  });

  it('throws on non-object JSON', () => {
    expect(() => parseEvaluationResponse('"a string"')).toThrow('not a JSON object');
  });

  it('throws on null', () => {
    expect(() => parseEvaluationResponse('null')).toThrow('not a JSON object');
  });

  it('throws when a numeric field is missing', () => {
    const { overall_score: _, ...missing } = validOutput;
    expect(() => parseEvaluationResponse(JSON.stringify(missing))).toThrow('overall_score');
  });

  it('throws when a numeric field is NaN', () => {
    const bad = { ...validOutput, overall_score: NaN };
    // NaN serializes to null in JSON
    expect(() => parseEvaluationResponse(JSON.stringify(bad))).toThrow('overall_score');
  });

  it('throws when a numeric field is a string', () => {
    const bad = { ...validOutput, overall_score: 'high' };
    expect(() => parseEvaluationResponse(JSON.stringify(bad))).toThrow('overall_score');
  });

  it('throws when an array field is missing', () => {
    const { components_found: _, ...missing } = validOutput;
    expect(() => parseEvaluationResponse(JSON.stringify(missing))).toThrow('components_found');
  });

  it('throws when an array field contains a non-string', () => {
    const bad = { ...validOutput, components_found: [1, 2] };
    expect(() => parseEvaluationResponse(JSON.stringify(bad))).toThrow('components_found[0]');
  });
});

describe('validateScores', () => {
  it('accepts scores within 0-100', () => {
    expect(() => validateScores(validOutput)).not.toThrow();
  });

  it('accepts boundary values 0 and 100', () => {
    const boundary: LLMEvaluationOutput = {
      ...validOutput,
      overall_score: 0,
      component_score: 100,
      scaling_score: 0,
      reliability_score: 100,
      tradeoff_score: 50,
    };
    expect(() => validateScores(boundary)).not.toThrow();
  });

  it('throws when a score is negative', () => {
    expect(() => validateScores({ ...validOutput, overall_score: -1 })).toThrow('out of range');
  });

  it('throws when a score exceeds 100', () => {
    expect(() => validateScores({ ...validOutput, scaling_score: 101 })).toThrow('out of range');
  });
});
