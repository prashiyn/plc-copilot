import { NextResponse } from 'next/server';
import { requireUser, getDashboardStats } from '@/lib/db/queries';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stats = await getDashboardStats(user);
  return NextResponse.json({ stats });
}
