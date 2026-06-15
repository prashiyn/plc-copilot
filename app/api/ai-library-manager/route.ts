import { NextRequest, NextResponse } from 'next/server';
import { aiChat, AutomationError, isAutomationConfigured } from '@/lib/automation-client';

const SYSTEM_PROMPT = `You are an expert PLC library architect. Help create and manage reusable PLC code libraries.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, code, libraryName, description } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    if (!isAutomationConfigured()) {
      return NextResponse.json({ error: 'Automation service not configured' }, { status: 500 });
    }

    let prompt = '';
    switch (action) {
      case 'create':
        prompt = `Create a reusable PLC library: ${libraryName || 'CustomLibrary'}. ${description || ''}`;
        break;
      case 'convert':
        prompt = `Convert to library component:\n\`\`\`\n${code}\n\`\`\``;
        break;
      case 'document':
        prompt = `Document this library code:\n\`\`\`\n${code}\n\`\`\``;
        break;
      case 'suggest':
        prompt = `Suggest library extractions from:\n\`\`\`\n${code}\n\`\`\``;
        break;
      default:
        prompt = description || 'Help manage PLC libraries';
    }

    const response = await aiChat({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 4096,
      model: process.env.CLAUDE_MODEL,
    });

    return NextResponse.json({ success: true, response: response.text, usage: response.usage });
  } catch (error) {
    console.error('AI Library Manager Error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to process library request' }, { status: 500 });
  }
}
