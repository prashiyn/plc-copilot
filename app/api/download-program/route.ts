import { NextRequest, NextResponse } from 'next/server';
import { regeneratePlcDownload, type PlcDownloadParams } from '@/lib/plc-generation';
import { AutomationError } from '@/lib/automation-client';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PlcDownloadParams;

    if (!body.manufacturer || !body.controller || !body.projectName || !body.pattern || !body.logic) {
      return NextResponse.json({ error: 'Missing required download parameters' }, { status: 400 });
    }

    const file = await regeneratePlcDownload(body);

    return new NextResponse(new Uint8Array(file.content), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename="${file.fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error generating download:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate downloadable file' },
      { status: 500 },
    );
  }
}
