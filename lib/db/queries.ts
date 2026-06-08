/**
 * Auth-scoped data access. All functions resolve the current session and scope
 * queries to the user's organization (falling back to the user when they have
 * no org). API routes / server components call these directly.
 */
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { projects, generatedPrograms, usageAnalytics } from '@/lib/db/schema';

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
