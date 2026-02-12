import type { EvaluationResult } from '@arc/types';

export interface EvaluationPromptInput {
  title: string;
  description: string;
  constraints: string[];
  expected_components: string[];
}

export interface EvaluationResponseInput {
  architecture_text: string;
  mermaid_diagram: string | null;
  notes: string | null;
}

export interface EvaluatorProvider {
  readonly name: string;
  readonly model: string;

  evaluate(
    prompt: EvaluationPromptInput,
    response: EvaluationResponseInput,
  ): Promise<EvaluationResult>;
}

/**
 * Raw JSON structure expected from the LLM response.
 * Kept separate from EvaluationResult since the LLM does not produce raw_response.
 */
export interface LLMEvaluationOutput {
  overall_score: number;
  component_score: number;
  scaling_score: number;
  reliability_score: number;
  tradeoff_score: number;
  components_found: string[];
  components_missing: string[];
  scaling_gaps: string[];
  suggestions: string[];
}
