import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defaultCompareEntries, parseCatalogLine } from './plc-catalog';

describe('parseCatalogLine', () => {
  it('parses Schneider M221 line', () => {
    const entry = parseCatalogLine(
      'Schneider Electric | Modicon M221 | TM221CE24T | 14DI+10DO Transistor NPN | 100 KB | Ethernet+Serial | $420-620',
    );
    assert.ok(entry);
    assert.equal(entry!.manufacturer, 'Schneider Electric');
    assert.equal(entry!.model, 'TM221CE24T');
    assert.equal(entry!.memoryKb, 100);
    assert.equal(entry!.priceMin, 420);
    assert.equal(entry!.priceMax, 620);
    assert.equal(entry!.priceMid, 520);
  });

  it('parses Siemens line with scan time', () => {
    const entry = parseCatalogLine(
      'Siemens | SIMATIC S7-1200 | CPU 1214C DC/DC/DC | 14DI/10DO/2AI | 100 KB | 0.1 μs | $500-700',
    );
    assert.ok(entry);
    assert.equal(entry!.scanTime, '0.1 μs');
    assert.equal(entry!.memoryKb, 100);
  });

  it('returns null for empty lines', () => {
    assert.equal(parseCatalogLine(''), null);
    assert.equal(parseCatalogLine('# comment'), null);
  });
});

describe('defaultCompareEntries', () => {
  it('picks one entry per major vendor when present', () => {
    const catalog = [
      parseCatalogLine(
        'Schneider Electric | Modicon M221 | TM221CE24T | 14DI | 100 KB | Ethernet | $420-620',
      )!,
      parseCatalogLine(
        'Siemens | SIMATIC S7-1200 | CPU 1214C DC/DC/DC | 14DI | 100 KB | 0.1 μs | $500-700',
      )!,
      parseCatalogLine(
        'Rockwell Automation | CompactLogix | 1769-L33ER | 32 I/O | 1024 KB | 1 ms | EtherNet/IP | $3000-5000',
      )!,
      parseCatalogLine('Mitsubishi | FX5U | FX5U-32MT | 20 I/O | 400 KB | 3 ms | Ethernet | $1200-1500')!,
    ];
    const defaults = defaultCompareEntries(catalog);
    assert.ok(defaults.length >= 3);
    const manufacturers = new Set(defaults.map((e) => e.manufacturer));
    assert.ok(manufacturers.size >= 3);
  });
});
