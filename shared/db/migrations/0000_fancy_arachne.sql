CREATE SCHEMA "sds";
--> statement-breakpoint
CREATE SCHEMA "mos";
--> statement-breakpoint
CREATE SCHEMA "core";
--> statement-breakpoint
CREATE TABLE "sds"."evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_id" uuid NOT NULL,
	"llm_provider" text NOT NULL,
	"llm_model" text NOT NULL,
	"eval_prompt_version" integer DEFAULT 1 NOT NULL,
	"parser_version" integer DEFAULT 1 NOT NULL,
	"raw_response" text NOT NULL,
	"overall_score" integer NOT NULL,
	"component_score" integer NOT NULL,
	"scaling_score" integer NOT NULL,
	"reliability_score" integer NOT NULL,
	"tradeoff_score" integer NOT NULL,
	"components_found" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"components_missing" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scaling_gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggestions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "overall_score_check" CHECK ("sds"."evaluations"."overall_score" BETWEEN 0 AND 100),
	CONSTRAINT "component_score_check" CHECK ("sds"."evaluations"."component_score" BETWEEN 0 AND 100),
	CONSTRAINT "scaling_score_check" CHECK ("sds"."evaluations"."scaling_score" BETWEEN 0 AND 100),
	CONSTRAINT "reliability_score_check" CHECK ("sds"."evaluations"."reliability_score" BETWEEN 0 AND 100),
	CONSTRAINT "tradeoff_score_check" CHECK ("sds"."evaluations"."tradeoff_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "sds"."mos_sync" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"mos_node_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_key" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mos_sync_idempotent" UNIQUE("session_id","source_type","source_key"),
	CONSTRAINT "source_type_check" CHECK ("sds"."mos_sync"."source_type" IN ('session', 'concept', 'edge', 'pattern'))
);
--> statement-breakpoint
CREATE TABLE "sds"."prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"description" text NOT NULL,
	"constraints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_components" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"time_limit_min" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "difficulty_check" CHECK ("sds"."prompts"."difficulty" IN ('easy', 'medium', 'hard'))
);
--> statement-breakpoint
CREATE TABLE "sds"."responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"architecture_text" text NOT NULL,
	"mermaid_diagram" text,
	"notes" text,
	"is_final" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "responses_session_version" UNIQUE("session_id","version")
);
--> statement-breakpoint
CREATE TABLE "sds"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"time_spent_sec" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mode_check" CHECK ("sds"."sessions"."mode" IN ('30_min', '60_min')),
	CONSTRAINT "status_check" CHECK ("sds"."sessions"."status" IN ('in_progress', 'submitted', 'evaluated'))
);
--> statement-breakpoint
CREATE TABLE "mos"."edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"edge_type" text DEFAULT 'related_to' NOT NULL,
	"custom_label" text,
	"weight" real DEFAULT 1 NOT NULL,
	"summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "no_self_edge" CHECK ("mos"."edges"."source_id" != "mos"."edges"."target_id"),
	CONSTRAINT "edge_type_check" CHECK ("mos"."edges"."edge_type" IN ('related_to', 'used_in', 'practiced_at', 'knows', 'prepared_for', 'works_at', 'authored', 'read', 'connected_to', 'depends_on', 'part_of', 'custom')),
	CONSTRAINT "custom_label_check" CHECK (("mos"."edges"."edge_type" = 'custom' AND "mos"."edges"."custom_label" IS NOT NULL AND "mos"."edges"."custom_label" <> '') OR ("mos"."edges"."edge_type" <> 'custom'))
);
--> statement-breakpoint
CREATE TABLE "mos"."nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nodes_user_slug" UNIQUE("user_id","slug"),
	CONSTRAINT "type_check" CHECK ("mos"."nodes"."type" IN ('concept', 'pattern', 'domain', 'person', 'org', 'project', 'note', 'artifact'))
);
--> statement-breakpoint
CREATE TABLE "core"."embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"model" text NOT NULL,
	"provider" text DEFAULT 'openai' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "embeddings_entity_model" UNIQUE("entity_type","entity_id","model"),
	CONSTRAINT "entity_type_check" CHECK ("core"."embeddings"."entity_type" IN ('sds_session', 'sds_prompt', 'mos_node', 'mos_edge'))
);
--> statement-breakpoint
ALTER TABLE "sds"."evaluations" ADD CONSTRAINT "evaluations_response_id_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "sds"."responses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sds"."mos_sync" ADD CONSTRAINT "mos_sync_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sds"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sds"."responses" ADD CONSTRAINT "responses_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sds"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sds"."sessions" ADD CONSTRAINT "sessions_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "sds"."prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mos"."edges" ADD CONSTRAINT "edges_source_id_nodes_id_fk" FOREIGN KEY ("source_id") REFERENCES "mos"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mos"."edges" ADD CONSTRAINT "edges_target_id_nodes_id_fk" FOREIGN KEY ("target_id") REFERENCES "mos"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_evaluations_response" ON "sds"."evaluations" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "idx_evaluations_response_time" ON "sds"."evaluations" USING btree ("response_id","evaluated_at");--> statement-breakpoint
CREATE INDEX "idx_mos_sync_session" ON "sds"."mos_sync" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_mos_sync_node" ON "sds"."mos_sync" USING btree ("mos_node_id");--> statement-breakpoint
CREATE INDEX "idx_responses_session" ON "sds"."responses" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sds"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_started" ON "sds"."sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_edges_source" ON "mos"."edges" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_edges_target" ON "mos"."edges" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_edges_type" ON "mos"."edges" USING btree ("edge_type");--> statement-breakpoint
CREATE INDEX "idx_nodes_user" ON "mos"."nodes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_nodes_type" ON "mos"."nodes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_nodes_slug" ON "mos"."nodes" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "idx_embeddings_entity" ON "core"."embeddings" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_embeddings_user" ON "core"."embeddings" USING btree ("user_id");