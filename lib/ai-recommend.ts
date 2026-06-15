/**
 * PLC model catalog helper for documentation and tests.
 * Recommend/rectify routes call the FastAPI automation service directly.
 */
import { plcDatabase } from './plc-models-database';

/** Flatten the model DB into a compact catalog the model can reason over. */
export function buildCatalogText(): string {
  const lines: string[] = [];
  for (const mfr of plcDatabase) {
    for (const series of mfr.series) {
      for (const model of series.models) {
        const s = model.specifications ?? {};
        const parts = [s.io, s.memory, s.scanTime, s.comm, s.price]
          .filter(Boolean)
          .join(' | ');
        lines.push(`${mfr.name} | ${series.name} | ${model.name} | ${parts}`);
      }
    }
  }
  return lines.join('\n');
}
