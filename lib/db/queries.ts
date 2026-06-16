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
  errorRectifications,
  plcRecommendations,
  projectNotes,
  projectChats,
  chatSessions,
  chatMessages,
} from '@/lib/db/schema';
import { getProjectTemplate, projectInputFromTemplate } from '@/lib/templates';
import {
  activityLabelForFileOperation,
  activityLabelForNote,
  activityLabelForProgram,
  activityLabelForRectification,
  activityLabelForRecommendation,
  activityLabelForUsageEvent,
  mergeProjectActivity,
  type ProjectActivityItem,
} from '@/lib/project-activity';
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
  templateId?: string | null;
  industry?: string | null;
  tags?: string[] | null;
  coverImage?: string | null;
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

export async function getProject(user: SessionUser, id: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), projectScope(user)))
    .limit(1);
  return row ?? null;
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
      templateId: input.templateId ?? null,
      industry: input.industry ?? null,
      tags: input.tags ?? [],
      coverImage: input.coverImage ?? null,
    })
    .returning();
  await logUsage(user, 'project_created', { projectId: row.id, name: row.name });
  return row;
}

export async function createProjectFromTemplate(
  user: SessionUser,
  templateId: string,
  name?: string,
) {
  const template = getProjectTemplate(templateId);
  if (!template) return null;
  return createProject(user, projectInputFromTemplate(template, { name }));
}

export async function listProjectPrograms(user: SessionUser, projectId: string) {
  const project = await getProject(user, projectId);
  if (!project) return null;
  return db
    .select()
    .from(generatedPrograms)
    .where(eq(generatedPrograms.projectId, projectId))
    .orderBy(desc(generatedPrograms.createdAt));
}

export async function listProjectFiles(
  user: SessionUser,
  projectId: string,
  operationType?: string,
) {
  const project = await getProject(user, projectId);
  if (!project) return null;
  const conds: SQL[] = [eq(fileOperations.projectId, projectId)];
  if (operationType) conds.push(eq(fileOperations.operationType, operationType));
  return db
    .select()
    .from(fileOperations)
    .where(and(...conds))
    .orderBy(desc(fileOperations.createdAt));
}

export async function listProjectRectifications(user: SessionUser, projectId: string) {
  const project = await getProject(user, projectId);
  if (!project) return null;
  return db
    .select()
    .from(errorRectifications)
    .where(eq(errorRectifications.projectId, projectId))
    .orderBy(desc(errorRectifications.createdAt));
}

export async function listProjectRecommendations(user: SessionUser, projectId: string) {
  const project = await getProject(user, projectId);
  if (!project) return null;
  return db
    .select()
    .from(plcRecommendations)
    .where(eq(plcRecommendations.projectId, projectId))
    .orderBy(desc(plcRecommendations.createdAt));
}

export async function listProjectActivity(
  user: SessionUser,
  projectId: string,
  limit = 10,
): Promise<ProjectActivityItem[] | null> {
  const project = await getProject(user, projectId);
  if (!project) return null;

  const [programs, files, notes, rectifications, recommendations, usageRows] = await Promise.all([
    db
      .select({
        id: generatedPrograms.id,
        fileName: generatedPrograms.fileName,
        programFormat: generatedPrograms.programFormat,
        createdAt: generatedPrograms.createdAt,
      })
      .from(generatedPrograms)
      .where(eq(generatedPrograms.projectId, projectId))
      .orderBy(desc(generatedPrograms.createdAt))
      .limit(20),
    db
      .select({
        id: fileOperations.id,
        operationType: fileOperations.operationType,
        fileName: fileOperations.fileName,
        createdAt: fileOperations.createdAt,
      })
      .from(fileOperations)
      .where(eq(fileOperations.projectId, projectId))
      .orderBy(desc(fileOperations.createdAt))
      .limit(20),
    db
      .select({
        id: projectNotes.id,
        title: projectNotes.title,
        createdAt: projectNotes.createdAt,
      })
      .from(projectNotes)
      .where(eq(projectNotes.projectId, projectId))
      .orderBy(desc(projectNotes.createdAt))
      .limit(20),
    db
      .select({
        id: errorRectifications.id,
        errorMessage: errorRectifications.errorMessage,
        createdAt: errorRectifications.createdAt,
      })
      .from(errorRectifications)
      .where(eq(errorRectifications.projectId, projectId))
      .orderBy(desc(errorRectifications.createdAt))
      .limit(20),
    db
      .select({
        id: plcRecommendations.id,
        criteria: plcRecommendations.criteria,
        createdAt: plcRecommendations.createdAt,
      })
      .from(plcRecommendations)
      .where(eq(plcRecommendations.projectId, projectId))
      .orderBy(desc(plcRecommendations.createdAt))
      .limit(20),
    db
      .select({
        id: usageAnalytics.id,
        eventType: usageAnalytics.eventType,
        eventData: usageAnalytics.eventData,
        createdAt: usageAnalytics.createdAt,
      })
      .from(usageAnalytics)
      .where(
        and(
          analyticsScope(user),
          sql`${usageAnalytics.eventData}->>'projectId' = ${projectId}`,
        ),
      )
      .orderBy(desc(usageAnalytics.createdAt))
      .limit(20),
  ]);

  const items: ProjectActivityItem[] = [];

  if (project.createdAt) {
    items.push({
      id: `project-created-${project.id}`,
      eventType: 'project_created',
      label: `Project created: ${project.name}`,
      detail: null,
      createdAt: project.createdAt.toISOString(),
    });
  }

  for (const row of programs) {
    items.push({
      id: `program-${row.id}`,
      eventType: 'program_generated',
      label: activityLabelForProgram(row.fileName, row.programFormat),
      detail: null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    });
  }

  for (const row of files) {
    items.push({
      id: `file-${row.id}`,
      eventType: row.operationType,
      label: activityLabelForFileOperation(row.operationType, row.fileName),
      detail: null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    });
  }

  for (const row of notes) {
    items.push({
      id: `note-${row.id}`,
      eventType: 'note_added',
      label: activityLabelForNote(row.title),
      detail: null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    });
  }

  for (const row of rectifications) {
    items.push({
      id: `rect-${row.id}`,
      eventType: 'error_rectified',
      label: activityLabelForRectification(row.errorMessage),
      detail: null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    });
  }

  for (const row of recommendations) {
    items.push({
      id: `rec-${row.id}`,
      eventType: 'plc_recommended',
      label: activityLabelForRecommendation(row.criteria),
      detail: null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    });
  }

  for (const row of usageRows) {
    if (
      row.eventType === 'program_generated' ||
      row.eventType === 'rectify_error' ||
      row.eventType === 'recommend_plc' ||
      row.eventType === 'project_created' ||
      row.eventType === 'file_uploaded' ||
      row.eventType === 'note_added'
    ) {
      continue;
    }
    items.push({
      id: `usage-${row.id}`,
      eventType: row.eventType,
      label: activityLabelForUsageEvent(row.eventType, row.eventData),
      detail: null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    });
  }

  return mergeProjectActivity(items, limit);
}

export interface NoteInput {
  title?: string;
  body?: string;
}

export async function listProjectNotes(user: SessionUser, projectId: string) {
  const project = await getProject(user, projectId);
  if (!project) return null;
  return db
    .select()
    .from(projectNotes)
    .where(eq(projectNotes.projectId, projectId))
    .orderBy(desc(projectNotes.createdAt));
}

export async function createProjectNote(
  user: SessionUser,
  projectId: string,
  input: NoteInput,
) {
  const project = await getProject(user, projectId);
  if (!project) return null;
  const [row] = await db
    .insert(projectNotes)
    .values({
      projectId,
      userId: user.id,
      title: input.title ?? 'Note',
      body: input.body ?? '',
    })
    .returning();
  await logUsage(user, 'note_added', { projectId, noteId: row.id, title: row.title });
  return row;
}

export async function updateProjectNote(
  user: SessionUser,
  projectId: string,
  noteId: string,
  patch: NoteInput,
) {
  const project = await getProject(user, projectId);
  if (!project) return null;
  const [row] = await db
    .update(projectNotes)
    .set({
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.body !== undefined && { body: patch.body }),
    })
    .where(and(eq(projectNotes.id, noteId), eq(projectNotes.projectId, projectId)))
    .returning();
  return row ?? null;
}

export async function deleteProjectNote(
  user: SessionUser,
  projectId: string,
  noteId: string,
) {
  const project = await getProject(user, projectId);
  if (!project) return false;
  const [row] = await db
    .delete(projectNotes)
    .where(and(eq(projectNotes.id, noteId), eq(projectNotes.projectId, projectId)))
    .returning({ id: projectNotes.id });
  return !!row;
}

export async function listProjectChats(user: SessionUser, projectId: string) {
  const project = await getProject(user, projectId);
  if (!project) return null;
  const links = await db
    .select({
      sessionId: projectChats.sessionId,
      linkedAt: projectChats.createdAt,
      engineerName: chatSessions.engineerName,
      engineerSpecialty: chatSessions.engineerSpecialty,
      status: chatSessions.status,
      startedAt: chatSessions.startedAt,
    })
    .from(projectChats)
    .innerJoin(chatSessions, eq(chatSessions.id, projectChats.sessionId))
    .where(eq(projectChats.projectId, projectId))
    .orderBy(desc(chatSessions.startedAt));

  const sessionIds = links.map((l) => l.sessionId);
  if (sessionIds.length === 0) return [];

  const messageCounts = await db
    .select({
      sessionId: chatMessages.sessionId,
      count: sql<number>`count(*)::int`,
      lastMessage: sql<string>`max(${chatMessages.createdAt}::text)`,
    })
    .from(chatMessages)
    .where(inArray(chatMessages.sessionId, sessionIds))
    .groupBy(chatMessages.sessionId);

  const countMap = new Map(messageCounts.map((r) => [r.sessionId, r]));

  const previewRows = await db
    .select({
      sessionId: chatMessages.sessionId,
      message: chatMessages.message,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(inArray(chatMessages.sessionId, sessionIds))
    .orderBy(desc(chatMessages.createdAt));

  const previewMap = new Map<string, string>();
  for (const row of previewRows) {
    if (!previewMap.has(row.sessionId)) {
      previewMap.set(row.sessionId, row.message);
    }
  }

  return links.map((l) => ({
    ...l,
    messageCount: countMap.get(l.sessionId)?.count ?? 0,
    lastMessageAt: countMap.get(l.sessionId)?.lastMessage ?? null,
    lastMessagePreview: previewMap.get(l.sessionId) ?? null,
  }));
}

export async function getChatSession(user: SessionUser, sessionId: string) {
  const [row] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, user.id)))
    .limit(1);
  return row ?? null;
}

export async function createChatSession(
  user: SessionUser,
  input: { engineerName?: string | null; engineerSpecialty?: string | null } = {},
) {
  const [row] = await db
    .insert(chatSessions)
    .values({
      userId: user.id,
      engineerName: input.engineerName ?? 'AI Co-Pilot',
      engineerSpecialty: input.engineerSpecialty ?? null,
      status: 'active',
    })
    .returning();
  return row;
}

export async function addChatMessage(
  user: SessionUser,
  sessionId: string,
  sender: string,
  message: string,
) {
  const session = await getChatSession(user, sessionId);
  if (!session) throw new Error('Invalid sessionId');
  const [row] = await db
    .insert(chatMessages)
    .values({ sessionId, sender, message })
    .returning();
  return row;
}

export async function getProjectIdForSession(sessionId: string): Promise<string | null> {
  const [link] = await db
    .select({ projectId: projectChats.projectId })
    .from(projectChats)
    .where(eq(projectChats.sessionId, sessionId))
    .limit(1);
  return link?.projectId ?? null;
}

export async function listProjectChatMessages(
  user: SessionUser,
  projectId: string,
  sessionId: string,
) {
  const project = await getProject(user, projectId);
  if (!project) return null;
  const [link] = await db
    .select({ id: projectChats.id })
    .from(projectChats)
    .where(and(eq(projectChats.projectId, projectId), eq(projectChats.sessionId, sessionId)))
    .limit(1);
  if (!link) return null;
  const session = await getChatSession(user, sessionId);
  if (!session) return null;
  return db
    .select({
      id: chatMessages.id,
      sender: chatMessages.sender,
      message: chatMessages.message,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);
}

export async function resolveProjectForChat(
  user: SessionUser,
  projectId?: string | null,
  sessionId?: string | null,
) {
  let scopedProjectId = projectId?.trim() || null;
  if (!scopedProjectId && sessionId) {
    scopedProjectId = await getProjectIdForSession(sessionId);
  }
  if (!scopedProjectId) return null;
  return getProject(user, scopedProjectId);
}

export async function linkChatToProject(
  user: SessionUser,
  projectId: string,
  sessionId: string,
) {
  const project = await getProject(user, projectId);
  if (!project) throw new Error('Invalid projectId');
  const session = await getChatSession(user, sessionId);
  if (!session) throw new Error('Invalid sessionId');
  const existing = await db
    .select({ id: projectChats.id })
    .from(projectChats)
    .where(and(eq(projectChats.projectId, projectId), eq(projectChats.sessionId, sessionId)))
    .limit(1);
  if (existing.length > 0) return existing[0];
  const [row] = await db
    .insert(projectChats)
    .values({ projectId, sessionId })
    .returning();
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
      ...(patch.industry !== undefined && { industry: patch.industry }),
      ...(patch.tags !== undefined && { tags: patch.tags }),
      ...(patch.coverImage !== undefined && { coverImage: patch.coverImage }),
    })
    .where(and(eq(projects.id, id), projectScope(user)))
    .returning();
  if (row) {
    await logUsage(user, 'project_updated', { projectId: id, status: row.status });
  }
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
  let scopedProjectId: string | null = null;
  if (input.projectId) {
    const project = await getProject(user, input.projectId);
    if (!project) throw new Error('Invalid projectId');
    scopedProjectId = project.id;
  }
  const [row] = await db
    .insert(generatedPrograms)
    .values({
      userId: user.id,
      projectId: scopedProjectId,
      programCode: input.programCode,
      programFormat: input.programFormat ?? null,
      fileName: input.fileName ?? null,
      fileSize: input.programCode.length,
      generationParameters: input.generationParameters ?? null,
    })
    .returning();
  await logUsage(user, 'program_generated', {
    programId: row.id,
    format: row.programFormat,
    projectId: scopedProjectId,
  });
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

export interface FileOperationInput {
  projectId?: string | null;
  operationType: string;
  fileName?: string | null;
  filePath?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  storageUrl?: string | null;
  metadata?: unknown;
}

export async function createFileOperation(user: SessionUser, input: FileOperationInput) {
  let scopedProjectId: string | null = null;
  if (input.projectId) {
    const project = await getProject(user, input.projectId);
    if (!project) throw new Error('Invalid projectId');
    scopedProjectId = project.id;
  }
  const [row] = await db
    .insert(fileOperations)
    .values({
      userId: user.id,
      projectId: scopedProjectId,
      operationType: input.operationType,
      fileName: input.fileName ?? null,
      filePath: input.filePath ?? null,
      fileSize: input.fileSize ?? null,
      mimeType: input.mimeType ?? null,
      storageUrl: input.storageUrl ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();
  if (scopedProjectId) {
    await logUsage(user, 'file_uploaded', {
      projectId: scopedProjectId,
      fileId: row.id,
      fileName: row.fileName,
      operationType: input.operationType,
    });
  }
  return row;
}

export async function getProjectFile(user: SessionUser, projectId: string, fileId: string) {
  const project = await getProject(user, projectId);
  if (!project) return null;
  const [row] = await db
    .select()
    .from(fileOperations)
    .where(and(eq(fileOperations.id, fileId), eq(fileOperations.projectId, projectId)))
    .limit(1);
  return row ?? null;
}

export async function deleteProjectFile(user: SessionUser, projectId: string, fileId: string) {
  const file = await getProjectFile(user, projectId, fileId);
  if (!file || file.operationType !== 'user_upload') return null;
  const [row] = await db
    .delete(fileOperations)
    .where(and(eq(fileOperations.id, fileId), eq(fileOperations.projectId, projectId)))
    .returning();
  return row ?? null;
}

export interface ErrorRectificationInput {
  projectId?: string | null;
  originalCode?: string | null;
  errorMessage?: string | null;
  errorScreenshotUrl?: string | null;
  correctedCode?: string | null;
  correctionApplied?: boolean;
  confidenceScore?: number | null;
  metadata?: unknown;
}

export async function createErrorRectification(user: SessionUser, input: ErrorRectificationInput) {
  let scopedProjectId: string | null = null;
  if (input.projectId) {
    const project = await getProject(user, input.projectId);
    if (!project) throw new Error('Invalid projectId');
    scopedProjectId = project.id;
  }
  const [row] = await db
    .insert(errorRectifications)
    .values({
      userId: user.id,
      projectId: scopedProjectId,
      originalCode: input.originalCode ?? null,
      errorMessage: input.errorMessage ?? null,
      errorScreenshotUrl: input.errorScreenshotUrl ?? null,
      correctedCode: input.correctedCode ?? null,
      correctionApplied: input.correctionApplied ?? false,
      confidenceScore: input.confidenceScore ?? null,
      metadata: input.metadata ?? null,
    })
    .returning();
  if (scopedProjectId) {
    await logUsage(user, 'rectify_error', { projectId: scopedProjectId, rectificationId: row.id });
  }
  return row;
}

export interface PlcRecommendationInput {
  projectId?: string | null;
  requirements: unknown;
  recommendedPlcs: unknown;
  selectedPlc?: unknown;
  criteria?: string | null;
}

export async function createPlcRecommendation(user: SessionUser, input: PlcRecommendationInput) {
  let scopedProjectId: string | null = null;
  if (input.projectId) {
    const project = await getProject(user, input.projectId);
    if (!project) throw new Error('Invalid projectId');
    scopedProjectId = project.id;
  }
  const [row] = await db
    .insert(plcRecommendations)
    .values({
      userId: user.id,
      projectId: scopedProjectId,
      requirements: input.requirements,
      recommendedPlcs: input.recommendedPlcs,
      selectedPlc: input.selectedPlc ?? null,
      criteria: input.criteria ?? null,
    })
    .returning();
  if (scopedProjectId) {
    await logUsage(user, 'recommend_plc', { projectId: scopedProjectId, recommendationId: row.id });
  }
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
