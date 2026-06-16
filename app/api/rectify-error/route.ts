import { NextRequest, NextResponse } from 'next/server';
import { rectifyError } from '@/lib/automation-client';
import { createErrorRectification, getProject, requireUser } from '@/lib/db/queries';
import { recordUsage } from '@/lib/usage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { programCode, platform, errorScreenshot, errorMessage, plcModel, projectId } = body;
    const user = await requireUser();
    const scopedProjectId =
      typeof projectId === 'string' && projectId.trim() ? projectId.trim() : null;
    if (user && scopedProjectId) {
      const project = await getProject(user, scopedProjectId);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    const result = await rectifyError({
      programCode,
      platform,
      errorMessage,
      plcModel,
      errorScreenshot,
    });
    await recordUsage('rectify_error', { platform });
    if (user) {
      const firstSolution = Array.isArray(result.solutions) ? result.solutions[0] : null;
      const correctedCode =
        firstSolution && typeof firstSolution === 'object' && 'correctedCode' in firstSolution
          ? String((firstSolution as { correctedCode?: string }).correctedCode ?? '')
          : null;
      const confidenceScore =
        firstSolution && typeof firstSolution === 'object' && 'confidence' in firstSolution
          ? Number((firstSolution as { confidence?: number }).confidence ?? NaN)
          : null;

      await createErrorRectification(user, {
        projectId: scopedProjectId,
        originalCode: programCode,
        errorMessage,
        errorScreenshotUrl: errorScreenshot ?? null,
        correctedCode,
        correctionApplied: Boolean(result.success),
        confidenceScore: Number.isFinite(confidenceScore) ? confidenceScore : null,
        metadata: {
          platform,
          plcModel,
          source: result.source,
          analysis: result.analysis,
          recommendations: result.recommendations,
          solutions: result.solutions,
        },
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing rectification request:', error);
    return NextResponse.json(
      { error: 'Failed to process error rectification request' },
      { status: 500 },
    );
  }
}
