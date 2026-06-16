import { NextRequest, NextResponse } from 'next/server';
import { deleteProjectFile, requireUser } from '@/lib/db/queries';
import { deleteFile } from '@/lib/storage';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, fileId } = await params;
  const file = await deleteProjectFile(user, id, fileId);
  if (!file) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  if (file.storageUrl) {
    await deleteFile(file.storageUrl);
  }

  return NextResponse.json({ success: true });
}
