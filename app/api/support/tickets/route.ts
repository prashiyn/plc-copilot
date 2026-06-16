import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/db/queries';
import { createSupportTicket, listSupportTickets } from '@/lib/db/settings';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tickets = await listSupportTickets(user);
  return NextResponse.json({
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      body: ticket.body,
      createdAt: ticket.createdAt?.toISOString() ?? null,
      updatedAt: ticket.updatedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { subject, category = 'technical', priority = 'normal', description, body: ticketBody } = body;
  const text = ticketBody ?? description;

  if (!subject || !text) {
    return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 });
  }

  const ticket = await createSupportTicket(user, {
    subject,
    category,
    priority,
    body: text,
  });

  return NextResponse.json({ success: true, ticket }, { status: 201 });
}
