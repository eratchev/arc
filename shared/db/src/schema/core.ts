import {
  pgSchema,
  uuid,
  text,
  timestamp,
  unique,
  index,
  check,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const coreSchema = pgSchema('core');

// Custom type for pgvector
const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .slice(1, -1)
      .split(',')
      .map(Number);
  },
});

export const embeddings = coreSchema.table('embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: uuid('entity_id').notNull(),
  content_hash: text('content_hash').notNull(),
  embedding: vector('embedding').notNull(),
  model: text('model').notNull(),
  provider: text('provider').notNull().default('openai'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('embeddings_entity_model').on(table.entity_type, table.entity_id, table.model),
  index('idx_embeddings_entity').on(table.entity_type, table.entity_id),
  index('idx_embeddings_user').on(table.user_id),
  check('entity_type_check', sql`${table.entity_type} IN ('sds_session', 'sds_prompt', 'mos_node', 'mos_edge')`),
]);
