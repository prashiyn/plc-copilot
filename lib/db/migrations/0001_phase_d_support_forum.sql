CREATE TABLE IF NOT EXISTS "support_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "name" varchar(255) NOT NULL,
  "email" varchar(255) NOT NULL,
  "subject" varchar(500) NOT NULL,
  "category" varchar(50) NOT NULL,
  "priority" varchar(20) NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "ticket_number" varchar(32) NOT NULL,
  "subject" varchar(500) NOT NULL,
  "category" varchar(50) NOT NULL,
  "priority" varchar(20) DEFAULT 'normal' NOT NULL,
  "status" varchar(20) DEFAULT 'open' NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "support_tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forum_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "author_name" varchar(255) NOT NULL,
  "title" varchar(500) NOT NULL,
  "category" varchar(50) NOT NULL,
  "body" text NOT NULL,
  "is_pinned" boolean DEFAULT false,
  "status" varchar(20) DEFAULT 'open',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forum_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL,
  "user_id" uuid,
  "author_name" varchar(255) NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_thread_id_forum_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."forum_threads"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_messages_user" ON "support_messages" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_tickets_user" ON "support_tickets" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_tickets_status" ON "support_tickets" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_forum_threads_category" ON "forum_threads" USING btree ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_forum_threads_pinned" ON "forum_threads" USING btree ("is_pinned");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_forum_posts_thread" ON "forum_posts" USING btree ("thread_id");
