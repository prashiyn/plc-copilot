import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/db/queries';
import { getNotificationSettings, updateNotificationSettings } from '@/lib/db/settings';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const notifications = await getNotificationSettings(user);
  return NextResponse.json({ notifications });
}

export async function PUT(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const notifications = await updateNotificationSettings(user, body.notifications ?? body);
  return NextResponse.json({ success: true, notifications });
}
