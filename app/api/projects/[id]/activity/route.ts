import { NextRequest, NextResponse } from 'next/server';
import { listProjectActivity, requireUser } from '@/lib/db/queries';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const activity = await listProjectActivity(user, id, 10);
  if (activity === null) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ activity });
}
