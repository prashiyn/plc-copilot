import { mkdir, unlink, writeFile as fsWriteFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/csv',
  'application/csv',
  'text/plain',
  'application/xml',
  'text/xml',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
]);

const EXTENSION_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
  '.xml': 'application/xml',
  '.json': 'application/json',
  '.zip': 'application/zip',
};

export function sanitizeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^\w.\-()+ ]/g, '_').trim();
  return base.length > 0 ? base.slice(0, 200) : 'upload';
}

export function resolveUploadMimeType(filename: string, mimeType: string | null): string | null {
  const normalized = mimeType?.split(';')[0].trim().toLowerCase() ?? '';
  if (normalized && normalized !== 'application/octet-stream') {
    return normalized;
  }
  const ext = path.extname(filename).toLowerCase();
  return EXTENSION_MIME[ext] ?? null;
}

export function isAllowedUpload(filename: string, mimeType: string | null): boolean {
  const resolved = resolveUploadMimeType(filename, mimeType);
  if (!resolved) return false;
  if (resolved.startsWith('image/')) return true;
  return ALLOWED_MIME_TYPES.has(resolved);
}

export function storagePathFromUrl(storageUrl: string): string | null {
  if (!storageUrl.startsWith('/uploads/')) return null;
  const relative = storageUrl.replace(/^\/+/, '');
  const absolute = path.join(process.cwd(), 'public', relative);
  const uploadsRoot = path.join(process.cwd(), 'public', 'uploads');
  if (!absolute.startsWith(uploadsRoot)) return null;
  return absolute;
}

export async function writeFile(
  projectId: string,
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const safeName = sanitizeFilename(filename);
  const storedName = `${randomUUID()}-${safeName}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
  await mkdir(dir, { recursive: true });
  const diskPath = path.join(dir, storedName);
  await fsWriteFile(diskPath, buffer);
  return `/uploads/projects/${projectId}/${storedName}`;
}

export async function deleteFile(storageUrl: string): Promise<void> {
  const diskPath = storagePathFromUrl(storageUrl);
  if (!diskPath) return;
  try {
    await unlink(diskPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw err;
  }
}
