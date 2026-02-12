import {
  pgSchema,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const sdsSchema = pgSchema('sds');

export const prompts = sdsSchema.table('prompts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  difficulty: text('difficulty').notNull().default('medium'),
  description: text('description').notNull(),
  constraints: jsonb('constraints').notNull().default([]),
  expected_components: jsonb('expected_components').notNull().default([]),
  time_limit_min: integer('time_limit_min').notNull().default(60),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('difficulty_check', sql`${table.difficulty} IN ('easy', 'medium', 'hard')`),
]);

export const sessions = sdsSchema.table('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  prompt_id: uuid('prompt_id').notNull().references(() => prompts.id),
  mode: text('mode').notNull(),
  status: text('status').notNull().default('in_progress'),
  started_at: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  ended_at: timestamp('ended_at', { withTimezone: true }),
  time_spent_sec: integer('time_spent_sec'),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_sessions_user').on(table.user_id),
  index('idx_sessions_started').on(table.started_at),
  check('mode_check', sql`${table.mode} IN ('30_min', '60_min')`),
  check('status_check', sql`${table.status} IN ('in_progress', 'submitted', 'evaluated')`),
]);

export const responses = sdsSchema.table('responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  session_id: uuid('session_id').notNull().references(() => sessions.id),
  version: integer('version').notNull().default(1),
  architecture_text: text('architecture_text').notNull(),
  mermaid_diagram: text('mermaid_diagram'),
  notes: text('notes'),
  is_final: boolean('is_final').notNull().default(false),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  submitted_at: timestamp('submitted_at', { withTimezone: true }),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('responses_session_version').on(table.session_id, table.version),
  index('idx_responses_session').on(table.session_id),
]);

export const evaluations = sdsSchema.table('evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  response_id: uuid('response_id').notNull().references(() => responses.id),
  llm_provider: text('llm_provider').notNull(),
  llm_model: text('llm_model').notNull(),
  eval_prompt_version: integer('eval_prompt_version').notNull().default(1),
  parser_version: integer('parser_version').notNull().default(1),
  raw_response: text('raw_response').notNull(),
  overall_score: integer('overall_score').notNull(),
  component_score: integer('component_score').notNull(),
  scaling_score: integer('scaling_score').notNull(),
  reliability_score: integer('reliability_score').notNull(),
  tradeoff_score: integer('tradeoff_score').notNull(),
  components_found: jsonb('components_found').notNull().default([]),
  components_missing: jsonb('components_missing').notNull().default([]),
  scaling_gaps: jsonb('scaling_gaps').notNull().default([]),
  suggestions: jsonb('suggestions').notNull().default([]),
  evaluated_at: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_evaluations_response').on(table.response_id),
  index('idx_evaluations_response_time').on(table.response_id, table.evaluated_at),
  check('overall_score_check', sql`${table.overall_score} BETWEEN 0 AND 100`),
  check('component_score_check', sql`${table.component_score} BETWEEN 0 AND 100`),
  check('scaling_score_check', sql`${table.scaling_score} BETWEEN 0 AND 100`),
  check('reliability_score_check', sql`${table.reliability_score} BETWEEN 0 AND 100`),
  check('tradeoff_score_check', sql`${table.tradeoff_score} BETWEEN 0 AND 100`),
]);

export const mosSync = sdsSchema.table('mos_sync', {
  id: uuid('id').primaryKey().defaultRandom(),
  session_id: uuid('session_id').notNull().references(() => sessions.id),
  mos_node_id: uuid('mos_node_id').notNull(),
  source_type: text('source_type').notNull(),
  source_key: text('source_key').notNull(),
  synced_at: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('mos_sync_idempotent').on(table.session_id, table.source_type, table.source_key),
  index('idx_mos_sync_session').on(table.session_id),
  index('idx_mos_sync_node').on(table.mos_node_id),
  check('source_type_check', sql`${table.source_type} IN ('session', 'concept', 'edge', 'pattern')`),
]);
