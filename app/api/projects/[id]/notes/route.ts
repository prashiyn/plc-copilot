import { NextRequest, NextResponse } from 'next/server';
import { requireUser, listProjectNotes, createProjectNote } from '@/lib/db/queries';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const notes = await listProjectNotes(user, id);
  if (notes === null) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ notes });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  let body: { title?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const note = await createProjectNote(user, id, body);
  if (!note) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ note }, { status: 201 });
}
