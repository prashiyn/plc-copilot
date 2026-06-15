import { NextRequest, NextResponse } from 'next/server';
import { aiChat, AutomationError, isAutomationConfigured } from '@/lib/automation-client';

const SYSTEM_PROMPT = `You are an expert PLC (Programmable Logic Controller) programming assistant specializing in industrial automation. You have deep expertise in:

- IEC 61131-3 programming languages (Ladder Logic, Structured Text, Function Block, Sequential Function Chart)
- Major PLC platforms: Schneider Electric (M221, M241, M251, M258), Siemens (S7-1200, S7-1500), Rockwell/Allen-Bradley, Mitsubishi
- Industrial control systems, sensors, actuators, and field devices
- Safety standards (IEC 61508, ISO 13849)
- HMI/SCADA integration
- Industrial networking (Modbus, Profibus, EtherNet/IP)

Your role:
1. GENERATE CODE: Create production-ready PLC programs in Ladder Logic or Structured Text
2. EXPLAIN CODE: Provide detailed explanations of PLC logic and control sequences
3. TEST & DEBUG: Generate comprehensive test cases and identify potential issues
4. OPTIMIZE: Suggest improvements for performance, safety, and maintainability

Be precise, professional, and safety-conscious in all responses.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, mode = 'generate', uploadedImages = [] } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }

    if (!isAutomationConfigured()) {
      return NextResponse.json({ error: 'Automation service not configured' }, { status: 500 });
    }

    const lastMessage = messages[messages.length - 1];
    const messageContent: unknown[] = [];

    if (uploadedImages?.length > 0) {
      for (const img of uploadedImages) {
        messageContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mediaType || 'image/jpeg',
            data: img.data,
          },
        });
      }
    }

    messageContent.push({ type: 'text', text: lastMessage.content });

    let modeSpecificPrompt = SYSTEM_PROMPT;
    if (mode === 'explain') {
      modeSpecificPrompt += '\n\nFOCUS: Provide detailed explanations of PLC code.';
    } else if (mode === 'test') {
      modeSpecificPrompt += '\n\nFOCUS: Generate comprehensive test cases.';
    } else {
      modeSpecificPrompt += '\n\nFOCUS: Generate production-ready PLC code.';
    }

    const response = await aiChat({
      system: modeSpecificPrompt,
      messages: [{ role: 'user', content: messageContent }],
      maxTokens: 4096,
    });

    return NextResponse.json({
      success: true,
      message: response.text,
      usage: response.usage,
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'AI chat failed' }, { status: 500 });
  }
}
