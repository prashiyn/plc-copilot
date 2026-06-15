import { NextRequest, NextResponse } from 'next/server';
import { aiChat, AutomationError, isAutomationConfigured } from '@/lib/automation-client';

const SYSTEM_PROMPTS = {
  generate: `You are an expert PLC programmer specializing in industrial automation.
Generate production-ready IEC 61131-3 compliant PLC code based on user requirements.
Output the code in Structured Text (ST) format unless specifically asked for Ladder Logic.`,
  explain: `You are an expert PLC code analyst. Analyze and explain PLC code clearly.`,
  test: `You are a PLC testing specialist. Generate comprehensive test cases for PLC programs.`,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, mode, images } = body;

    if (!prompt && (!images || images.length === 0)) {
      return NextResponse.json({ error: 'Prompt or images required' }, { status: 400 });
    }

    if (!isAutomationConfigured()) {
      return NextResponse.json({ error: 'Automation service not configured' }, { status: 500 });
    }

    const systemPrompt = SYSTEM_PROMPTS[mode as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.generate;
    const messageContent: unknown[] = [];

    if (images?.length > 0) {
      for (const image of images) {
        if (image.base64) {
          messageContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: image.mimeType || 'image/jpeg',
              data: image.base64,
            },
          });
        }
      }
    }

    messageContent.push({
      type: 'text',
      text: prompt || 'Please analyze the uploaded image(s) and generate appropriate PLC code.',
    });

    const response = await aiChat({
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }],
      maxTokens: 4096,
      model: process.env.CLAUDE_MODEL,
    });

    return NextResponse.json({
      success: true,
      response: response.text,
      mode,
      usage: response.usage,
    });
  } catch (error) {
    console.error('AI Co-Pilot Error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
