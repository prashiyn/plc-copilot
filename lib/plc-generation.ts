import {
  analyzeSketch,
  AutomationError,
  exportPlcopen,
  generateProgram,
  isAutomationConfigured,
} from '@/lib/automation-client';
import type { PlcProgram } from '@/lib/plc-ir/types';
import {
  buildPatternSource,
  type PatternTiming,
  type PlcPattern,
  type SynthesisMode,
  isExportPattern,
} from '@/lib/plc-patterns';

export type { PlcPattern, SynthesisMode } from '@/lib/plc-patterns';
export type NativePlatform = 'schneider' | 'rockwell';
export type Tier2Platform = 'siemens' | 'mitsubishi';
export type GenerationPath = 'native' | 'tier2' | 'plcopen' | 'claude_ir';
export type ResolvedGenerationPath = GenerationPath | 'unsupported';

export interface PatternParams extends PatternTiming {
  pattern: PlcPattern;
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
  runSeconds: number;
  logic: string;
  useSketchAnalysis: boolean;
  sketchAnalysis?: Record<string, unknown>;
  exportTier?: number;
  tier2Platform?: Tier2Platform;
  useAiSynthesis?: boolean;
  synthesisMode?: SynthesisMode;
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
    (lower.includes('lead') || lower.includes('lag') || lower.includes('staging')) &&
    lower.includes('pump')
  ) {
    pattern = 'pump_staging';
  } else if (
    (lower.includes('interlock') ||
      lower.includes('mutual exclusion') ||
      lower.includes('mutual-exclusion')) &&
    (lower.includes('motor') || lower.includes('dual'))
  ) {
    pattern = 'motor_interlock';
  } else if (
    (lower.includes('timed') ||
      lower.includes('timer') ||
      lower.includes('delay') ||
      lower.includes('on-delay')) &&
    lower.includes('motor')
  ) {
    pattern = 'timed_motor';
  } else if (
    lower.includes('tank') ||
    lower.includes('level control') ||
    lower.includes('fill pump') ||
    (lower.includes('level') && lower.includes('pump') && !lower.includes('staging'))
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

  let runSeconds = 5;
  if (timeMatch && pattern === 'timed_motor') {
    runSeconds = Math.min(60, Math.max(1, parseInt(timeMatch[1], 10)));
  }

  const delaySeconds =
    timeMatch && pattern !== 'traffic_lights' && pattern !== 'timed_motor'
      ? Math.min(60, Math.max(1, parseInt(timeMatch[1], 10)))
      : 3;

  return {
    pattern,
    numLights: lightMatch ? Math.min(8, Math.max(2, parseInt(lightMatch[1], 10))) : 4,
    delaySeconds,
    cycleSeconds,
    runSeconds,
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

export function resolveGenerationPath(
  manufacturer: string,
  pattern: PlcPattern,
  options?: { useAiSynthesis?: boolean },
): ResolvedGenerationPath {
  if (options?.useAiSynthesis) {
    if (resolveNativePlatform(manufacturer) || resolveTier2Platform(manufacturer)) {
      return 'claude_ir';
    }
    return 'unsupported';
  }
  if (!isExportPattern(pattern)) {
    return 'unsupported';
  }
  if (resolveNativePlatform(manufacturer)) {
    return 'native';
  }
  if (resolveTier2Platform(manufacturer)) {
    return 'tier2';
  }
  return 'plcopen';
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

function unsupportedPathError(manufacturer: string, useAiSynthesis: boolean): AutomationError {
  if (useAiSynthesis) {
    return new AutomationError(
      'Claude IR synthesis requires Schneider, Rockwell, Siemens, or Mitsubishi as the PLC manufacturer.',
      'UNSUPPORTED_PLATFORM',
      422,
    );
  }
  return new AutomationError(
    `Could not resolve an export path for manufacturer "${manufacturer}".`,
    'UNSUPPORTED_PLATFORM',
    422,
  );
}

function patternTimingFromParams(
  pattern: PlcPattern,
  numLights: number,
  delaySeconds: number,
  cycleSeconds: number,
  runSeconds: number,
): PatternTiming {
  return { numLights, delaySeconds, cycleSeconds, runSeconds };
}

function fileFromProgramResult(
  result: { content: Buffer; fileName: string; mimeType: string; metadata: Record<string, unknown> },
  pattern: PlcPattern,
  downloadParams: PlcDownloadParams,
  generationPath: GenerationPath,
  tier2Disclaimer?: string,
  limitations?: string[],
): GeneratedPlcFile {
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
    generationPath,
    tier2Disclaimer,
    limitations,
  };
}

export async function generatePlcProgramFile(params: {
  manufacturer: string;
  controller: string;
  logic: string;
  projectName?: string;
  image?: File | null;
  useAiSynthesis?: boolean;
  synthesisMode?: SynthesisMode;
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
  const useAiSynthesis = params.downloadParams?.useAiSynthesis ?? params.useAiSynthesis ?? false;
  const synthesisMode = params.downloadParams?.synthesisMode ?? params.synthesisMode ?? 'constrained';
  const projectName =
    params.downloadParams?.projectName || params.projectName || patternParams.projectName;
  const pattern = params.downloadParams?.pattern || patternParams.pattern;
  const numLights = params.downloadParams?.numLights ?? patternParams.numLights;
  const delaySeconds = params.downloadParams?.delaySeconds ?? patternParams.delaySeconds;
  const cycleSeconds = params.downloadParams?.cycleSeconds ?? patternParams.cycleSeconds;
  const runSeconds = params.downloadParams?.runSeconds ?? patternParams.runSeconds;
  const native = resolveNativePlatform(params.manufacturer);
  const tier2 = resolveTier2Platform(params.manufacturer);
  const generationPath = resolveGenerationPath(params.manufacturer, pattern, { useAiSynthesis });

  if (generationPath === 'unsupported') {
    throw unsupportedPathError(params.manufacturer, useAiSynthesis);
  }

  const sketchPlatform = native ?? tier2;
  let sketchAnalysis = params.downloadParams?.sketchAnalysis;
  if (!sketchAnalysis && params.image && sketchPlatform) {
    const analysisResult = await analyzeSketch(params.image, sketchPlatform);
    if (analysisResult.analysis && typeof analysisResult.analysis === 'object') {
      sketchAnalysis = analysisResult.analysis as Record<string, unknown>;
    }
  }

  const timing = patternTimingFromParams(pattern, numLights, delaySeconds, cycleSeconds, runSeconds);
  const downloadParams: PlcDownloadParams = {
    manufacturer: params.manufacturer,
    controller: params.controller,
    projectName,
    pattern,
    numLights,
    delaySeconds,
    cycleSeconds,
    runSeconds,
    logic: params.logic,
    useSketchAnalysis: !!sketchAnalysis,
    sketchAnalysis,
    exportTier: generationPath === 'tier2' ? 2 : undefined,
    tier2Platform: tier2 ?? undefined,
    useAiSynthesis,
    synthesisMode: useAiSynthesis ? synthesisMode : undefined,
  };

  if (generationPath === 'claude_ir') {
    const platform = native ?? tier2;
    if (!platform) {
      throw unsupportedPathError(params.manufacturer, true);
    }
    const result = await generateProgram({
      platform,
      controller: params.controller || (tier2 ? defaultTier2Controller(tier2) : undefined),
      projectName,
      source: {
        type: 'claude_ir',
        description: params.logic,
        synthesisMode,
      },
    });
    const irPattern =
      typeof result.metadata.irPattern === 'string' && isExportPattern(result.metadata.irPattern)
        ? result.metadata.irPattern
        : pattern;
    return fileFromProgramResult(result, irPattern, downloadParams, 'claude_ir');
  }

  if (generationPath === 'native' && native) {
    const source = sketchAnalysis
      ? { type: 'sketch_analysis' as const, analysis: sketchAnalysis }
      : buildPatternSource(pattern, timing);

    const result = await generateProgram({
      platform: native,
      controller: params.controller,
      projectName,
      source,
    });

    return fileFromProgramResult(result, pattern, downloadParams, 'native');
  }

  if (generationPath === 'tier2' && tier2) {
    const source = sketchAnalysis
      ? { type: 'sketch_analysis' as const, analysis: sketchAnalysis }
      : buildPatternSource(pattern, timing);

    const result = await generateProgram({
      platform: tier2,
      controller: params.controller || defaultTier2Controller(tier2),
      projectName,
      source,
    });

    const limitations = tier2Limitations(result.metadata);
    return fileFromProgramResult(
      result,
      pattern,
      downloadParams,
      'tier2',
      tier2SourceImportDisclaimer(tier2),
      limitations,
    );
  }

  const result = await exportPlcopen({
    name: projectName,
    platform: resolvePlcopenPlatform(params.manufacturer),
    pattern,
    controller: params.controller,
    numLights,
    delaySeconds,
    cycleSeconds,
    runSeconds,
  });

  return fileFromProgramResult(result, pattern, downloadParams, 'plcopen');
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
    useAiSynthesis: params.useAiSynthesis,
    synthesisMode: params.synthesisMode,
    downloadParams: params,
  });
  return {
    content: generated.content,
    fileName: generated.fileName,
    mimeType: generated.mimeType,
  };
}
