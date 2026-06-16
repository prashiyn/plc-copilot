import { NextRequest, NextResponse } from 'next/server';
import { getUsageSummary, requireUser } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rawOffset = request.nextUrl.searchParams.get('periodOffset');
  const periodOffset = rawOffset != null ? Math.max(0, parseInt(rawOffset, 10) || 0) : 0;

  const summary = await getUsageSummary(user, periodOffset);
  return NextResponse.json(summary);
}
