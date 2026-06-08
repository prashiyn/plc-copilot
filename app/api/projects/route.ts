import { NextRequest, NextResponse } from 'next/server';
import { requireUser, listProjects, createProject, type ProjectInput } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = new URL(request.url).searchParams.get('status') ?? undefined;
  const projects = await listProjects(user, status);
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Partial<ProjectInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'Project name is required.' }, { status: 400 });
  }

  const project = await createProject(user, { ...body, name: body.name });
  return NextResponse.json({ project }, { status: 201 });
}
