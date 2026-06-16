-- Phase A: project workspace — new columns on projects, project_notes, project_chats
--> statement-breakpoint
ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "template_id" varchar(100),
  ADD COLUMN IF NOT EXISTS "industry" varchar(100),
  ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "cover_image" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "user_id" uuid,
  "title" varchar(255) NOT NULL DEFAULT 'Note',
  "body" text NOT NULL DEFAULT '',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_chats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "project_notes"
  ADD CONSTRAINT "project_notes_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_notes"
  ADD CONSTRAINT "project_notes_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_chats"
  ADD CONSTRAINT "project_chats_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_chats"
  ADD CONSTRAINT "project_chats_session_id_chat_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_notes_project" ON "project_notes" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_chats_project" ON "project_chats" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_chats_session" ON "project_chats" USING btree ("session_id");
