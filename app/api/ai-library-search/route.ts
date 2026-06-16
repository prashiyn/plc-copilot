import { NextRequest, NextResponse } from 'next/server';
import { AutomationError, isAutomationConfigured, librarySearch } from '@/lib/automation-client';
import { recordUsage } from '@/lib/usage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, platform = 'schneider', applicationType, requirements = [], generateCustom = false } = body;

    if (!query) {
      return NextResponse.json({ error: 'Search query required' }, { status: 400 });
    }

    if (!isAutomationConfigured()) {
      return NextResponse.json({ error: 'Automation service not configured' }, { status: 500 });
    }

    const { results } = await librarySearch({
      query,
      platform,
      applicationType,
      requirements,
      generateCustom,
    });

    await recordUsage('ai_library', { platform, query });

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Library search error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Library search failed' }, { status: 500 });
  }
}
