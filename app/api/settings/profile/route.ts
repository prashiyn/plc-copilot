import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/db/queries';
import { getProfileSettings, updateProfileSettings } from '@/lib/db/settings';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const profile = await getProfileSettings(user);
  return NextResponse.json({ profile });
}

export async function PUT(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const profile = await updateProfileSettings(user, body);
  return NextResponse.json({ success: true, profile });
}
