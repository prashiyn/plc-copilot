import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  apiKeys,
  forumPosts,
  forumThreads,
  supportMessages,
  supportTickets,
  users,
} from '@/lib/db/schema';
import type { SessionUser } from '@/lib/db/queries';
import {
  mergeAppPreferences,
  mergeNotificationSettings,
  mergeProfile,
  parseUserSettings,
  type AppPreferences,
  type NotificationSettings,
  type ProfileSettings,
  type UserSettingsDocument,
} from '@/lib/user-settings';

async function getUserRow(userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

async function saveUserSettings(userId: string, patch: UserSettingsDocument) {
  const row = await getUserRow(userId);
  if (!row) return null;
  const current = parseUserSettings(row.preferences);
  const next: UserSettingsDocument = {
    profile: { ...current.profile, ...patch.profile },
    app: { ...current.app, ...patch.app },
    notifications: { ...current.notifications, ...patch.notifications },
  };
  const [updated] = await db
    .update(users)
    .set({ preferences: next })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

export async function getProfileSettings(user: SessionUser) {
  const row = await getUserRow(user.id);
  if (!row) return null;
  const settings = parseUserSettings(row.preferences);
  return mergeProfile(row.email, row.fullName, settings);
}

export async function updateProfileSettings(
  user: SessionUser,
  profile: Partial<ProfileSettings>,
) {
  const row = await getUserRow(user.id);
  if (!row) return null;

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || row.fullName;
  const settings = parseUserSettings(row.preferences);
  const nextProfile = { ...settings.profile, ...profile };

  const [updated] = await db
    .update(users)
    .set({
      fullName,
      preferences: { ...settings, profile: nextProfile },
    })
    .where(eq(users.id, user.id))
    .returning();

  return mergeProfile(updated.email, updated.fullName, parseUserSettings(updated.preferences));
}

export async function getAppPreferences(user: SessionUser): Promise<AppPreferences> {
  const row = await getUserRow(user.id);
  return mergeAppPreferences(parseUserSettings(row?.preferences));
}

export async function updateAppPreferences(user: SessionUser, patch: Partial<AppPreferences>) {
  await saveUserSettings(user.id, { app: patch });
  return getAppPreferences(user);
}

export async function getNotificationSettings(user: SessionUser): Promise<NotificationSettings> {
  const row = await getUserRow(user.id);
  return mergeNotificationSettings(parseUserSettings(row?.preferences));
}

export async function updateNotificationSettings(
  user: SessionUser,
  patch: NotificationSettings,
) {
  await saveUserSettings(user.id, { notifications: patch });
  return getNotificationSettings(user);
}

export async function changeUserPassword(
  user: SessionUser,
  currentPassword: string,
  newPassword: string,
) {
  const row = await getUserRow(user.id);
  if (!row?.passwordHash) {
    throw new Error('Password authentication is not configured for this account');
  }
  const valid = await bcrypt.compare(currentPassword, row.passwordHash);
  if (!valid) throw new Error('Current password is incorrect');
  if (newPassword.length < 8) throw new Error('New password must be at least 8 characters');

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
}

function maskApiKey(raw: string): string {
  if (raw.length <= 8) return '••••';
  return `${raw.slice(0, 7)}••••••••••••${raw.slice(-4)}`;
}

export async function listUserApiKeys(user: SessionUser) {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, user.id), eq(apiKeys.isActive, true)))
    .orderBy(desc(apiKeys.createdAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.keyName ?? 'API Key',
    maskedKey: maskApiKey(row.apiKey),
    createdAt: row.createdAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    status: row.isActive ? 'active' : 'revoked',
  }));
}

export async function createUserApiKey(user: SessionUser, keyName: string) {
  const rawKey = `pk_live_${randomBytes(24).toString('hex')}`;
  const [row] = await db
    .insert(apiKeys)
    .values({
      userId: user.id,
      organizationId: user.organizationId,
      keyName,
      apiKey: rawKey,
      isActive: true,
    })
    .returning();

  return {
    id: row.id,
    name: row.keyName ?? keyName,
    apiKey: rawKey,
    createdAt: row.createdAt?.toISOString() ?? null,
  };
}

export async function revokeUserApiKey(user: SessionUser, keyId: string) {
  const [row] = await db
    .update(apiKeys)
    .set({ isActive: false })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id)))
    .returning({ id: apiKeys.id });
  return !!row;
}

export async function createSupportMessage(input: {
  userId?: string | null;
  name: string;
  email: string;
  subject: string;
  category: string;
  priority: string;
  message: string;
}) {
  const [row] = await db
    .insert(supportMessages)
    .values({
      userId: input.userId ?? null,
      name: input.name,
      email: input.email,
      subject: input.subject,
      category: input.category,
      priority: input.priority,
      message: input.message,
    })
    .returning();
  return row;
}

async function nextTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(supportTickets)
    .where(sql`extract(year from ${supportTickets.createdAt}) = ${year}`);
  const seq = String((count ?? 0) + 1).padStart(3, '0');
  return `TICK-${year}-${seq}`;
}

export async function listSupportTickets(user: SessionUser) {
  return db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, user.id))
    .orderBy(desc(supportTickets.updatedAt));
}

export async function createSupportTicket(
  user: SessionUser,
  input: { subject: string; category: string; priority: string; body: string },
) {
  const ticketNumber = await nextTicketNumber();
  const [row] = await db
    .insert(supportTickets)
    .values({
      userId: user.id,
      ticketNumber,
      subject: input.subject,
      category: input.category,
      priority: input.priority,
      body: input.body,
      status: 'open',
    })
    .returning();
  return row;
}

export async function updateSupportTicket(
  user: SessionUser,
  ticketId: string,
  patch: { status?: string },
) {
  const [row] = await db
    .update(supportTickets)
    .set({
      ...(patch.status !== undefined && { status: patch.status }),
    })
    .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, user.id)))
    .returning();
  return row ?? null;
}

export async function ensureForumSeed() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(forumThreads);
  if ((count ?? 0) > 0) return;

  const [thread] = await db
    .insert(forumThreads)
    .values({
      authorName: 'PLCAutoPilot Team',
      title: 'Welcome to the PLCAutoPilot Community!',
      category: 'general',
      body: 'Introduce yourself and share what you are building with PLCAutoPilot.',
      isPinned: true,
      status: 'open',
    })
    .returning();

  await db.insert(forumPosts).values({
    threadId: thread.id,
    authorName: 'PLCAutoPilot Team',
    body: 'This forum is for help, feature ideas, and project showcases. Be respectful and include PLC platform details when asking for help.',
  });
}

export async function listForumThreads(category?: string) {
  await ensureForumSeed();
  const baseQuery = db
    .select({
      id: forumThreads.id,
      title: forumThreads.title,
      category: forumThreads.category,
      authorName: forumThreads.authorName,
      isPinned: forumThreads.isPinned,
      status: forumThreads.status,
      createdAt: forumThreads.createdAt,
      updatedAt: forumThreads.updatedAt,
      replyCount: sql<number>`(
        select count(*)::int from forum_posts
        where forum_posts.thread_id = ${forumThreads.id}
      )`,
    })
    .from(forumThreads);

  if (category && category !== 'all') {
    return baseQuery
      .where(eq(forumThreads.category, category))
      .orderBy(desc(forumThreads.isPinned), desc(forumThreads.updatedAt));
  }

  return baseQuery.orderBy(desc(forumThreads.isPinned), desc(forumThreads.updatedAt));
}

export async function createForumThread(
  user: SessionUser,
  authorName: string,
  input: { title: string; category: string; body: string },
) {
  const [thread] = await db
    .insert(forumThreads)
    .values({
      userId: user.id,
      authorName,
      title: input.title,
      category: input.category,
      body: input.body,
      isPinned: false,
      status: 'open',
    })
    .returning();

  await db.insert(forumPosts).values({
    threadId: thread.id,
    userId: user.id,
    authorName,
    body: input.body,
  });

  return thread;
}

export async function getForumThread(threadId: string) {
  const [thread] = await db.select().from(forumThreads).where(eq(forumThreads.id, threadId)).limit(1);
  if (!thread) return null;
  const posts = await db
    .select()
    .from(forumPosts)
    .where(eq(forumPosts.threadId, threadId))
    .orderBy(forumPosts.createdAt);
  return { thread, posts };
}

export async function createForumPost(
  user: SessionUser,
  authorName: string,
  threadId: string,
  body: string,
) {
  const [post] = await db
    .insert(forumPosts)
    .values({
      threadId,
      userId: user.id,
      authorName,
      body,
    })
    .returning();

  await db
    .update(forumThreads)
    .set({ updatedAt: new Date() })
    .where(eq(forumThreads.id, threadId));

  return post;
}
