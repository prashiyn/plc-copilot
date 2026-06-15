import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildProgramPreview,
  detectPatternFromLogic,
  previewFileContent,
  resolveGenerationPath,
  resolveNativePlatform,
  resolvePlcopenPlatform,
  resolveTier2Platform,
  tier2SourceImportDisclaimer,
} from './plc-generation';

describe('detectPatternFromLogic', () => {
  it('detects sequential lights with count and delay', () => {
    const result = detectPatternFromLogic(
      '3 sequential lights with 3-second delays. START button to begin, STOP to interrupt.',
    );
    assert.equal(result.pattern, 'sequential_lights');
    assert.equal(result.numLights, 3);
    assert.equal(result.delaySeconds, 3);
  });

  it('detects motor start/stop', () => {
    const result = detectPatternFromLogic('Motor start stop circuit with START and STOP buttons.');
    assert.equal(result.pattern, 'motor_startstop');
  });

  it('detects E-stop motor', () => {
    const result = detectPatternFromLogic('Motor with emergency stop E-stop and seal-in.');
    assert.equal(result.pattern, 'estop_motor');
  });

  it('detects tank level control', () => {
    const result = detectPatternFromLogic('Tank level control with fill pump and low/high sensors.');
    assert.equal(result.pattern, 'tank_level');
  });

  it('detects conveyor start/stop', () => {
    const result = detectPatternFromLogic('Conveyor belt start stop with run signal.');
    assert.equal(result.pattern, 'conveyor_startstop');
  });

  it('detects traffic lights with cycle', () => {
    const result = detectPatternFromLogic('Traffic light sequence with 4 second cycle.');
    assert.equal(result.pattern, 'traffic_lights');
    assert.equal(result.cycleSeconds, 4);
  });

  it('extracts project name', () => {
    const result = detectPatternFromLogic('Project: Tank_Control\n4 sequential lights');
    assert.equal(result.projectName, 'Tank_Control');
  });
});

describe('resolveNativePlatform', () => {
  it('maps Schneider and Rockwell', () => {
    assert.equal(resolveNativePlatform('Schneider Electric'), 'schneider');
    assert.equal(resolveNativePlatform('Rockwell Automation'), 'rockwell');
    assert.equal(resolveNativePlatform('Allen-Bradley'), 'rockwell');
    assert.equal(resolveNativePlatform('Siemens'), null);
    assert.equal(resolveNativePlatform('Mitsubishi Electric'), null);
  });
});

describe('resolveTier2Platform', () => {
  it('maps Siemens and Mitsubishi', () => {
    assert.equal(resolveTier2Platform('Siemens'), 'siemens');
    assert.equal(resolveTier2Platform('Siemens AG'), 'siemens');
    assert.equal(resolveTier2Platform('Mitsubishi Electric'), 'mitsubishi');
    assert.equal(resolveTier2Platform('Schneider Electric'), null);
  });
});

describe('resolveGenerationPath', () => {
  it('routes native vendors to native generation', () => {
    assert.equal(resolveGenerationPath('Schneider Electric', 'motor_startstop'), 'native');
    assert.equal(resolveGenerationPath('Rockwell Automation', 'sequential_lights'), 'native');
  });

  it('routes tier-2 vendors to tier2 for motor-like patterns', () => {
    assert.equal(resolveGenerationPath('Siemens', 'motor_startstop'), 'tier2');
    assert.equal(resolveGenerationPath('Siemens', 'estop_motor'), 'tier2');
    assert.equal(resolveGenerationPath('Siemens', 'conveyor_startstop'), 'tier2');
    assert.equal(resolveGenerationPath('Mitsubishi Electric', 'motor_startstop'), 'tier2');
    assert.equal(resolveGenerationPath('Siemens', 'sequential_lights'), 'unsupported');
    assert.equal(resolveGenerationPath('Siemens', 'tank_level'), 'unsupported');
    assert.equal(resolveGenerationPath('Siemens', 'traffic_lights'), 'unsupported');
  });

  it('falls back to plcopen for other vendors on motor logic', () => {
    assert.equal(resolveGenerationPath('CODESYS GmbH', 'motor_startstop'), 'plcopen');
    assert.equal(resolveGenerationPath('CODESYS GmbH', 'sequential_lights'), 'unsupported');
  });
});

describe('resolvePlcopenPlatform', () => {
  it('maps vendor names for PLCopen export', () => {
    assert.equal(resolvePlcopenPlatform('Siemens'), 'siemens');
    assert.equal(resolvePlcopenPlatform('Mitsubishi Electric'), 'mitsubishi');
    assert.equal(resolvePlcopenPlatform('CODESYS'), 'codesys');
    assert.equal(resolvePlcopenPlatform('Unknown Vendor'), 'universal');
  });
});

describe('tier2SourceImportDisclaimer', () => {
  it('includes source-import wording for each tier-2 vendor', () => {
    assert.match(tier2SourceImportDisclaimer('siemens'), /Source import only.*TIA Portal/i);
    assert.match(tier2SourceImportDisclaimer('mitsubishi'), /Source import only.*GX Works/i);
  });
});

describe('buildProgramPreview', () => {
  it('returns scl text for siemens tier-2 exports', () => {
    const preview = buildProgramPreview(
      Buffer.from('ORGANIZATION_BLOCK "Main"', 'utf-8'),
      'text/plain',
      { tier: 2, format: 'scl' },
    );
    assert.equal(preview, 'ORGANIZATION_BLOCK "Main"');
  });

  it('describes mitsubishi tier-2 zip bundles', () => {
    const preview = buildProgramPreview(
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      'application/zip',
      {
        tier: 2,
        format: 'mitsubishi_tier2_zip',
        files: ['Motor.il', 'Motor.st', 'Motor_device_comments.csv'],
      },
    );
    assert.match(preview, /Mitsubishi Tier-2 source import ZIP/);
    assert.match(preview, /Motor\.il, Motor\.st, Motor_device_comments\.csv/);
  });
});

describe('previewFileContent', () => {
  it('returns xml text for xml mime type', () => {
    const preview = previewFileContent(Buffer.from('<project/>', 'utf-8'), 'application/xml');
    assert.equal(preview, '<project/>');
  });

  it('describes zip smbp archives', () => {
    const preview = previewFileContent(Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'application/octet-stream');
    assert.match(preview, /Valid \.smbp project archive/);
  });
});
