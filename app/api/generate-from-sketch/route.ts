import { NextRequest, NextResponse } from 'next/server';
import { AutomationError, generateFromSketch } from '@/lib/automation-client';
import { buildSketchGenerateResponse } from '@/lib/sketch-generate-response';
import { recordUsage } from '@/lib/usage';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const platform = (formData.get('platform') as string) || 'schneider';
    const projectName = (formData.get('projectName') as string) || 'SketchProject';
    const controller = formData.get('controller') as string | null;
    const includeMetadata =
      formData.get('includeMetadata') === 'true' || formData.get('include_metadata') === 'true';

    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    const defaultControllers: Record<string, string> = {
      schneider: 'TM221CE24R',
      rockwell: '1769-L33ER',
      siemens: 'S7-1200',
      mitsubishi: 'FX5U',
    };

    const controllerModel = controller || defaultControllers[platform] || 'TM221CE24R';

    const generated = await generateFromSketch(
      imageFile,
      platform,
      projectName,
      controllerModel,
      { includeMetadata: true },
    );

    await recordUsage('sketch_generate', { platform, projectName });

    const response = buildSketchGenerateResponse(generated, includeMetadata);
    if (response.kind === 'json') {
      return NextResponse.json(response.body);
    }

    return new NextResponse(response.content, { headers: response.headers });
  } catch (error) {
    console.error('Sketch-to-PLC generation error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 },
    );
  }
}
