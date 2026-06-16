import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/db/queries';
import { createForumPost, getForumThread } from '@/lib/db/settings';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = await getForumThread(id);
  if (!data) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  if (!body.body) return NextResponse.json({ error: 'Reply body is required' }, { status: 400 });

  const post = await createForumPost(user, body.authorName ?? 'Community Member', id, body.body);
  return NextResponse.json({ success: true, post }, { status: 201 });
}
