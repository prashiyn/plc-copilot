import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/db/queries';
import { updateSupportTicket } from '@/lib/db/settings';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const ticket = await updateSupportTicket(user, id, { status: body.status });

  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  return NextResponse.json({ success: true, ticket });
}
