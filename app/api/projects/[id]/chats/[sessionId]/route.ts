import { NextRequest, NextResponse } from 'next/server';
import { listProjectChatMessages, requireUser } from '@/lib/db/queries';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, sessionId } = await params;
  const messages = await listProjectChatMessages(user, id, sessionId);
  if (messages === null) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ messages });
}
