import { NextRequest, NextResponse } from 'next/server';
import { aiJson, AutomationError, isAutomationConfigured } from '@/lib/automation-client';

const SYSTEM_PROMPT = `You are an expert PLC code optimization specialist. Respond with JSON only.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, platform = 'schneider', optimizationGoals = [], currentIssues = '' } = body;

    if (!code) {
      return NextResponse.json({ error: 'PLC code required for analysis' }, { status: 400 });
    }

    if (!isAutomationConfigured()) {
      return NextResponse.json({ error: 'Automation service not configured' }, { status: 500 });
    }

    const prompt = `Analyze and optimize this ${platform} PLC program. Goals: ${optimizationGoals.join(', ')}.
${currentIssues ? `Known issues: ${currentIssues}` : ''}

Code:
\`\`\`
${code}
\`\`\`

Return JSON with analysis_summary, issues_found, optimizations, refactored_code, summary.`;

    const analysisData = await aiJson({ system: SYSTEM_PROMPT, prompt, maxTokens: 8192 });

    return NextResponse.json({ success: true, analysis: analysisData });
  } catch (error) {
    console.error('Code optimization error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Code optimization failed' }, { status: 500 });
  }
}
