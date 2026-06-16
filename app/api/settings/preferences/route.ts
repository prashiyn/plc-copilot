import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/db/queries';
import { getAppPreferences, updateAppPreferences } from '@/lib/db/settings';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const preferences = await getAppPreferences(user);
  return NextResponse.json({ preferences });
}

export async function PUT(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const preferences = await updateAppPreferences(user, body);
  return NextResponse.json({ success: true, preferences });
}
