import { NextRequest, NextResponse } from 'next/server';
import { AutomationError, generateM221Program, isAutomationConfigured } from '@/lib/automation-client';
import { persistGeneratedProgramIfAuthed } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, plcModel, manufacturer, projectName } = body;

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    if (!isAutomationConfigured()) {
      return NextResponse.json(
        { error: 'Automation service not configured. Set AUTOMATION_API_URL and AUTOMATION_API_KEY.' },
        { status: 503 },
      );
    }

    const model = plcModel || 'TM221CE16T';
    const generated = await generateM221Program({
      description,
      plcModel: model,
      projectName: projectName || undefined,
    });

    await persistGeneratedProgramIfAuthed({
      programCode: generated.content,
      programFormat: '.smbp',
      fileName: generated.fileName,
      generationParameters: {
        model,
        manufacturer: manufacturer || 'Schneider Electric',
        aiGenerated: true,
        programData: generated.programData,
        ir: generated.ir ?? generated.metadata?.ir,
      },
    });

    return NextResponse.json({
      success: true,
      content: generated.content,
      filename: generated.fileName,
      extension: '.smbp',
      model,
      manufacturer: manufacturer || 'Schneider Electric',
      programData: generated.programData,
      ir: generated.ir ?? generated.metadata?.ir,
      aiGenerated: true,
    });
  } catch (error) {
    console.error('AI Generation Error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      {
        error: 'Failed to generate program with AI',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
