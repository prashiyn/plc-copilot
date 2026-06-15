/**
 * Claude-grounded recommendation helpers, backed by the real PLC model
 * database. Calls the FastAPI automation service (all Anthropic usage in Python).
 */
import { aiJson } from './automation-client';
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

/** Ask Claude via automation service and parse JSON response. */
export async function askClaudeJson(
  system: string,
  prompt: string,
  maxTokens = 3072,
): Promise<unknown> {
  return aiJson({ system, prompt, maxTokens });
}

// ---- PLC recommendations -------------------------------------------------

export interface RecommendedPLC {
  manufacturer: string;
  model: string;
  series: string;
  score: number;
  matchPercentage: number;
  price: number;
  reasons: string[];
  specifications: {
    ioPoints: number;
    memory: string;
    scanTime: string;
    protocols: string[];
  };
  pros: string[];
  cons: string[];
}

export async function recommendPLCsWithAI(
  requirements: Record<string, unknown>,
  requiredIO: number,
): Promise<RecommendedPLC[]> {
  const system =
    'You are a senior controls engineer. Recommend PLCs strictly from the ' +
    'provided catalog. Respond with JSON only — no prose, no markdown.';
  const prompt = `CATALOG (manufacturer | series | model | specs):
${buildCatalogText()}

PROJECT REQUIREMENTS (JSON):
${JSON.stringify(requirements, null, 2)}

Estimated total I/O points needed: ${requiredIO}.

Pick the 3 best-matching models FROM THE CATALOG ABOVE. Respond with a JSON array
of exactly 3 objects in this shape (price is a number in USD, matchPercentage 0-100):
[{
  "manufacturer": "", "model": "", "series": "",
  "score": 0, "matchPercentage": 0, "price": 0,
  "reasons": ["why it fits this project"],
  "specifications": { "ioPoints": 0, "memory": "", "scanTime": "", "protocols": [""] },
  "pros": [""], "cons": [""]
}]`;

  const parsed = await askClaudeJson(system, prompt);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Unexpected recommendation response');
  }
  return parsed.slice(0, 3) as RecommendedPLC[];
}
