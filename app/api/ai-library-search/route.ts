import { NextRequest, NextResponse } from 'next/server';
import { aiJson, AutomationError, isAutomationConfigured } from '@/lib/automation-client';

const SYSTEM_PROMPT = `You are an expert PLC function block library manager. Respond with JSON only.`;

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

    const prompt = `Search PLC libraries for: ${query}
Platform: ${platform}
${applicationType ? `Application: ${applicationType}` : ''}
Requirements: ${requirements.join(', ')}
${generateCustom ? 'Generate custom blocks if needed.' : ''}

Return JSON with search_results, recommendations, integration_guide, custom_blocks.`;

    const searchData = await aiJson({ system: SYSTEM_PROMPT, prompt, maxTokens: 6144 });

    return NextResponse.json({ success: true, results: searchData });
  } catch (error) {
    console.error('Library search error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Library search failed' }, { status: 500 });
  }
}
