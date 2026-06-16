import { NextRequest, NextResponse } from 'next/server';
import { listProjectRectifications, requireUser } from '@/lib/db/queries';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const rectifications = await listProjectRectifications(user, id);
  if (rectifications === null) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ rectifications });
}
