/**
 * @deprecated Phase 3 — use `lib/plc-generation.ts` and the FastAPI automation service instead.
 * Kept only so imports fail loudly during migration; do not call from new code.
 */
import type { PLCModel } from '../../../data/plc-models';

export async function generateSchneiderProgram(_logic: string, _model: PLCModel): Promise<never> {
  throw new Error(
    'Deprecated: generateSchneiderProgram was removed in Phase 3. Use /api/generate-plc (FastAPI backend).',
  );
}
