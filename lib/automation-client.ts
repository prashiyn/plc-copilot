/**
 * HTTP client for the FastAPI automation service.
 * All Anthropic and PLC file operations go through this client (no child_process).
 */

import type {
  IrJsonSchemaResponse,
  IrPatternInfo,
  IrPatternName,
  IrSerializeResult,
  IrValidationResult,
  PlcProgram,
} from '@/lib/plc-ir/types';

const DEFAULT_TIMEOUT_MS = 300_000;
const POLL_INTERVAL_MS = 1_000;

export class AutomationError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
    this.name = 'AutomationError';
  }

  static async fromResponse(res: Response): Promise<AutomationError> {
    let body: { error?: { code?: string; message?: string } } = {};
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    return new AutomationError(
      body.error?.message || res.statusText || 'Automation service error',
      body.error?.code || 'AUTOMATION_ERROR',
      res.status,
    );
  }
}

export interface AutomationJob {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'unknown';
  result?: unknown;
  error?: { code: string; message: string; details?: Record<string, unknown> };
  createdAt?: string;
  updatedAt?: string;
}

function baseUrl(): string {
  const url = process.env.AUTOMATION_API_URL;
  if (!url) throw new AutomationError('AUTOMATION_API_URL not configured', 'CONFIG_ERROR', 503);
  return url.replace(/\/$/, '');
}

function authHeaders(): HeadersInit {
  const key = process.env.AUTOMATION_API_KEY;
  if (!key) throw new AutomationError('AUTOMATION_API_KEY not configured', 'CONFIG_ERROR', 503);
  return { Authorization: `Bearer ${key}` };
}

function timeoutMs(): number {
  return Number(process.env.AUTOMATION_REQUEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
}

async function automationFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    return await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init.headers as Record<string, string>) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function getJob(jobId: string): Promise<AutomationJob> {
  const res = await automationFetch(`/v1/jobs/${jobId}`);
  if (!res.ok) throw await AutomationError.fromResponse(res);
  return res.json();
}

export async function waitForJob<T = unknown>(jobId: string): Promise<T> {
  const deadline = Date.now() + timeoutMs();
  while (Date.now() < deadline) {
    const job = await getJob(jobId);
    if (job.status === 'completed') return job.result as T;
    if (job.status === 'failed') {
      throw new AutomationError(
        job.error?.message || 'Job failed',
        job.error?.code || 'JOB_FAILED',
        500,
      );
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new AutomationError('Job timed out', 'JOB_TIMEOUT', 504);
}

async function enqueueAndWait<T>(path: string, init: RequestInit): Promise<T> {
  const res = await automationFetch(path, init);
  if (res.status !== 202) {
    if (!res.ok) throw await AutomationError.fromResponse(res);
  }
  const { jobId } = (await res.json()) as { jobId: string };
  return waitForJob<T>(jobId);
}

export async function analyzeSketch(image: File, platform: string): Promise<{
  success: boolean;
  summary?: string;
  platform: string;
  analysis?: unknown;
  confidence?: number;
}> {
  const form = new FormData();
  form.append('image', image);
  form.append('platform', platform);
  const result = await enqueueAndWait<{
    summary: string;
    analysis: unknown;
    confidence: number;
    platform: string;
  }>('/v1/sketches/analyze', { method: 'POST', body: form });
  return { success: true, ...result };
}

export async function generateFromSketch(
  image: File,
  platform: string,
  projectName: string,
  controller: string,
  options?: { includeMetadata?: boolean },
): Promise<{
  content: Buffer;
  fileName: string;
  mimeType: string;
  metadata?: Record<string, unknown>;
  ir?: PlcProgram;
}> {
  const form = new FormData();
  form.append('image', image);
  form.append('platform', platform);
  form.append('project_name', projectName);
  form.append('controller', controller);
  if (options?.includeMetadata) {
    form.append('include_metadata', 'true');
  }
  const result = await enqueueAndWait<{
    contentBase64: string;
    fileName: string;
    mimeType: string;
    metadata?: Record<string, unknown>;
  }>('/v1/sketches/generate', { method: 'POST', body: form });
  const metadata = result.metadata;
  return {
    content: Buffer.from(result.contentBase64, 'base64'),
    fileName: result.fileName,
    mimeType: result.mimeType,
    metadata,
    ir: metadata?.ir as PlcProgram | undefined,
  };
}

export async function aiChat(params: {
  system?: string;
  messages: Array<{ role: string; content: string | unknown[] }>;
  maxTokens?: number;
  model?: string;
}): Promise<{ text: string; usage?: { input_tokens: number; output_tokens: number } }> {
  return enqueueAndWait('/v1/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: params.system,
      messages: params.messages,
      maxTokens: params.maxTokens ?? 4096,
      model: params.model,
    }),
  });
}

export async function aiJson(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<unknown> {
  const result = await enqueueAndWait<{ data: unknown }>('/v1/ai/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: params.system,
      prompt: params.prompt,
      maxTokens: params.maxTokens ?? 3072,
      model: params.model,
    }),
  });
  return result.data;
}

export async function recommendPlc(requirements: Record<string, unknown>): Promise<{
  recommendations: unknown[];
  source: 'ai' | 'fallback';
}> {
  return enqueueAndWait('/v1/ai/recommend-plc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requirements),
  });
}

export async function recommendSolution(params: {
  projectDescription: string;
  criteria?: string;
  constraints?: Record<string, unknown>;
}): Promise<{
  recommended: unknown;
  alternatives: unknown[];
  comparison: Record<string, unknown>;
  source: 'ai' | 'fallback';
}> {
  return enqueueAndWait('/v1/ai/recommend-solution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function rectifyError(params: {
  programCode: string;
  platform: string;
  errorMessage: string;
  plcModel: string;
  errorScreenshot?: string;
}): Promise<{
  success: boolean;
  analysis: Record<string, unknown>;
  solutions: unknown[];
  recommendations: string[];
  source: 'ai' | 'fallback';
}> {
  return enqueueAndWait('/v1/ai/rectify-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function generateM221ProgramJson(
  description: string,
  plcModel: string,
): Promise<string> {
  const result = await enqueueAndWait<{ json: string }>('/v1/ai/m221/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, plcModel }),
  });
  return result.json;
}

export interface M221GenerateResult {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  programData: Record<string, unknown>;
  metadata: Record<string, unknown>;
  ir?: Record<string, unknown>;
}

/** Full AI pipeline: Claude IR in Python + Calaos .smbp serialization in Python. */
export async function generateM221Program(params: {
  description: string;
  plcModel: string;
  projectName?: string;
}): Promise<{
  content: string;
  fileName: string;
  mimeType: string;
  programData: Record<string, unknown>;
  metadata: Record<string, unknown>;
  ir?: Record<string, unknown>;
}> {
  const result = await enqueueAndWait<M221GenerateResult>('/v1/programs/m221/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: params.description,
      plcModel: params.plcModel,
      projectName: params.projectName,
    }),
  });
  return {
    content: Buffer.from(result.contentBase64, 'base64').toString('utf-8'),
    fileName: result.fileName,
    mimeType: result.mimeType,
    programData: result.programData,
    metadata: result.metadata ?? {},
    ir: (result.metadata?.ir as Record<string, unknown> | undefined) ?? result.ir,
  };
}

export async function buildM221Program(params: {
  programData: Record<string, unknown>;
  plcModel: string;
  projectName?: string;
}): Promise<{
  content: string;
  fileName: string;
  mimeType: string;
  programData: Record<string, unknown>;
}> {
  const result = await enqueueAndWait<M221GenerateResult>('/v1/programs/m221/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return {
    content: Buffer.from(result.contentBase64, 'base64').toString('utf-8'),
    fileName: result.fileName,
    mimeType: result.mimeType,
    programData: result.programData,
  };
}

export interface ProgramFileResult {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  metadata: Record<string, unknown>;
}

export interface ProgramParseResult {
  platform: string;
  format: string;
  project: Record<string, unknown>;
  summary: string;
}

export async function generateProgram(params: {
  platform: 'schneider' | 'rockwell' | 'siemens' | 'mitsubishi';
  controller?: string;
  projectName: string;
  source:
    | { type: 'pattern'; pattern: 'motor_startstop' | 'sequential_lights'; numLights?: number; delaySeconds?: number }
    | { type: 'sketch_analysis'; analysis: Record<string, unknown> }
    | { type: 'claude_ir'; description: string };
}): Promise<{ content: Buffer; fileName: string; mimeType: string; metadata: Record<string, unknown> }> {
  const result = await enqueueAndWait<ProgramFileResult>('/v1/programs/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: params.platform,
      controller: params.controller,
      projectName: params.projectName,
      source: params.source,
    }),
  });
  return {
    content: Buffer.from(result.contentBase64, 'base64'),
    fileName: result.fileName,
    mimeType: result.mimeType,
    metadata: result.metadata,
  };
}

export async function generateProgramFromDescription(params: {
  platform: 'schneider' | 'rockwell' | 'siemens' | 'mitsubishi';
  controller?: string;
  projectName: string;
  description: string;
}): Promise<{ content: Buffer; fileName: string; mimeType: string; metadata: Record<string, unknown> }> {
  return generateProgram({
    platform: params.platform,
    controller: params.controller,
    projectName: params.projectName,
    source: { type: 'claude_ir', description: params.description },
  });
}

export async function exportPlcopen(params: {
  name: string;
  platform?: string;
  pattern?: 'motor_startstop' | 'sequential_lights';
  controller?: string;
}): Promise<{ content: Buffer; fileName: string; mimeType: string; metadata: Record<string, unknown> }> {
  const result = await enqueueAndWait<ProgramFileResult>('/v1/programs/plcopen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return {
    content: Buffer.from(result.contentBase64, 'base64'),
    fileName: result.fileName,
    mimeType: result.mimeType,
    metadata: result.metadata,
  };
}

export async function parseProgram(file: File): Promise<ProgramParseResult> {
  const form = new FormData();
  form.append('file', file);
  return enqueueAndWait<ProgramParseResult>('/v1/programs/parse', { method: 'POST', body: form });
}

export async function listIrPatterns(): Promise<IrPatternInfo[]> {
  const res = await fetch(`${baseUrl()}/v1/ir/patterns`, { headers: authHeaders() });
  if (!res.ok) throw await AutomationError.fromResponse(res);
  const body = (await res.json()) as { patterns: IrPatternInfo[] };
  return body.patterns;
}

export async function getIrJsonSchema(): Promise<IrJsonSchemaResponse> {
  const res = await fetch(`${baseUrl()}/v1/ir/schema`, { headers: authHeaders() });
  if (!res.ok) throw await AutomationError.fromResponse(res);
  return res.json();
}

export async function getIrPattern(
  pattern: IrPatternName,
  params: {
    projectName?: string;
    vendor?: string;
    model?: string;
    numLights?: number;
    delaySeconds?: number;
  } = {},
): Promise<{ program: PlcProgram; summary: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl()}/v1/ir/patterns/${pattern}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectName: params.projectName ?? 'MotorControl',
      vendor: params.vendor ?? 'schneider',
      model: params.model ?? 'TM221CE24R',
      numLights: params.numLights ?? 4,
      delaySeconds: params.delaySeconds ?? 3,
    }),
  });
  if (!res.ok) throw await AutomationError.fromResponse(res);
  return res.json();
}

export async function validateIrProgram(program: PlcProgram): Promise<IrValidationResult> {
  const res = await fetch(`${baseUrl()}/v1/ir/validate`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ program }),
  });
  if (!res.ok) throw await AutomationError.fromResponse(res);
  return res.json();
}

export async function serializeIrProgram(program: PlcProgram): Promise<{
  content: Buffer;
  fileName: string;
  mimeType: string;
  program: PlcProgram;
  summary: Record<string, unknown>;
  metadata: Record<string, unknown>;
}> {
  const result = await enqueueAndWait<IrSerializeResult>('/v1/ir/serialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ program }),
  });
  return {
    content: Buffer.from(result.contentBase64, 'base64'),
    fileName: result.fileName,
    mimeType: result.mimeType,
    program: result.program,
    summary: result.summary,
    metadata: result.metadata,
  };
}

export async function roundtripIrProgram(program: PlcProgram): Promise<IrSerializeResult> {
  return enqueueAndWait<IrSerializeResult>('/v1/ir/roundtrip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ program }),
  });
}

export function isAutomationConfigured(): boolean {
  return !!(process.env.AUTOMATION_API_URL && process.env.AUTOMATION_API_KEY);
}
