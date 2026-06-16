import { NextRequest, NextResponse } from 'next/server';
import {
  createFileOperation,
  listProjectFiles,
  requireUser,
} from '@/lib/db/queries';
import {
  deleteFile,
  isAllowedUpload,
  MAX_UPLOAD_BYTES,
  resolveUploadMimeType,
  writeFile,
} from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const type = new URL(request.url).searchParams.get('type') ?? undefined;
  const files = await listProjectFiles(user, id, type);
  if (files === null) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ files });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data.' }, { status: 400 });
  }

  const upload = formData.get('file');
  if (!(upload instanceof File)) {
    return NextResponse.json({ error: 'A file is required.' }, { status: 400 });
  }

  if (upload.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: 'File exceeds the 50 MB upload limit.' },
      { status: 413 },
    );
  }

  if (!isAllowedUpload(upload.name, upload.type || null)) {
    return NextResponse.json(
      { error: 'File type not allowed. Use images, PDF, CSV, XML, JSON, or ZIP.' },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await upload.arrayBuffer());
  const mimeType = resolveUploadMimeType(upload.name, upload.type || null);
  const storageUrl = await writeFile(projectId, upload.name, buffer);

  try {
    const file = await createFileOperation(user, {
      projectId,
      operationType: 'user_upload',
      fileName: upload.name,
      filePath: storageUrl,
      fileSize: buffer.length,
      mimeType,
      storageUrl,
    });
    return NextResponse.json({ file }, { status: 201 });
  } catch (err) {
    await deleteFile(storageUrl);
    if (err instanceof Error && err.message === 'Invalid projectId') {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }
    throw err;
  }
}
