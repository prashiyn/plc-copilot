import { NextResponse } from 'next/server';
import { defaultCompareEntries, loadPlcCatalog } from '@/lib/plc-catalog';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const catalog = loadPlcCatalog();
    const compareDefaults = defaultCompareEntries(catalog);
    const compareDefaultIds = compareDefaults.map((e) => e.id);

    if (searchParams.get('compareDefaults') === 'true') {
      return NextResponse.json({
        entries: compareDefaults,
        compareDefaultIds,
        total: compareDefaults.length,
      });
    }

    return NextResponse.json({
      entries: catalog,
      compareDefaultIds,
      total: catalog.length,
    });
  } catch (error) {
    console.error('PLC catalog load error:', error);
    return NextResponse.json({ error: 'Failed to load PLC catalog' }, { status: 500 });
  }
}
