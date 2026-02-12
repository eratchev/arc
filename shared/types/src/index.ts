// === SDS Types ===

export type Difficulty = 'easy' | 'medium' | 'hard';
export type SessionMode = '30_min' | '60_min';
export type SessionStatus = 'in_progress' | 'submitted' | 'evaluated';

export interface Prompt {
  id: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  description: string;
  constraints: string[];
  expected_components: string[];
  time_limit_min: number;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  prompt_id: string;
  mode: SessionMode;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  time_spent_sec: number | null;
  updated_at: string;
}

export interface Response {
  id: string;
  session_id: string;
  version: number;
  architecture_text: string;
  mermaid_diagram: string | null;
  notes: string | null;
  is_final: boolean;
  created_at: string;
  submitted_at: string | null;
  updated_at: string;
}

export interface Evaluation {
  id: string;
  response_id: string;
  llm_provider: string;
  llm_model: string;
  eval_prompt_version: number;
  parser_version: number;
  raw_response: string;
  overall_score: number;
  component_score: number;
  scaling_score: number;
  reliability_score: number;
  tradeoff_score: number;
  components_found: string[];
  components_missing: string[];
  scaling_gaps: string[];
  suggestions: string[];
  evaluated_at: string;
}

// === MOS Types ===

export type NodeType =
  | 'concept'
  | 'pattern'
  | 'domain'
  | 'person'
  | 'org'
  | 'project'
  | 'note'
  | 'artifact';

export type EdgeType =
  | 'related_to'
  | 'used_in'
  | 'practiced_at'
  | 'knows'
  | 'prepared_for'
  | 'works_at'
  | 'authored'
  | 'read'
  | 'connected_to'
  | 'depends_on'
  | 'part_of'
  | 'custom';

export interface Node {
  id: string;
  user_id: string;
  type: NodeType;
  slug: string;
  title: string;
  content: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Edge {
  id: string;
  user_id: string;
  source_id: string;
  target_id: string;
  edge_type: EdgeType;
  custom_label: string | null;
  weight: number;
  summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// === Core Types ===

export type EmbeddingEntityType =
  | 'sds_session'
  | 'sds_prompt'
  | 'mos_node'
  | 'mos_edge';

export interface Embedding {
  id: string;
  user_id: string;
  entity_type: EmbeddingEntityType;
  entity_id: string;
  content_hash: string;
  embedding: number[];
  model: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

// === LLM Types ===

export interface EvaluationResult {
  overall_score: number;
  component_score: number;
  scaling_score: number;
  reliability_score: number;
  tradeoff_score: number;
  components_found: string[];
  components_missing: string[];
  scaling_gaps: string[];
  suggestions: string[];
  raw_response: string;
}

export interface LLMProvider {
  name: string;
  model: string;
}

// === MOS Sync ===

export type MosSyncSourceType = 'session' | 'concept' | 'edge' | 'pattern';

export interface MosSync {
  id: string;
  session_id: string;
  mos_node_id: string;
  source_type: MosSyncSourceType;
  source_key: string;
  synced_at: string;
}
