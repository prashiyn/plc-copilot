import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/db/queries';
import { createSupportMessage } from '@/lib/db/settings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, category = 'general', priority = 'normal', message } = body;

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'Name, email, subject, and message are required' }, { status: 400 });
    }

    const user = await requireUser();
    const row = await createSupportMessage({
      userId: user?.id ?? null,
      name,
      email,
      subject,
      category,
      priority,
      message,
    });

    return NextResponse.json({ success: true, messageId: row.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not send message' },
      { status: 500 },
    );
  }
}
