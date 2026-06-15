import { NextRequest, NextResponse } from 'next/server';
import { analyzeSketch, AutomationError } from '@/lib/automation-client';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const platform = (formData.get('platform') as string) || 'schneider';

    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    const result = await analyzeSketch(imageFile, platform);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Sketch analysis error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 },
    );
  }
}
