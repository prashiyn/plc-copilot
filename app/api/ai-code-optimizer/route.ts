import { NextRequest, NextResponse } from 'next/server';
import { aiChat, AutomationError, isAutomationConfigured } from '@/lib/automation-client';

const SYSTEM_PROMPT = `You are an expert PLC code optimizer specializing in industrial automation.
Analyze and optimize PLC code for performance, readability, and maintainability.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, optimizationType } = body;

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    if (!isAutomationConfigured()) {
      return NextResponse.json({ error: 'Automation service not configured' }, { status: 500 });
    }

    const prompt = `Optimize the following PLC code (focus: ${optimizationType || 'general'}):\n\n\`\`\`\n${code}\n\`\`\``;

    const response = await aiChat({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
      model: process.env.CLAUDE_MODEL,
    });

    return NextResponse.json({ success: true, response: response.text, usage: response.usage });
  } catch (error) {
    console.error('AI Code Optimizer Error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to optimize code' }, { status: 500 });
  }
}
