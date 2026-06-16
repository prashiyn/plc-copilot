import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/db/queries';
import { createForumThread, listForumThreads } from '@/lib/db/settings';

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category') ?? 'all';
  const threads = await listForumThreads(category);

  return NextResponse.json({
    threads: threads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      category: thread.category,
      authorName: thread.authorName,
      isPinned: thread.isPinned,
      status: thread.status,
      replies: thread.replyCount ?? 0,
      createdAt: thread.createdAt?.toISOString() ?? null,
      updatedAt: thread.updatedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, category = 'general', body: threadBody } = body;
  if (!title || !threadBody) {
    return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
  }

  const profile = body.authorName ?? 'Community Member';
  const thread = await createForumThread(user, profile, {
    title,
    category,
    body: threadBody,
  });

  return NextResponse.json({ success: true, thread }, { status: 201 });
}
