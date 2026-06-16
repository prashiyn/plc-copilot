import { NextRequest, NextResponse } from 'next/server';
import { requireUser, updateProjectNote, deleteProjectNote } from '@/lib/db/queries';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, noteId } = await params;

  let body: { title?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const note = await updateProjectNote(user, id, noteId, body);
  if (!note) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ note });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, noteId } = await params;
  const ok = await deleteProjectNote(user, id, noteId);
  if (!ok) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
