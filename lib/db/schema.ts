/**
 * Drizzle schema for PLCAutoPilot (local Postgres).
 *
 * Migrated from supabase/schema.sql. Differences from the Supabase version:
 *  - No row-level-security policies — authorization is enforced in the app layer.
 *  - users.auth_id (Supabase Auth ref) is replaced by users.passwordHash for
 *    Credentials-based auth (see Phase 1).
 *  - updated_at is maintained via Drizzle's $onUpdate instead of SQL triggers.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  doublePrecision,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const userRole = pgEnum('user_role', ['superadmin', 'admin', 'user']);
export const subscriptionTier = pgEnum('subscription_tier', [
  'free',
  'professional',
  'enterprise',
]);

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  subscriptionTier: subscriptionTier('subscription_tier').default('free'),
  subscriptionStartDate: timestamp('subscription_start_date'),
  subscriptionEndDate: timestamp('subscription_end_date'),
  maxUsers: integer('max_users').default(1),
  maxProjects: integer('max_projects').default(5),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
  settings: jsonb('settings').default({}),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).unique().notNull(),
    fullName: varchar('full_name', { length: 255 }),
    passwordHash: text('password_hash'),
    role: userRole('role').default('user'),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    isActive: boolean('is_active').default(true),
    lastLogin: timestamp('last_login'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
    preferences: jsonb('preferences').default({}),
  },
  (t) => [
    index('idx_users_email').on(t.email),
    index('idx_users_organization').on(t.organizationId),
    index('idx_users_role').on(t.role),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    plcManufacturer: varchar('plc_manufacturer', { length: 100 }),
    plcModel: varchar('plc_model', { length: 100 }),
    programmingLanguage: varchar('programming_language', { length: 50 }),
    applicationType: varchar('application_type', { length: 100 }),
    status: varchar('status', { length: 50 }).default('draft'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
    metadata: jsonb('metadata').default({}),
  },
  (t) => [
    index('idx_projects_user').on(t.userId),
    index('idx_projects_org').on(t.organizationId),
    index('idx_projects_status').on(t.status),
  ],
);

export const generatedPrograms = pgTable(
  'generated_programs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    programCode: text('program_code').notNull(),
    programFormat: varchar('program_format', { length: 50 }),
    fileName: varchar('file_name', { length: 255 }),
    fileSize: integer('file_size'),
    generationParameters: jsonb('generation_parameters'),
    createdAt: timestamp('created_at').defaultNow(),
    version: integer('version').default(1),
  },
  (t) => [
    index('idx_programs_project').on(t.projectId),
    index('idx_programs_user').on(t.userId),
  ],
);

export const fileOperations = pgTable(
  'file_operations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    operationType: varchar('operation_type', { length: 50 }).notNull(),
    fileName: varchar('file_name', { length: 255 }),
    filePath: text('file_path'),
    fileSize: integer('file_size'),
    mimeType: varchar('mime_type', { length: 100 }),
    storageUrl: text('storage_url'),
    createdAt: timestamp('created_at').defaultNow(),
    metadata: jsonb('metadata').default({}),
  },
  (t) => [
    index('idx_file_ops_user').on(t.userId),
    index('idx_file_ops_project').on(t.projectId),
    index('idx_file_ops_type').on(t.operationType),
  ],
);

export const errorRectifications = pgTable(
  'error_rectifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    originalCode: text('original_code'),
    errorMessage: text('error_message'),
    errorScreenshotUrl: text('error_screenshot_url'),
    correctedCode: text('corrected_code'),
    correctionApplied: boolean('correction_applied').default(false),
    confidenceScore: doublePrecision('confidence_score'),
    createdAt: timestamp('created_at').defaultNow(),
    resolvedAt: timestamp('resolved_at'),
    metadata: jsonb('metadata').default({}),
  },
  (t) => [
    index('idx_error_rect_project').on(t.projectId),
    index('idx_error_rect_user').on(t.userId),
  ],
);

export const learningData = pgTable(
  'learning_data',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    learningType: varchar('learning_type', { length: 100 }),
    originalInput: jsonb('original_input'),
    correctedOutput: jsonb('corrected_output'),
    userCorrection: text('user_correction'),
    feedbackRating: integer('feedback_rating'),
    appliedToModel: boolean('applied_to_model').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    metadata: jsonb('metadata').default({}),
  },
  (t) => [
    index('idx_learning_type').on(t.learningType),
    index('idx_learning_applied').on(t.appliedToModel),
    check('learning_feedback_rating_check', sql`${t.feedbackRating} >= 1 AND ${t.feedbackRating} <= 5`),
  ],
);

export const plcRecommendations = pgTable(
  'plc_recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id),
    requirements: jsonb('requirements').notNull(),
    recommendedPlcs: jsonb('recommended_plcs').notNull(),
    selectedPlc: jsonb('selected_plc'),
    criteria: varchar('criteria', { length: 50 }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [index('idx_recommendations_user').on(t.userId)],
);

export const chatSessions = pgTable(
  'chat_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    engineerName: varchar('engineer_name', { length: 255 }),
    engineerSpecialty: varchar('engineer_specialty', { length: 255 }),
    status: varchar('status', { length: 50 }).default('active'),
    startedAt: timestamp('started_at').defaultNow(),
    endedAt: timestamp('ended_at'),
    rating: integer('rating'),
    feedback: text('feedback'),
  },
  (t) => [
    index('idx_chat_user').on(t.userId),
    index('idx_chat_status').on(t.status),
    check('chat_rating_check', sql`${t.rating} >= 1 AND ${t.rating} <= 5`),
  ],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id').references(() => chatSessions.id, { onDelete: 'cascade' }),
    sender: varchar('sender', { length: 50 }),
    message: text('message').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    metadata: jsonb('metadata').default({}),
  },
  (t) => [index('idx_messages_session').on(t.sessionId)],
);

export const usageAnalytics = pgTable(
  'usage_analytics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    eventData: jsonb('event_data'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index('idx_analytics_user').on(t.userId),
    index('idx_analytics_org').on(t.organizationId),
    index('idx_analytics_event').on(t.eventType),
    index('idx_analytics_created').on(t.createdAt),
  ],
);

export const subscriptionHistory = pgTable(
  'subscription_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    subscriptionTier: subscriptionTier('subscription_tier').notNull(),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date'),
    amountPaid: numeric('amount_paid', { precision: 10, scale: 2 }),
    paymentMethod: varchar('payment_method', { length: 50 }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [index('idx_sub_history_org').on(t.organizationId)],
);

export const billingTransactions = pgTable(
  'billing_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('USD'),
    description: text('description'),
    status: varchar('status', { length: 50 }).default('pending'),
    paymentMethod: varchar('payment_method', { length: 50 }),
    stripeTransactionId: text('stripe_transaction_id'),
    createdAt: timestamp('created_at').defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (t) => [
    index('idx_billing_org').on(t.organizationId),
    index('idx_billing_status').on(t.status),
  ],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    keyName: varchar('key_name', { length: 255 }),
    apiKey: text('api_key').unique().notNull(),
    isActive: boolean('is_active').default(true),
    permissions: jsonb('permissions').default([]),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').defaultNow(),
    expiresAt: timestamp('expires_at'),
  },
  (t) => [
    index('idx_api_keys_key').on(t.apiKey),
    index('idx_api_keys_org').on(t.organizationId),
  ],
);
