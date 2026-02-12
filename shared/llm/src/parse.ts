import type { LLMEvaluationOutput } from './types';

/**
 * Parse the raw LLM text into a structured evaluation output.
 * Handles responses that may be wrapped in markdown code fences.
 */
export function parseEvaluationResponse(raw: string): LLMEvaluationOutput {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Failed to parse LLM response as JSON. Raw response:\n${raw}`,
    );
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('LLM response is not a JSON object.');
  }

  const obj = parsed as Record<string, unknown>;

  return {
    overall_score: requireNumber(obj, 'overall_score'),
    component_score: requireNumber(obj, 'component_score'),
    scaling_score: requireNumber(obj, 'scaling_score'),
    reliability_score: requireNumber(obj, 'reliability_score'),
    tradeoff_score: requireNumber(obj, 'tradeoff_score'),
    components_found: requireStringArray(obj, 'components_found'),
    components_missing: requireStringArray(obj, 'components_missing'),
    scaling_gaps: requireStringArray(obj, 'scaling_gaps'),
    suggestions: requireStringArray(obj, 'suggestions'),
  };
}

/**
 * Validate that all scores are within the 0-100 range.
 */
export function validateScores(output: LLMEvaluationOutput): void {
  const scoreFields = [
    'overall_score',
    'component_score',
    'scaling_score',
    'reliability_score',
    'tradeoff_score',
  ] as const;

  for (const field of scoreFields) {
    const value = output[field];
    if (value < 0 || value > 100) {
      throw new Error(
        `Score out of range: ${field} = ${value}. Must be 0-100.`,
      );
    }
  }
}

function requireNumber(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `Expected numeric field "${key}" in LLM response, got ${typeof value}.`,
    );
  }
  return value;
}

function requireStringArray(
  obj: Record<string, unknown>,
  key: string,
): string[] {
  const value = obj[key];
  if (!Array.isArray(value)) {
    throw new Error(
      `Expected array field "${key}" in LLM response, got ${typeof value}.`,
    );
  }
  return value.map((item, i) => {
    if (typeof item !== 'string') {
      throw new Error(
        `Expected string at ${key}[${i}] in LLM response, got ${typeof item}.`,
      );
    }
    return item;
  });
}
