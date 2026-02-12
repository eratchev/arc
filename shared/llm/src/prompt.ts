import type { EvaluationPromptInput, EvaluationResponseInput } from './types';

export const EVAL_PROMPT_VERSION = 1;

export const SYSTEM_PROMPT = `You are an expert system design evaluator. You assess system design responses against structured rubrics and return a detailed JSON evaluation.

You MUST respond with valid JSON only -- no markdown fences, no commentary outside the JSON object.

Scoring guidelines (0-100 for each dimension):
- 0-20: Critical gaps, fundamental misunderstanding
- 21-40: Partial coverage, major omissions
- 41-60: Adequate coverage, some gaps
- 61-80: Strong coverage, minor gaps
- 81-100: Comprehensive, production-grade thinking

Be rigorous but fair. Award credit for concepts that are implied by the architecture even if not explicitly named.`;

export function buildEvaluationPrompt(
  prompt: EvaluationPromptInput,
  response: EvaluationResponseInput,
): string {
  const responseSection = [
    '## Candidate Response',
    '',
    '### Architecture',
    response.architecture_text,
  ];

  if (response.mermaid_diagram) {
    responseSection.push('', '### Diagram', response.mermaid_diagram);
  }

  if (response.notes) {
    responseSection.push('', '### Additional Notes', response.notes);
  }

  return `Evaluate the following system design response.

## Problem Statement
**Title:** ${prompt.title}
**Description:** ${prompt.description}

**Constraints:**
${prompt.constraints.map((c) => `- ${c}`).join('\n')}

**Expected Components:**
${prompt.expected_components.map((c) => `- ${c}`).join('\n')}

${responseSection.join('\n')}

---

Score the response on these four dimensions (0-100 each):

1. **Component Completeness** (component_score): Does the response include the expected components such as caching layers, message queues, load balancers, databases, CDNs, and other infrastructure pieces? Are they appropriately placed in the architecture?

2. **Scaling Considerations** (scaling_score): Does the response address horizontal scaling, data partitioning/sharding, replication strategies, auto-scaling policies, and capacity planning?

3. **Failure Handling** (reliability_score): Does the response cover retries with backoff, circuit breakers, dead letter queues, health checks, graceful degradation, and disaster recovery?

4. **Trade-off Articulation** (tradeoff_score): Does the response discuss CAP theorem implications, consistency vs. availability trade-offs, latency vs. throughput decisions, cost vs. performance considerations, and explicit justification for choices made?

Compute overall_score as the weighted average: component 30%, scaling 25%, reliability 25%, tradeoffs 20%.

Respond with exactly this JSON structure:
{
  "overall_score": <number>,
  "component_score": <number>,
  "scaling_score": <number>,
  "reliability_score": <number>,
  "tradeoff_score": <number>,
  "components_found": [<strings: components present in the response>],
  "components_missing": [<strings: expected components that are absent>],
  "scaling_gaps": [<strings: scaling concerns not addressed>],
  "suggestions": [<strings: actionable improvements>]
}`;
}
