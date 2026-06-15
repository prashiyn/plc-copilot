import type { PlcProgram } from '@/lib/plc-ir/types';

export type SketchGenerateResult = {
  content: Buffer;
  fileName: string;
  mimeType: string;
  metadata?: Record<string, unknown>;
  ir?: PlcProgram;
};

export type SketchGenerateJsonBody = {
  success: true;
  fileName: string;
  mimeType: string;
  contentBase64: string;
  metadata?: Record<string, unknown>;
  ir?: PlcProgram;
};

/** Build JSON or binary response for sketch generation (BFF route). */
export function buildSketchGenerateResponse(
  generated: SketchGenerateResult,
  includeMetadata: boolean,
): { kind: 'json'; body: SketchGenerateJsonBody } | { kind: 'binary'; content: Uint8Array; headers: Record<string, string> } {
  if (includeMetadata) {
    return {
      kind: 'json',
      body: {
        success: true,
        fileName: generated.fileName,
        mimeType: generated.mimeType,
        contentBase64: generated.content.toString('base64'),
        metadata: generated.metadata,
        ir: generated.ir,
      },
    };
  }

  return {
    kind: 'binary',
    content: new Uint8Array(generated.content),
    headers: {
      'Content-Type': generated.mimeType,
      'Content-Disposition': `attachment; filename="${generated.fileName}"`,
    },
  };
}
