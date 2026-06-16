import { NextRequest, NextResponse } from 'next/server';
import { getModelWithContext, convertToLegacyFormat } from '@/lib/plc-models-database';
import { persistGeneratedProgramIfAuthed } from '@/lib/db/queries';
import { generatePlcProgramFile } from '@/lib/plc-generation';
import { AutomationError } from '@/lib/automation-client';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File | null;
    const logic = formData.get('logic') as string;
    const modelId = formData.get('modelId') as string;

    if (!logic || !modelId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const modelContext = getModelWithContext(modelId);
    if (!modelContext) {
      return NextResponse.json({ error: 'Invalid PLC model' }, { status: 400 });
    }

    const plcModel = convertToLegacyFormat(
      modelContext.manufacturer,
      modelContext.series,
      modelContext.model,
    );

    const generated = await generatePlcProgramFile({
      manufacturer: plcModel.manufacturer,
      controller: plcModel.model,
      logic,
      image: image && image.size > 0 ? image : null,
      useAiSynthesis: formData.get('useAiSynthesis') === 'true',
      synthesisMode:
        formData.get('synthesisMode') === 'arbitrary' ? 'arbitrary' : 'constrained',
    });

    await persistGeneratedProgramIfAuthed({
      programCode: generated.preview,
      programFormat: generated.extension,
      fileName: generated.fileName,
      generationParameters: {
        model: plcModel.model,
        manufacturer: plcModel.manufacturer,
        pattern: generated.pattern,
        ir: generated.ir ?? generated.metadata.ir,
        downloadParams: generated.downloadParams,
        exportTier: generated.metadata.tier ?? generated.downloadParams.exportTier,
        generationPath: generated.generationPath,
        tier2Disclaimer: generated.tier2Disclaimer,
        limitations: generated.limitations,
        useAiSynthesis: generated.downloadParams.useAiSynthesis,
        synthesisMode: generated.downloadParams.synthesisMode,
      },
    });

    return NextResponse.json({
      content: generated.preview,
      filename: generated.fileName,
      extension: generated.extension,
      model: plcModel.model,
      manufacturer: plcModel.manufacturer,
      pattern: generated.pattern,
      downloadParams: generated.downloadParams,
      generationPath: generated.generationPath,
      tier2Disclaimer: generated.tier2Disclaimer,
      limitations: generated.limitations,
    });
  } catch (error) {
    console.error('Error generating PLC program:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate program' },
      { status: 500 },
    );
  }
}
