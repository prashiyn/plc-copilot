import { isAllowedUpload, MAX_UPLOAD_BYTES } from '@/lib/storage';

export interface UploadValidationResult {
  ok: true;
}

export interface UploadValidationError {
  ok: false;
  status: number;
  error: string;
}

export type UploadValidation = UploadValidationResult | UploadValidationError;

export function validateProjectUpload(file: {
  name: string;
  size: number;
  type: string | null;
}): UploadValidation {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, error: 'File exceeds the 50 MB upload limit.' };
  }
  if (!isAllowedUpload(file.name, file.type || null)) {
    return {
      ok: false,
      status: 415,
      error: 'File type not allowed. Use images, PDF, CSV, XML, JSON, or ZIP.',
    };
  }
  return { ok: true };
}

export function validateCoverImageUpload(file: {
  name: string;
  size: number;
  type: string | null;
}): UploadValidation {
  const base = validateProjectUpload(file);
  if (!base.ok) return base;
  const mime = file.type || '';
  if (!mime.startsWith('image/') && !/\.(png|jpe?g|gif|webp)$/i.test(file.name)) {
    return { ok: false, status: 415, error: 'Cover image must be a PNG, JPEG, GIF, or WebP file.' };
  }
  return { ok: true };
}
