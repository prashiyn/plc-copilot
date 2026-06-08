import { NextRequest, NextResponse } from 'next/server';
import { requireUser, listPrograms, createProgram } from '@/lib/db/queries';

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const programs = await listPrograms(user);
  return NextResponse.json({ programs });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { programCode?: string; [k: string]: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body.programCode || typeof body.programCode !== 'string') {
    return NextResponse.json({ error: 'programCode is required.' }, { status: 400 });
  }

  const program = await createProgram(user, body as Parameters<typeof createProgram>[1]);
  return NextResponse.json({ program }, { status: 201 });
}
