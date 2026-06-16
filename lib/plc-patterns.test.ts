import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPatternSource,
  EXPORT_PATTERNS,
  isExportPattern,
  type PlcPattern,
} from './plc-patterns';

describe('plc-patterns', () => {
  it('lists ten export patterns', () => {
    assert.equal(EXPORT_PATTERNS.length, 10);
  });

  it('validates export pattern membership', () => {
    assert.equal(isExportPattern('motor_interlock'), true);
    assert.equal(isExportPattern('pid_control'), false);
  });

  it('buildPatternSource includes timing fields', () => {
    const source = buildPatternSource('sequential_lights', {
      numLights: 3,
      delaySeconds: 2,
      cycleSeconds: 5,
      runSeconds: 4,
      setpoint: 50,
    });
    assert.equal(source.type, 'pattern');
    assert.equal(source.pattern, 'sequential_lights');
    assert.equal(source.numLights, 3);
    assert.equal(source.delaySeconds, 2);
    assert.equal(source.cycleSeconds, 5);
    assert.equal(source.runSeconds, 4);
  });

  it('covers all catalog pattern ids', () => {
    const expected: PlcPattern[] = [
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
    ];
    assert.deepEqual([...EXPORT_PATTERNS].sort(), [...expected].sort());
  });
});
