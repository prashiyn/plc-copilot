import { NextRequest, NextResponse } from 'next/server';
import { recommendPlc } from '@/lib/automation-client';
import { createPlcRecommendation, getProject, requireUser } from '@/lib/db/queries';
import { recordUsage } from '@/lib/usage';

export async function POST(req: NextRequest) {
  try {
    const requirements = await req.json();
    const user = await requireUser();
    const scopedProjectId =
      typeof requirements?.projectId === 'string' && requirements.projectId.trim()
        ? requirements.projectId.trim()
        : null;
    if (user && scopedProjectId) {
      const project = await getProject(user, scopedProjectId);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    const result = await recommendPlc(requirements);
    await recordUsage('recommend_plc');
    if (user) {
      await createPlcRecommendation(user, {
        projectId: scopedProjectId,
        requirements,
        recommendedPlcs: result.recommendations,
        selectedPlc: result.recommendations[0] ?? null,
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error generating PLC recommendations:', error);
    return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 });
  }
}
