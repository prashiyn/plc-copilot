import { NextRequest, NextResponse } from 'next/server';
import { AutomationError, generateHmi, isAutomationConfigured } from '@/lib/automation-client';
import { createFileOperation, getProject, requireUser } from '@/lib/db/queries';
import { recordUsage } from '@/lib/usage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      vendor = 'siemens-wincc',
      screenType = 'process-overview',
      description,
      projectName,
      tags = [],
      projectId = null,
    } = body;

    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'Screen description is required' }, { status: 400 });
    }
    if (!projectName || typeof projectName !== 'string') {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    if (!isAutomationConfigured()) {
      return NextResponse.json({ error: 'Automation service not configured' }, { status: 500 });
    }

    const user = await requireUser();
    const scopedProjectId =
      typeof projectId === 'string' && projectId.trim() ? projectId.trim() : null;
    if (user && scopedProjectId) {
      const project = await getProject(user, scopedProjectId);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    const result = await generateHmi({
      vendor,
      screenType,
      description,
      projectName,
      tags: Array.isArray(tags) ? tags : [],
    });

    await recordUsage('hmi_generate', { vendor, screenType });
    if (user) {
      await createFileOperation(user, {
        projectId: scopedProjectId,
        operationType: 'hmi_generate',
        fileName: result.zipFileName,
        fileSize: Buffer.byteLength(result.contentBase64, 'base64'),
        mimeType: result.mimeType,
        metadata: {
          vendor,
          screenType,
          projectName,
          scriptFileName: result.scriptFileName,
        },
      });
    }

    const download = request.nextUrl.searchParams.get('download') === 'true';
    if (download) {
      const content = Buffer.from(result.contentBase64, 'base64');
      return new NextResponse(content, {
        headers: {
          'Content-Type': result.mimeType,
          'Content-Disposition': `attachment; filename="${result.zipFileName}"`,
        },
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('HMI generation error:', error);
    if (error instanceof AutomationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'HMI generation failed' }, { status: 500 });
  }
}
