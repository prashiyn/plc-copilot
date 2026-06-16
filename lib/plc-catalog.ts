import { readFileSync } from 'fs';
import path from 'path';

export interface CatalogEntry {
  id: string;
  manufacturer: string;
  series: string;
  model: string;
  ioDescription: string;
  memoryKb: number | null;
  scanTime: string | null;
  connectivity: string;
  priceMin: number;
  priceMax: number;
  priceMid: number;
}

const CATALOG_PATH = path.join(
  process.cwd(),
  'automation',
  'api',
  'data',
  'plc_catalog.txt',
);

function parsePriceRange(part: string): { min: number; max: number } | null {
  const match = part.match(/\$(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  return { min: parseInt(match[1], 10), max: parseInt(match[2], 10) };
}

function parseMemoryKb(part: string): number | null {
  const match = part.match(/(\d+)\s*KB/i);
  return match ? parseInt(match[1], 10) : null;
}

/** Parse one pipe-delimited catalog line (matches automation/api/data/plc_catalog.txt). */
export function parseCatalogLine(line: string): CatalogEntry | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const parts = trimmed.split('|').map((p) => p.trim());
  if (parts.length < 4) return null;

  const [manufacturer, series, model, ioDescription, ...rest] = parts;
  let memoryKb: number | null = null;
  let scanTime: string | null = null;
  const connectivityParts: string[] = [];
  let priceMin = 0;
  let priceMax = 0;

  for (const part of rest) {
    const price = parsePriceRange(part);
    if (price) {
      priceMin = price.min;
      priceMax = price.max;
      continue;
    }
    const mem = parseMemoryKb(part);
    if (mem !== null && part.toUpperCase().includes('KB')) {
      memoryKb = mem;
      continue;
    }
    if (/ms|μs|μs|μ/.test(part)) {
      scanTime = part;
      continue;
    }
    if (part) connectivityParts.push(part);
  }

  const priceMid = priceMin && priceMax ? Math.round((priceMin + priceMax) / 2) : 0;

  return {
    id: `${manufacturer}-${model}`.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase(),
    manufacturer,
    series,
    model,
    ioDescription,
    memoryKb,
    scanTime,
    connectivity: connectivityParts.join(', ') || '—',
    priceMin,
    priceMax,
    priceMid,
  };
}

export function loadPlcCatalog(): CatalogEntry[] {
  const raw = readFileSync(CATALOG_PATH, 'utf-8');
  const entries: CatalogEntry[] = [];
  for (const line of raw.split('\n')) {
    const entry = parseCatalogLine(line);
    if (entry) entries.push(entry);
  }
  return entries;
}

/** Curated compare set: one entry per major manufacturer at a mid-range price point. */
export function defaultCompareEntries(catalog: CatalogEntry[]): CatalogEntry[] {
  const targets = [
    { manufacturer: 'Schneider Electric', modelIncludes: 'TM221CE24' },
    { manufacturer: 'Siemens', modelIncludes: '1214C' },
    { manufacturer: 'Rockwell Automation', modelIncludes: '5380' },
    { manufacturer: 'Mitsubishi', modelIncludes: 'FX5U' },
  ];

  const picked: CatalogEntry[] = [];
  for (const target of targets) {
    const match =
      catalog.find(
        (e) =>
          e.manufacturer === target.manufacturer &&
          e.model.includes(target.modelIncludes),
      ) ??
      catalog.find((e) => e.manufacturer.includes(target.manufacturer.split(' ')[0]));
    if (match && !picked.some((p) => p.id === match.id)) picked.push(match);
  }
  return picked.length > 0 ? picked : catalog.slice(0, 8);
}
