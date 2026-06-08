CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('superadmin', 'admin', 'user');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"key_name" varchar(255),
	"api_key" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"permissions" jsonb DEFAULT '[]'::jsonb,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	CONSTRAINT "api_keys_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "billing_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD',
	"description" text,
	"status" varchar(50) DEFAULT 'pending',
	"payment_method" varchar(50),
	"stripe_transaction_id" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"sender" varchar(50),
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"engineer_name" varchar(255),
	"engineer_specialty" varchar(255),
	"status" varchar(50) DEFAULT 'active',
	"started_at" timestamp DEFAULT now(),
	"ended_at" timestamp,
	"rating" integer,
	"feedback" text,
	CONSTRAINT "chat_rating_check" CHECK ("chat_sessions"."rating" >= 1 AND "chat_sessions"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "error_rectifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"user_id" uuid,
	"original_code" text,
	"error_message" text,
	"error_screenshot_url" text,
	"corrected_code" text,
	"correction_applied" boolean DEFAULT false,
	"confidence_score" double precision,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "file_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"project_id" uuid,
	"operation_type" varchar(50) NOT NULL,
	"file_name" varchar(255),
	"file_path" text,
	"file_size" integer,
	"mime_type" varchar(100),
	"storage_url" text,
	"created_at" timestamp DEFAULT now(),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "generated_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"user_id" uuid,
	"program_code" text NOT NULL,
	"program_format" varchar(50),
	"file_name" varchar(255),
	"file_size" integer,
	"generation_parameters" jsonb,
	"created_at" timestamp DEFAULT now(),
	"version" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "learning_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"project_id" uuid,
	"learning_type" varchar(100),
	"original_input" jsonb,
	"corrected_output" jsonb,
	"user_correction" text,
	"feedback_rating" integer,
	"applied_to_model" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "learning_feedback_rating_check" CHECK ("learning_data"."feedback_rating" >= 1 AND "learning_data"."feedback_rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"subscription_tier" "subscription_tier" DEFAULT 'free',
	"subscription_start_date" timestamp,
	"subscription_end_date" timestamp,
	"max_users" integer DEFAULT 1,
	"max_projects" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"settings" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "plc_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"project_id" uuid,
	"requirements" jsonb NOT NULL,
	"recommended_plcs" jsonb NOT NULL,
	"selected_plc" jsonb,
	"criteria" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" text,
	"plc_manufacturer" varchar(100),
	"plc_model" varchar(100),
	"programming_language" varchar(50),
	"application_type" varchar(100),
	"status" varchar(50) DEFAULT 'draft',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "subscription_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"subscription_tier" "subscription_tier" NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"amount_paid" numeric(10, 2),
	"payment_method" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"event_data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255),
	"password_hash" text,
	"role" "user_role" DEFAULT 'user',
	"organization_id" uuid,
	"is_active" boolean DEFAULT true,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"preferences" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_rectifications" ADD CONSTRAINT "error_rectifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_rectifications" ADD CONSTRAINT "error_rectifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_operations" ADD CONSTRAINT "file_operations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_operations" ADD CONSTRAINT "file_operations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_programs" ADD CONSTRAINT "generated_programs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_programs" ADD CONSTRAINT "generated_programs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_data" ADD CONSTRAINT "learning_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_data" ADD CONSTRAINT "learning_data_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plc_recommendations" ADD CONSTRAINT "plc_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plc_recommendations" ADD CONSTRAINT "plc_recommendations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_analytics" ADD CONSTRAINT "usage_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_analytics" ADD CONSTRAINT "usage_analytics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_keys_key" ON "api_keys" USING btree ("api_key");--> statement-breakpoint
CREATE INDEX "idx_api_keys_org" ON "api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_billing_org" ON "billing_transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_billing_status" ON "billing_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_messages_session" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_chat_user" ON "chat_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chat_status" ON "chat_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_error_rect_project" ON "error_rectifications" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_error_rect_user" ON "error_rectifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_file_ops_user" ON "file_operations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_file_ops_project" ON "file_operations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_file_ops_type" ON "file_operations" USING btree ("operation_type");--> statement-breakpoint
CREATE INDEX "idx_programs_project" ON "generated_programs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_programs_user" ON "generated_programs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_learning_type" ON "learning_data" USING btree ("learning_type");--> statement-breakpoint
CREATE INDEX "idx_learning_applied" ON "learning_data" USING btree ("applied_to_model");--> statement-breakpoint
CREATE INDEX "idx_recommendations_user" ON "plc_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_projects_user" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_projects_org" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_projects_status" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sub_history_org" ON "subscription_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_user" ON "usage_analytics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_org" ON "usage_analytics" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_analytics_event" ON "usage_analytics" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_analytics_created" ON "usage_analytics" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_organization" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");