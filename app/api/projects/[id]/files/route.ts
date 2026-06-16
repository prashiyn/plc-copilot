import { NextRequest, NextResponse } from 'next/server';
import { requireUser, listProjectFiles } from '@/lib/db/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const type = new URL(request.url).searchParams.get('type') ?? undefined;
  const files = await listProjectFiles(user, id, type);
  if (files === null) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ files });
}
