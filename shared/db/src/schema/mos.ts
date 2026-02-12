import {
  pgSchema,
  uuid,
  text,
  real,
  timestamp,
  jsonb,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const mosSchema = pgSchema('mos');

export const nodes = mosSchema.table('nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  type: text('type').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  content: text('content'),
  summary: text('summary'),
  metadata: jsonb('metadata').notNull().default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('nodes_user_slug').on(table.user_id, table.slug),
  index('idx_nodes_user').on(table.user_id),
  index('idx_nodes_type').on(table.type),
  index('idx_nodes_slug').on(table.user_id, table.slug),
  check('type_check', sql`${table.type} IN ('concept', 'pattern', 'domain', 'person', 'org', 'project', 'note', 'artifact')`),
]);

export const edges = mosSchema.table('edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  source_id: uuid('source_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  target_id: uuid('target_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  edge_type: text('edge_type').notNull().default('related_to'),
  custom_label: text('custom_label'),
  weight: real('weight').notNull().default(1.0),
  summary: text('summary'),
  metadata: jsonb('metadata').notNull().default({}),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_edges_source').on(table.source_id),
  index('idx_edges_target').on(table.target_id),
  index('idx_edges_type').on(table.edge_type),
  check('no_self_edge', sql`${table.source_id} != ${table.target_id}`),
  check('edge_type_check', sql`${table.edge_type} IN ('related_to', 'used_in', 'practiced_at', 'knows', 'prepared_for', 'works_at', 'authored', 'read', 'connected_to', 'depends_on', 'part_of', 'custom')`),
  check('custom_label_check', sql`(${table.edge_type} = 'custom' AND ${table.custom_label} IS NOT NULL AND ${table.custom_label} <> '') OR (${table.edge_type} <> 'custom')`),
]);
