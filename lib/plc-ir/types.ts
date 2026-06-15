export type PlcDataType =
  | 'BOOL'
  | 'INT'
  | 'DINT'
  | 'REAL'
  | 'TIME'
  | 'TON'
  | 'TOF'
  | 'TP'
  | 'CTU'
  | 'CTD'
  | 'CTUD';
export type PlcVarKind = 'input' | 'output' | 'memory' | 'timer' | 'counter';
export type PouLanguage = 'LD' | 'ST' | 'IL' | 'FBD';
export type IrPatternName =
  | 'motor_startstop'
  | 'sequential_lights'
  | 'estop_motor'
  | 'tank_level'
  | 'conveyor_startstop'
  | 'traffic_lights';
export type TimerType = 'TON' | 'TOF' | 'TP';
export type CounterType = 'CTU' | 'CTD' | 'CTUD';
export type EstopSymbolName = 'ESTOP_BTN' | 'E_STOP' | 'EMERGENCY_STOP';

export type PlcVendor =
  | 'schneider'
  | 'rockwell'
  | 'siemens'
  | 'mitsubishi'
  | 'codesys'
  | 'generic';

export interface PlcTarget {
  vendor: PlcVendor;
  model: string;
}

export interface PlcMeta {
  author?: string;
  description?: string;
  createdAt?: string;
  pattern?: IrPatternName;
  patternParams?: Record<string, number | string | boolean>;
  requireEstop?: boolean;
}

export interface PlcVar {
  symbol: string;
  address?: string;
  dataType?: PlcDataType;
  kind: PlcVarKind;
  initial?: string;
  comment?: string;
}

export interface ContactNode {
  type: 'contact';
  symbol: string;
  negated?: boolean;
}

export interface CoilNode {
  type: 'coil';
  symbol: string;
  coilType?: 'normal' | 'set' | 'reset';
}

export interface AndNode {
  type: 'and';
  inputs: LogicNode[];
}

export interface OrNode {
  type: 'or';
  inputs: LogicNode[];
}

export interface NotNode {
  type: 'not';
  input: LogicNode;
}

export interface TimerNode {
  type: 'timer';
  symbol: string;
  timerType?: TimerType;
  presetMs?: number;
}

export interface CounterNode {
  type: 'counter';
  symbol: string;
  counterType?: CounterType;
  preset?: number;
}

export type LogicNode =
  | ContactNode
  | CoilNode
  | AndNode
  | OrNode
  | NotNode
  | TimerNode
  | CounterNode;

export interface Network {
  label?: string;
  comment?: string;
  logic: LogicNode;
}

export interface Pou {
  name: string;
  language?: PouLanguage;
  networks: Network[];
}

export interface PlcProgram {
  name: string;
  target: PlcTarget;
  vars: PlcVar[];
  pous: Pou[];
  meta?: PlcMeta;
}

export interface IrPatternInfo {
  id: IrPatternName;
  title: string;
  description: string;
  vendors: string[];
}

export interface IrValidationResult {
  valid: boolean;
  summary: Record<string, unknown>;
  program: PlcProgram;
}

export interface IrSerializeResult {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  program: PlcProgram;
  summary: Record<string, unknown>;
  metadata: Record<string, unknown>;
  roundtrip?: {
    ok: boolean;
    matchedSymbols: string[];
    missingSymbols: string[];
  };
}

export interface IrJsonSchemaResponse {
  title: string;
  description: string;
  schema: Record<string, unknown>;
}
