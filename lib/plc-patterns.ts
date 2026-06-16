/** Shared PLC pattern names — keep aligned with automation/api/schemas/programs.py */

export type PlcPattern =
  | 'motor_startstop'
  | 'sequential_lights'
  | 'estop_motor'
  | 'tank_level'
  | 'conveyor_startstop'
  | 'traffic_lights'
  | 'motor_interlock'
  | 'pump_staging'
  | 'timed_motor'
  | 'pid_loop';

export type SynthesisMode = 'constrained' | 'arbitrary';

/** Patterns the export pipeline supports on all vendors (Python EXPORT_PATTERNS). */
export const EXPORT_PATTERNS: readonly PlcPattern[] = [
  'motor_startstop',
  'sequential_lights',
  'estop_motor',
  'tank_level',
  'conveyor_startstop',
  'traffic_lights',
  'motor_interlock',
  'pump_staging',
  'timed_motor',
  'pid_loop',
] as const;

export interface PatternTiming {
  numLights: number;
  delaySeconds: number;
  cycleSeconds: number;
  runSeconds: number;
  setpoint: number;
}

export function isExportPattern(pattern: string): pattern is PlcPattern {
  return (EXPORT_PATTERNS as readonly string[]).includes(pattern);
}

export interface PatternSourcePayload {
  type: 'pattern';
  pattern: PlcPattern;
  numLights?: number;
  delaySeconds?: number;
  cycleSeconds?: number;
  runSeconds?: number;
  setpoint?: number;
}

export function buildPatternSource(pattern: PlcPattern, timing: PatternTiming): PatternSourcePayload {
  return {
    type: 'pattern',
    pattern,
    numLights: timing.numLights,
    delaySeconds: timing.delaySeconds,
    cycleSeconds: timing.cycleSeconds,
    runSeconds: timing.runSeconds,
    setpoint: timing.setpoint,
  };
}
