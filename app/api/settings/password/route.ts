import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/db/queries';
import { changeUserPassword } from '@/lib/db/settings';

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { currentPassword, newPassword } = await request.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
    }
    await changeUserPassword(user, currentPassword, newPassword);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Password change failed' },
      { status: 400 },
    );
  }
}
