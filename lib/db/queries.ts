/**
 * Auth-scoped data access. All functions resolve the current session and scope
 * queries to the user's organization (falling back to the user when they have
 * no org). API routes / server components call these directly.
 */
import { and, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import {
  projects,
  generatedPrograms,
  usageAnalytics,
  organizations,
  users,
  fileOperations,
} from '@/lib/db/schema';
import {
  computeOverLimit,
  resolvePlanDisplay,
  resolvePlanLimits,
  usagePercent,
  type OverLimitFlags,
  type PlanLimits,
} from '@/lib/billing/plan-limits';
import { nextBillingDate, resolveBillingPeriod } from '@/lib/billing/billing-period';
import { AI_USAGE_EVENTS, bytesToGb, isAiUsageEvent, usageEventLabel } from '@/lib/billing/usage-events';

export interface SessionUser {
  id: string;
  organizationId: string | null;
  role: string;
}

export async function requireUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    organizationId: session.user.organizationId ?? null,
    role: session.user.role ?? 'user',
  };
}

function projectScope(user: SessionUser): SQL {
  return user.organizationId
    ? eq(projects.organizationId, user.organizationId)
    : eq(projects.userId, user.id);
}

export interface ProjectInput {
  name: string;
  description?: string | null;
  plcManufacturer?: string | null;
  plcModel?: string | null;
  programmingLanguage?: string | null;
  applicationType?: string | null;
  status?: string;
}

export async function listProjects(user: SessionUser, status?: string) {
  const conds: SQL[] = [projectScope(user)];
  if (status) conds.push(eq(projects.status, status));
  return db
    .select()
    .from(projects)
    .where(and(...conds))
    .orderBy(desc(projects.updatedAt));
}

export async function createProject(user: SessionUser, input: ProjectInput) {
  const [row] = await db
    .insert(projects)
    .values({
      userId: user.id,
      organizationId: user.organizationId,
      name: input.name,
      description: input.description ?? null,
      plcManufacturer: input.plcManufacturer ?? null,
      plcModel: input.plcModel ?? null,
      programmingLanguage: input.programmingLanguage ?? null,
      applicationType: input.applicationType ?? null,
      status: input.status ?? 'in_progress',
    })
    .returning();
  await logUsage(user, 'project_created', { projectId: row.id, name: row.name });
  return row;
}

export async function updateProject(
  user: SessionUser,
  id: string,
  patch: Partial<ProjectInput>,
) {
  const [row] = await db
    .update(projects)
    .set({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.plcManufacturer !== undefined && { plcManufacturer: patch.plcManufacturer }),
      ...(patch.plcModel !== undefined && { plcModel: patch.plcModel }),
      ...(patch.programmingLanguage !== undefined && { programmingLanguage: patch.programmingLanguage }),
      ...(patch.applicationType !== undefined && { applicationType: patch.applicationType }),
      ...(patch.status !== undefined && { status: patch.status }),
    })
    .where(and(eq(projects.id, id), projectScope(user)))
    .returning();
  return row ?? null;
}

export async function deleteProject(user: SessionUser, id: string) {
  const [row] = await db
    .delete(projects)
    .where(and(eq(projects.id, id), projectScope(user)))
    .returning({ id: projects.id });
  return !!row;
}

export async function getDashboardStats(user: SessionUser) {
  const scope = projectScope(user);

  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${projects.status} in ('draft','in_progress','testing'))::int`,
      completed: sql<number>`count(*) filter (where ${projects.status} = 'completed')::int`,
    })
    .from(projects)
    .where(scope);

  const [{ programs }] = await db
    .select({ programs: sql<number>`count(*)::int` })
    .from(generatedPrograms)
    .where(eq(generatedPrograms.userId, user.id));

  const orgEvents = user.organizationId
    ? eq(usageAnalytics.organizationId, user.organizationId)
    : eq(usageAnalytics.userId, user.id);
  const [{ events }] = await db
    .select({ events: sql<number>`count(*)::int` })
    .from(usageAnalytics)
    .where(orgEvents);

  return {
    totalProjects: totals?.total ?? 0,
    activeProjects: totals?.active ?? 0,
    completedProjects: totals?.completed ?? 0,
    programsGenerated: programs ?? 0,
    usageEvents: events ?? 0,
  };
}

export async function listPrograms(user: SessionUser) {
  return db
    .select()
    .from(generatedPrograms)
    .where(eq(generatedPrograms.userId, user.id))
    .orderBy(desc(generatedPrograms.createdAt));
}

export interface ProgramInput {
  projectId?: string | null;
  programCode: string;
  programFormat?: string | null;
  fileName?: string | null;
  generationParameters?: unknown;
}

export async function createProgram(user: SessionUser, input: ProgramInput) {
  const [row] = await db
    .insert(generatedPrograms)
    .values({
      userId: user.id,
      projectId: input.projectId ?? null,
      programCode: input.programCode,
      programFormat: input.programFormat ?? null,
      fileName: input.fileName ?? null,
      fileSize: input.programCode.length,
      generationParameters: input.generationParameters ?? null,
    })
    .returning();
  await logUsage(user, 'program_generated', { programId: row.id, format: row.programFormat });
  return row;
}

/** Persist a generated program for the current user if signed in. Never throws. */
export async function persistGeneratedProgramIfAuthed(input: ProgramInput): Promise<void> {
  try {
    const user = await requireUser();
    if (!user) return;
    await createProgram(user, input);
  } catch (err) {
    console.warn('Could not persist generated program:', err);
  }
}

export async function logUsage(
  user: SessionUser,
  eventType: string,
  eventData?: unknown,
) {
  await db.insert(usageAnalytics).values({
    userId: user.id,
    organizationId: user.organizationId,
    eventType,
    eventData: eventData ?? null,
  });
}

export interface OrganizationContext {
  tier: string;
  subscriptionStartDate: Date | null;
  maxUsers: number;
  maxProjects: number;
  teamMembers: number;
}

export async function getOrganizationContext(user: SessionUser): Promise<OrganizationContext> {
  if (!user.organizationId) {
    return {
      tier: 'free',
      subscriptionStartDate: null,
      maxUsers: 1,
      maxProjects: 5,
      teamMembers: 1,
    };
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, user.organizationId))
    .limit(1);

  const [{ teamMembers }] = await db
    .select({ teamMembers: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.organizationId, user.organizationId));

  return {
    tier: org?.subscriptionTier ?? 'free',
    subscriptionStartDate: org?.subscriptionStartDate ?? null,
    maxUsers: org?.maxUsers ?? 1,
    maxProjects: org?.maxProjects ?? 5,
    teamMembers: teamMembers ?? 1,
  };
}

async function scopedUserIds(user: SessionUser): Promise<string[]> {
  if (!user.organizationId) return [user.id];
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.organizationId, user.organizationId));
  return rows.map((row) => row.id);
}

function analyticsScope(user: SessionUser): SQL {
  return user.organizationId
    ? eq(usageAnalytics.organizationId, user.organizationId)
    : eq(usageAnalytics.userId, user.id);
}

export interface UsageDailyRow {
  date: string;
  count: number;
  label: string;
}

export interface UsageSummary {
  period: { start: string; end: string; label: string };
  plan: {
    tier: string;
    name: string;
    priceMonthly: number;
    status: string;
    nextBillingDate: string;
    maxProjects: number;
  };
  limits: PlanLimits;
  used: {
    programs: number;
    aiRequests: number;
    storageGb: number;
    events: number;
    teamSeats: number;
  };
  percentages: {
    programs: number;
    aiRequests: number;
    storageGb: number;
    teamSeats: number;
  };
  breakdownByType: Record<string, number>;
  overLimit: OverLimitFlags;
  recentPrograms: UsageDailyRow[];
  recentAiRequests: UsageDailyRow[];
}

export async function getUsageSummary(user: SessionUser, monthOffset = 0): Promise<UsageSummary> {
  const orgContext = await getOrganizationContext(user);
  const period = resolveBillingPeriod(orgContext.subscriptionStartDate, monthOffset);
  const limits = resolvePlanLimits(orgContext.tier);
  const plan = resolvePlanDisplay(orgContext.tier);
  const scope = analyticsScope(user);
  const periodFilter = and(
    scope,
    gte(usageAnalytics.createdAt, period.start),
    lte(usageAnalytics.createdAt, period.end),
  );

  const breakdownRows = await db
    .select({
      eventType: usageAnalytics.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(usageAnalytics)
    .where(periodFilter)
    .groupBy(usageAnalytics.eventType);

  const breakdownByType: Record<string, number> = {};
  let events = 0;
  let programs = 0;
  let aiRequests = 0;
  for (const row of breakdownRows) {
    const count = row.count ?? 0;
    breakdownByType[row.eventType] = count;
    events += count;
    if (row.eventType === 'program_generated') programs += count;
    if (isAiUsageEvent(row.eventType)) aiRequests += count;
  }

  const userIds = await scopedUserIds(user);
  const storageScope =
    userIds.length === 1
      ? eq(generatedPrograms.userId, userIds[0])
      : inArray(generatedPrograms.userId, userIds);

  const [{ programBytes }] = await db
    .select({ programBytes: sql<number>`coalesce(sum(${generatedPrograms.fileSize}), 0)::int` })
    .from(generatedPrograms)
    .where(storageScope);

  const fileScope =
    userIds.length === 1
      ? eq(fileOperations.userId, userIds[0])
      : inArray(fileOperations.userId, userIds);

  const [{ fileBytes }] = await db
    .select({ fileBytes: sql<number>`coalesce(sum(${fileOperations.fileSize}), 0)::int` })
    .from(fileOperations)
    .where(fileScope);

  const storageGb = bytesToGb((programBytes ?? 0) + (fileBytes ?? 0));
  const teamSeats = orgContext.teamMembers;

  const used = {
    programs,
    aiRequests,
    storageGb,
    events,
    teamSeats,
  };

  const overLimit = computeOverLimit(
    { programs, aiRequests, storageGb, teamSeats },
    limits,
  );

  const programDaily = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${usageAnalytics.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(usageAnalytics)
    .where(and(periodFilter, eq(usageAnalytics.eventType, 'program_generated')))
    .groupBy(sql`date_trunc('day', ${usageAnalytics.createdAt})`)
    .orderBy(desc(sql`date_trunc('day', ${usageAnalytics.createdAt})`))
    .limit(14);

  const aiDaily = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${usageAnalytics.createdAt}), 'YYYY-MM-DD')`,
      eventType: usageAnalytics.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(usageAnalytics)
    .where(and(periodFilter, inArray(usageAnalytics.eventType, [...AI_USAGE_EVENTS])))
    .groupBy(sql`date_trunc('day', ${usageAnalytics.createdAt})`, usageAnalytics.eventType)
    .orderBy(desc(sql`date_trunc('day', ${usageAnalytics.createdAt})`))
    .limit(50);

  const recentPrograms: UsageDailyRow[] = programDaily.map((row) => ({
    date: row.date,
    count: row.count ?? 0,
    label: 'PLC Program',
  }));

  const recentAiRequests: UsageDailyRow[] = aiDaily.map((row) => ({
    date: row.date,
    count: row.count ?? 0,
    label: usageEventLabel(row.eventType),
  }));

  const billing = nextBillingDate(period);

  return {
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      label: period.label,
    },
    plan: {
      tier: plan.tier,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      status: 'active',
      nextBillingDate: billing.toISOString(),
      maxProjects: orgContext.maxProjects,
    },
    limits,
    used,
    percentages: {
      programs: usagePercent(programs, limits.programsPerMonth),
      aiRequests: usagePercent(aiRequests, limits.aiRequestsPerMonth),
      storageGb: usagePercent(storageGb, limits.storageGb),
      teamSeats: usagePercent(teamSeats, limits.teamSeats),
    },
    breakdownByType,
    overLimit,
    recentPrograms,
    recentAiRequests,
  };
}
