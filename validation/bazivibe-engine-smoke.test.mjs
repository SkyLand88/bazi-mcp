/**
 * BaZiVibe development-only checks against SkyLand88/bazi-mcp.
 * Install the repo's pinned dependencies and run `npm run tsc` first.
 * This test deliberately does NOT certify calendrical accuracy:
 * the sole exact Four Pillars expectation is copied from the original README.
 * No external API, personal birth profiles, DB, or production services are used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILT_ENGINE = resolve(HERE, '../dist/index.js');
assert.ok(existsSync(BUILT_ENGINE),
  `Actual compiled engine not found: ${BUILT_ENGINE}. Run npm ci and npm run tsc first.`);
const module = await import(pathToFileURL(BUILT_ENGINE).href);
assert.equal(typeof module.getBaziDetail, 'function', 'Missing actual getBaziDetail export');
const getBaziDetail = module.getBaziDetail;
const EXAMPLE = {solarDatetime: '1998-07-31T14:10:00+08:00', gender: 1, eightCharProviderSect: 2};
const STEMS = new Set(Array.from('甲乙丙丁戊己庚辛壬癸'));
const BRANCHES = new Set(Array.from('子丑寅卯辰巳午未申酉戌亥'));

function checkShape(actual) {
  assert.ok(actual && typeof actual === 'object', 'No object response');
  const parts = String(actual['八字'] ?? '').trim().split(/\s+/u);
  assert.equal(parts.length, 4, 'Expected exactly four pillars');
  for (let index=0; index<parts.length; index++) {
    const chars = [...parts[index]];
    assert.equal(chars.length, 2, `Malformed pillar ${index+1}`);
    assert.ok(STEMS.has(chars[0]) && BRANCHES.has(chars[1]), `Invalid stem/branch at pillar ${index+1}`);
  }
  assert.equal(actual['日主'], [...parts[2]][0], 'Day Master contradicts Day Pillar');
  for (const [label, index] of [['年柱',0],['月柱',1],['日柱',2],['时柱',3]]) {
    assert.equal(actual[label]?.['天干']?.['天干'],[...parts[index]][0], `${label} stem mismatch`);
    assert.equal(actual[label]?.['地支']?.['地支'],[...parts[index]][1], `${label} branch mismatch`);
  }
  return parts;
}

test('README sample — engine smoke, NOT independent chart validation', {concurrency:false}, async () => {
  const result = await getBaziDetail(EXAMPLE);
  const chart = checkShape(result);
  assert.deepEqual(chart,['戊寅','己未','己卯','辛未']);
  assert.equal(result['日主'],'己');
});

test('Equivalent ISO timestamps preserve the chart', {concurrency:false}, async () => {
  const a = await getBaziDetail(EXAMPLE);
  const b = await getBaziDetail({...EXAMPLE,solarDatetime:'1998-07-31T06:10:00+00:00'});
  assert.equal(a['八字'],b['八字']);
});

test('Gender does not change the birth Four Pillars', {concurrency:false}, async () => {
  const a = await getBaziDetail(EXAMPLE);
  const b = await getBaziDetail({...EXAMPLE,gender:0});
  assert.equal(a['八字'],b['八字']);
  checkShape(b);
});

test('Sequential 23:30 provider settings are repeatable', {concurrency:false}, async () => {
  // This checks state contamination only. It does NOT settle which convention is correct.
  const base={solarDatetime:'2000-05-15T23:30:00+08:00',gender:1};
  const first = await getBaziDetail({...base,eightCharProviderSect:1});
  const second = await getBaziDetail({...base,eightCharProviderSect:2});
  const third = await getBaziDetail({...base,eightCharProviderSect:1});
  checkShape(first); checkShape(second); checkShape(third);
  assert.equal(first['八字'],third['八字'],'Global convention leaked across sequential runs');
});
