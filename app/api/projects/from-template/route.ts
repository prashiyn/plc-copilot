import { NextRequest, NextResponse } from 'next/server';
import { createProjectFromTemplate, requireUser } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { templateId?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.templateId || typeof body.templateId !== 'string') {
    return NextResponse.json({ error: 'templateId is required.' }, { status: 400 });
  }

  const project = await createProjectFromTemplate(
    user,
    body.templateId,
    typeof body.name === 'string' && body.name.trim() ? body.name.trim() : undefined,
  );
  if (!project) {
    return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
  }

  return NextResponse.json({ project }, { status: 201 });
}
