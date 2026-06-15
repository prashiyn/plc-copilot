import {
  analyzeSketch,
  AutomationError,
  exportPlcopen,
  generateProgram,
  isAutomationConfigured,
} from '@/lib/automation-client';
import type { PlcProgram } from '@/lib/plc-ir/types';

export type PlcPattern =
  | 'motor_startstop'
  | 'sequential_lights'
  | 'estop_motor'
  | 'tank_level'
  | 'conveyor_startstop'
  | 'traffic_lights';
export type NativePlatform = 'schneider' | 'rockwell';
export type Tier2Platform = 'siemens' | 'mitsubishi';
export type GenerationPath = 'native' | 'tier2' | 'plcopen' | 'unsupported';

export interface PatternParams {
  pattern: PlcPattern;
  numLights: number;
  delaySeconds: number;
  cycleSeconds: number;
  projectName: string;
}

export interface PlcDownloadParams {
  manufacturer: string;
  controller: string;
  projectName: string;
  pattern: PlcPattern;
  numLights: number;
  delaySeconds: number;
  cycleSeconds: number;
  logic: string;
  useSketchAnalysis: boolean;
  sketchAnalysis?: Record<string, unknown>;
  exportTier?: number;
  tier2Platform?: Tier2Platform;
}

export interface GeneratedPlcFile {
  content: Buffer;
  fileName: string;
  mimeType: string;
  preview: string;
  extension: string;
  pattern: PlcPattern;
  metadata: Record<string, unknown>;
  ir?: PlcProgram;
  downloadParams: PlcDownloadParams;
  generationPath: GenerationPath;
  tier2Disclaimer?: string;
  limitations?: string[];
}

const MOTOR_LIKE_PATTERNS: PlcPattern[] = ['motor_startstop', 'estop_motor', 'conveyor_startstop'];

function isMotorLikePattern(pattern: PlcPattern): boolean {
  return MOTOR_LIKE_PATTERNS.includes(pattern);
}

export function detectPatternFromLogic(logic: string): PatternParams {
  const lower = logic.toLowerCase();
  const lightMatch = logic.match(/(\d+)\s+(?:sequential\s+)?lights?/i);
  const timeMatch = logic.match(/(\d+)\s+seconds?/i);
  const cycleMatch = logic.match(/(\d+)\s+second\s+cycle/i);
  const nameMatch = logic.match(/(?:project|program|name):\s*([^\n.]+)/i);

  let pattern: PlcPattern = 'motor_startstop';

  if (
    lower.includes('traffic light') ||
    lower.includes('traffic lights') ||
    lower.includes('red/yellow/green')
  ) {
    pattern = 'traffic_lights';
  } else if (
    lower.includes('tank') ||
    lower.includes('level control') ||
    lower.includes('fill pump') ||
    (lower.includes('level') && lower.includes('pump'))
  ) {
    pattern = 'tank_level';
  } else if (
    (lower.includes('e-stop') ||
      lower.includes('estop') ||
      lower.includes('e stop') ||
      lower.includes('emergency stop')) &&
    lower.includes('motor')
  ) {
    pattern = 'estop_motor';
  } else if (lower.includes('conveyor') || lower.includes('belt')) {
    pattern = 'conveyor_startstop';
  } else if (
    lightMatch ||
    lower.includes('sequential') ||
    (lower.includes('light') && !lower.includes('traffic') && !lower.includes('motor'))
  ) {
    pattern = 'sequential_lights';
  } else if (lower.includes('motor') || (lower.includes('start') && lower.includes('stop'))) {
    pattern = 'motor_startstop';
  }

  let cycleSeconds = 5;
  if (cycleMatch) {
    cycleSeconds = Math.min(60, Math.max(1, parseInt(cycleMatch[1], 10)));
  } else if (timeMatch && pattern === 'traffic_lights') {
    cycleSeconds = Math.min(60, Math.max(1, parseInt(timeMatch[1], 10)));
  }

  return {
    pattern,
    numLights: lightMatch ? Math.min(8, Math.max(2, parseInt(lightMatch[1], 10))) : 4,
    delaySeconds:
      timeMatch && pattern !== 'traffic_lights'
        ? Math.min(60, Math.max(1, parseInt(timeMatch[1], 10)))
        : 3,
    cycleSeconds,
    projectName: nameMatch
      ? nameMatch[1].trim().replace(/[^a-zA-Z0-9_]/g, '_')
      : 'PLCAutoProgram',
  };
}

export function resolveNativePlatform(manufacturer: string): NativePlatform | null {
  const m = manufacturer.toLowerCase();
  if (m.includes('schneider')) return 'schneider';
  if (m.includes('rockwell') || m.includes('allen-bradley')) return 'rockwell';
  return null;
}

export function resolveTier2Platform(manufacturer: string): Tier2Platform | null {
  const m = manufacturer.toLowerCase();
  if (m.includes('siemens')) return 'siemens';
  if (m.includes('mitsubishi')) return 'mitsubishi';
  return null;
}

export function resolvePlcopenPlatform(manufacturer: string): string {
  const m = manufacturer.toLowerCase();
  if (m.includes('siemens')) return 'siemens';
  if (m.includes('mitsubishi')) return 'mitsubishi';
  if (m.includes('codesys')) return 'codesys';
  if (m.includes('rockwell') || m.includes('allen-bradley')) return 'rockwell';
  if (m.includes('schneider')) return 'universal';
  return 'universal';
}

export function resolveGenerationPath(manufacturer: string, pattern: PlcPattern): GenerationPath {
  if (resolveNativePlatform(manufacturer)) {
    return 'native';
  }
  if (resolveTier2Platform(manufacturer)) {
    return isMotorLikePattern(pattern) ? 'tier2' : 'unsupported';
  }
  return isMotorLikePattern(pattern) ? 'plcopen' : 'unsupported';
}

export function tier2SourceImportDisclaimer(platform: Tier2Platform): string {
  if (platform === 'siemens') {
    return 'Source import only — this .scl file is not a TIA Portal project (.ap* / .zap*). Import the organization block manually in TIA Portal.';
  }
  return 'Source import only — this ZIP contains IL, ST, and device-comment CSV files, not a native GX Works project (.gxw / .gx3). Extract and import manually in GX Works.';
}

export function defaultTier2Controller(platform: Tier2Platform): string {
  return platform === 'siemens' ? 'S7-1200' : 'FX5U';
}

export function previewFileContent(content: Buffer, mimeType: string): string {
  if (mimeType.includes('xml') || mimeType.includes('text')) {
    return content.toString('utf-8');
  }
  if (content.length >= 2 && content[0] === 0x50 && content[1] === 0x4b) {
    return `[Valid .smbp project archive — ${content.length} bytes. Use Download to save and open in EcoStruxure Machine Expert.]`;
  }
  if (content.length >= 5 && content.subarray(0, 5).toString('utf-8') === '<?xml') {
    return content.toString('utf-8');
  }
  return `[Binary PLC program file — ${content.length} bytes. Use Download to save.]`;
}

export function buildProgramPreview(
  content: Buffer,
  mimeType: string,
  metadata: Record<string, unknown>,
): string {
  const format = typeof metadata.format === 'string' ? metadata.format : '';
  if (metadata.tier === 2 && format === 'mitsubishi_tier2_zip') {
    const files = Array.isArray(metadata.files) ? metadata.files.join(', ') : 'IL, ST, CSV';
    return `[Mitsubishi Tier-2 source import ZIP — ${content.length} bytes. Contains: ${files}. Download, extract, and import manually in GX Works.]`;
  }
  if (metadata.tier === 2 && format === 'scl') {
    return content.toString('utf-8');
  }
  if (mimeType === 'application/zip') {
    const files = Array.isArray(metadata.files) ? metadata.files.join(', ') : 'program files';
    return `[Tier-2 source import ZIP — ${content.length} bytes. Contains: ${files}. Download and extract before importing in your PLC engineering tool.]`;
  }
  return previewFileContent(content, mimeType);
}

function extensionFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot) : '.plc';
}

function tier2Limitations(metadata: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(metadata.limitations)) {
    return undefined;
  }
  return metadata.limitations.filter((item): item is string => typeof item === 'string');
}

function unsupportedPatternError(manufacturer: string, pattern: PlcPattern): AutomationError {
  const tier2 = resolveTier2Platform(manufacturer);
  if (tier2) {
    return new AutomationError(
      'Tank level, traffic lights, and sequential patterns are available for Schneider and Rockwell PLCs. For Siemens or Mitsubishi, describe a motor, E-stop motor, or conveyor start/stop circuit to receive a Tier-2 source import (.scl or IL/ST/CSV ZIP).',
      'UNSUPPORTED_PLATFORM_PATTERN',
      422,
    );
  }
  return new AutomationError(
    'Tank level, traffic lights, and sequential patterns are available for Schneider and Rockwell PLCs. Select one of those manufacturers, or describe a motor, E-stop motor, or conveyor start/stop circuit for PLCopen export.',
    'UNSUPPORTED_PLATFORM_PATTERN',
    422,
  );
}

export async function generatePlcProgramFile(params: {
  manufacturer: string;
  controller: string;
  logic: string;
  projectName?: string;
  image?: File | null;
  /** When re-downloading, reuse prior analysis instead of re-analyzing the image. */
  downloadParams?: Partial<PlcDownloadParams>;
}): Promise<GeneratedPlcFile> {
  if (!isAutomationConfigured()) {
    throw new AutomationError(
      'Automation service not configured (AUTOMATION_API_URL / AUTOMATION_API_KEY)',
      'CONFIG_ERROR',
      503,
    );
  }

  const patternParams = detectPatternFromLogic(params.logic);
  const projectName = params.downloadParams?.projectName || params.projectName || patternParams.projectName;
  const pattern = params.downloadParams?.pattern || patternParams.pattern;
  const numLights = params.downloadParams?.numLights ?? patternParams.numLights;
  const delaySeconds = params.downloadParams?.delaySeconds ?? patternParams.delaySeconds;
  const cycleSeconds = params.downloadParams?.cycleSeconds ?? patternParams.cycleSeconds;
  const native = resolveNativePlatform(params.manufacturer);
  const tier2 = resolveTier2Platform(params.manufacturer);
  const generationPath = resolveGenerationPath(params.manufacturer, pattern);

  if (generationPath === 'unsupported') {
    throw unsupportedPatternError(params.manufacturer, pattern);
  }

  let sketchAnalysis = params.downloadParams?.sketchAnalysis;
  if (!sketchAnalysis && params.image && native) {
    const analysisResult = await analyzeSketch(params.image, native);
    if (analysisResult.analysis && typeof analysisResult.analysis === 'object') {
      sketchAnalysis = analysisResult.analysis as Record<string, unknown>;
    }
  }

  const downloadParams: PlcDownloadParams = {
    manufacturer: params.manufacturer,
    controller: params.controller,
    projectName,
    pattern,
    numLights,
    delaySeconds,
    cycleSeconds,
    logic: params.logic,
    useSketchAnalysis: !!sketchAnalysis,
    sketchAnalysis,
    exportTier: generationPath === 'tier2' ? 2 : undefined,
    tier2Platform: tier2 ?? undefined,
  };

  if (generationPath === 'native' && native) {
    const source = sketchAnalysis
      ? { type: 'sketch_analysis' as const, analysis: sketchAnalysis }
      : {
          type: 'pattern' as const,
          pattern,
          numLights,
          delaySeconds,
          cycleSeconds,
        };

    const result = await generateProgram({
      platform: native,
      controller: params.controller,
      projectName,
      source,
    });

    return {
      content: result.content,
      fileName: result.fileName,
      mimeType: result.mimeType,
      preview: buildProgramPreview(result.content, result.mimeType, result.metadata),
      extension: extensionFromFileName(result.fileName),
      pattern,
      metadata: result.metadata,
      ir: result.metadata.ir as PlcProgram | undefined,
      downloadParams,
      generationPath: 'native',
    };
  }

  if (generationPath === 'tier2' && tier2) {
    const tier2Pattern = isMotorLikePattern(pattern) ? pattern : 'motor_startstop';
    const result = await generateProgram({
      platform: tier2,
      controller: params.controller || defaultTier2Controller(tier2),
      projectName,
      source: {
        type: 'pattern',
        pattern: tier2Pattern,
      },
    });

    const limitations = tier2Limitations(result.metadata);

    return {
      content: result.content,
      fileName: result.fileName,
      mimeType: result.mimeType,
      preview: buildProgramPreview(result.content, result.mimeType, result.metadata),
      extension: extensionFromFileName(result.fileName),
      pattern: tier2Pattern,
      metadata: result.metadata,
      ir: result.metadata.ir as PlcProgram | undefined,
      downloadParams,
      generationPath: 'tier2',
      tier2Disclaimer: tier2SourceImportDisclaimer(tier2),
      limitations,
    };
  }

  const result = await exportPlcopen({
    name: projectName,
    platform: resolvePlcopenPlatform(params.manufacturer),
    pattern: 'motor_startstop',
    controller: params.controller,
  });

  return {
    content: result.content,
    fileName: result.fileName,
    mimeType: result.mimeType,
    preview: buildProgramPreview(result.content, result.mimeType, result.metadata),
    extension: extensionFromFileName(result.fileName),
    pattern: 'motor_startstop',
    metadata: result.metadata,
    ir: result.metadata.ir as PlcProgram | undefined,
    downloadParams,
    generationPath: 'plcopen',
  };
}

export async function regeneratePlcDownload(params: PlcDownloadParams): Promise<{
  content: Buffer;
  fileName: string;
  mimeType: string;
}> {
  const generated = await generatePlcProgramFile({
    manufacturer: params.manufacturer,
    controller: params.controller,
    logic: params.logic,
    projectName: params.projectName,
    downloadParams: params,
  });
  return {
    content: generated.content,
    fileName: generated.fileName,
    mimeType: generated.mimeType,
  };
}
