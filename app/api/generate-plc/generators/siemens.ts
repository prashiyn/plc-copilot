/**
 * @deprecated Phase 3 — use `lib/plc-generation.ts` and the FastAPI automation service instead.
 */
import type { PLCModel } from '../../../data/plc-models';

export async function generateSiemensProgram(_logic: string, _model: PLCModel): Promise<never> {
  throw new Error(
    'Deprecated: generateSiemensProgram was removed in Phase 3. Use /api/generate-plc (FastAPI backend).',
  );
}
