import { NextResponse } from 'next/server';
import { listProjectTemplates } from '@/lib/templates';

export async function GET() {
  const templates = listProjectTemplates().map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    pattern: template.pattern,
    defaultPlatform: template.defaultPlatform,
    defaultController: template.defaultController,
    industry: template.industry,
    complexity: template.complexity,
    logicDescription: template.logicDescription,
    generatorUrl: `/generator?template=${encodeURIComponent(template.id)}&platform=${template.defaultPlatform}&logic=${encodeURIComponent(template.logicDescription)}${template.setpoint != null ? `&setpoint=${template.setpoint}` : ''}`,
  }));

  return NextResponse.json({ templates });
}
