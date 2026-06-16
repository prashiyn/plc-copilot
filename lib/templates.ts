import type { PlcPattern } from '@/lib/plc-patterns';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  pattern: PlcPattern;
  defaultPlatform: 'schneider' | 'rockwell' | 'siemens' | 'mitsubishi';
  defaultController: string;
  industry: string;
  complexity: 'Simple' | 'Medium' | 'Advanced';
  logicDescription: string;
  setpoint?: number;
  numLights?: number;
  delaySeconds?: number;
  cycleSeconds?: number;
  runSeconds?: number;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'motor_startstop',
    name: 'Motor Start/Stop',
    description: 'Basic motor control with start and stop pushbuttons.',
    pattern: 'motor_startstop',
    defaultPlatform: 'schneider',
    defaultController: 'TM221CE24R',
    industry: 'General',
    complexity: 'Simple',
    logicDescription: 'Motor start stop with start button and stop button for a conveyor motor.',
  },
  {
    id: 'sequential_lights',
    name: 'Sequential Lights',
    description: 'Cycle through multiple indicator lights in sequence.',
    pattern: 'sequential_lights',
    defaultPlatform: 'siemens',
    defaultController: 'S7-1200',
    industry: 'Manufacturing',
    complexity: 'Medium',
    logicDescription: 'Sequential lights with 4 lights and 2 second delay between each light.',
    numLights: 4,
    delaySeconds: 2,
  },
  {
    id: 'estop_motor',
    name: 'E-Stop Motor',
    description: 'Motor control with emergency stop safety interlock.',
    pattern: 'estop_motor',
    defaultPlatform: 'rockwell',
    defaultController: '1769-L33ER',
    industry: 'Safety',
    complexity: 'Medium',
    logicDescription: 'E-stop motor circuit with emergency stop button and motor starter.',
  },
  {
    id: 'tank_level',
    name: 'Tank Level Control',
    description: 'Automated tank filling with high/low level sensors.',
    pattern: 'tank_level',
    defaultPlatform: 'schneider',
    defaultController: 'TM221CE24R',
    industry: 'Process',
    complexity: 'Medium',
    logicDescription: 'Tank level control with fill pump, high level sensor, and low level sensor.',
  },
  {
    id: 'conveyor_startstop',
    name: 'Conveyor Start/Stop',
    description: 'Start and stop a conveyor line with status indication.',
    pattern: 'conveyor_startstop',
    defaultPlatform: 'mitsubishi',
    defaultController: 'FX5U',
    industry: 'Material Handling',
    complexity: 'Simple',
    logicDescription: 'Conveyor start stop with start button, stop button, and running indicator.',
  },
  {
    id: 'traffic_lights',
    name: 'Traffic Light Controller',
    description: 'Intersection traffic light sequence controller.',
    pattern: 'traffic_lights',
    defaultPlatform: 'siemens',
    defaultController: 'S7-1200',
    industry: 'Infrastructure',
    complexity: 'Medium',
    logicDescription: 'Traffic lights with 30 second cycle for red, yellow, and green phases.',
    cycleSeconds: 30,
  },
  {
    id: 'motor_interlock',
    name: 'Motor Interlock',
    description: 'Prevent two motors from running simultaneously.',
    pattern: 'motor_interlock',
    defaultPlatform: 'rockwell',
    defaultController: '1769-L33ER',
    industry: 'General',
    complexity: 'Medium',
    logicDescription: 'Motor interlock so motor A and motor B cannot run at the same time.',
  },
  {
    id: 'pump_staging',
    name: 'Pump Staging',
    description: 'Lead/lag pump control for redundant pumping.',
    pattern: 'pump_staging',
    defaultPlatform: 'schneider',
    defaultController: 'TM221CE24R',
    industry: 'Utilities',
    complexity: 'Advanced',
    logicDescription: 'Pump staging with lead pump, lag pump, and level-based alternation.',
  },
  {
    id: 'timed_motor',
    name: 'Timed Motor Run',
    description: 'Motor runs for a fixed duration after start.',
    pattern: 'timed_motor',
    defaultPlatform: 'mitsubishi',
    defaultController: 'FX5U',
    industry: 'General',
    complexity: 'Simple',
    logicDescription: 'Timed motor that runs for 10 seconds after start button is pressed.',
    runSeconds: 10,
  },
  {
    id: 'pid_loop',
    name: 'PID Temperature Control',
    description: 'Closed-loop PID control for temperature or analog process.',
    pattern: 'pid_loop',
    defaultPlatform: 'siemens',
    defaultController: 'S7-1200',
    industry: 'Process',
    complexity: 'Advanced',
    logicDescription: 'PID loop temperature control with setpoint 50 and analog valve output.',
    setpoint: 50,
  },
];

export function listProjectTemplates(): ProjectTemplate[] {
  return PROJECT_TEMPLATES;
}

export function getProjectTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((template) => template.id === id);
}

export function buildGeneratorUrl(template: ProjectTemplate): string {
  const params = new URLSearchParams({
    template: template.id,
    platform: template.defaultPlatform,
    logic: template.logicDescription,
    projectName: template.name,
  });
  if (template.setpoint != null) params.set('setpoint', String(template.setpoint));
  return `/generator?${params.toString()}`;
}
