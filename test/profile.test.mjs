import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CORE_VERSION, MERMAID_VERSION, createDiagramProfile, validateDiagramProfile, compileDiagram, validateFrozenSource, renderDocument, PRESETS} from '../src/index.mjs';

test('the released 0.1.0 profile snapshot remains readable', async () => {
  // Keep this historical fixture fixed across engine/core upgrades. A failure
  // requires an explicit compatibility or migration decision for saved docs.
  const profile = JSON.parse(await readFile(new URL('./fixtures/profile-0.1.0.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateDiagramProfile(profile), profile);
});

test('profile is normalized and survives a JSON transport round trip', () => {
  const profile = createDiagramProfile({roles: {primary: '#abc'}, settings: {radius: 8}, standard: {name: ' Team ', version: ' 1.0 '}});
  assert.equal(profile.schema, 'kobo.diagram-profile/v1');
  assert.equal(profile.coreVersion, CORE_VERSION);
  assert.equal(profile.coreVersion, '0.1.1');
  assert.equal(profile.engineVersion, MERMAID_VERSION);
  assert.equal(profile.roles.primary, '#AABBCC');
  assert.equal(Object.keys(profile.roles).length, 11);
  assert.equal(profile.settings.fontSize, 18);
  assert.deepEqual(profile.standard, {name: 'Team', version: '1.0'});
  assert.deepEqual(validateDiagramProfile(JSON.parse(JSON.stringify(profile))), profile);
  profile.roles.primary = '#000000';
  assert.notEqual(createDiagramProfile().roles.primary, '#000000');
});

test('versions and profile shape are rejected instead of silently downgraded', () => {
  for (const field of ['engineVersion', 'coreVersion', 'schema']) {
    assert.throws(() => validateDiagramProfile({...createDiagramProfile(), [field]: '99.0.0'}), /Unsupported/);
  }
  for (const value of [null, [], 'profile', new Date()]) assert.throws(() => validateDiagramProfile(value), TypeError);
  assert.throws(() => validateDiagramProfile({...createDiagramProfile(), config: {securityLevel: 'loose'}}), /Unsupported profile field/);
  assert.throws(() => createDiagramProfile({themeCSS: 'body{display:none}'}), /Unsupported profile options field/);
});

test('only explicitly compatible historical cores are accepted without rewriting their profile', async () => {
  const previous = JSON.parse(await readFile(new URL('./fixtures/profile-0.1.0.json', import.meta.url), 'utf8'));
  previous.roles.primary = '#314D63';
  previous.settings.radius = 9;
  previous.standard = {name: 'Example Saved Standard', version: '3.2.0'};
  const expected = structuredClone(previous);
  assert.deepEqual(validateDiagramProfile(previous), expected);
  assert.deepEqual(previous, expected);
  assert.equal(validateDiagramProfile(previous).coreVersion, '0.1.0');
  for (const coreVersion of ['0.0.9', '0.1.2', '0.2.0', '1.0.0', '0.1.1-beta', '*']) {
    assert.throws(() => validateDiagramProfile({...previous, coreVersion}), /Unsupported core version/);
  }
  assert.throws(() => validateDiagramProfile({...previous, engineVersion: '12.2.1'}), /Unsupported Mermaid version/);
});

test('colors, numeric geometry and enums reject CSS or malformed values', () => {
  for (const color of ['red', '#fff;stroke:url(https://example.com)', 'url(javascript:x)', null, 123]) {
    assert.throws(() => createDiagramProfile({roles: {primary: color}}), /HEX/);
  }
  assert.throws(() => createDiagramProfile({roles: {unknown: '#FFFFFF'}}), /Unsupported roles/);
  for (const settings of [
    {radius: -1}, {radius: 21}, {lineWidth: 0}, {lineWidth: 4}, {fontSize: 13}, {fontSize: 23},
    {radius: '6'}, {fontSize: NaN}, {lineWidth: Infinity}, {transparent: 'false'},
    {curve: 'url(x)'}, {direction: 'evil'}, {density: 'tiny'}, {themeCSS: 'svg{display:none}'},
  ]) assert.throws(() => createDiagramProfile({settings}), TypeError);
  assert.throws(() => createDiagramProfile({standard: {name: 'x', version: '1', config: {}}}), /Unsupported standard/);
  assert.throws(() => createDiagramProfile({standard: {name: '<a>\n', version: '1'}}), /standard.name/);
});

test('enterprise compilation explicitly pins classic dagre without applying source policy', () => {
  const source = 'graph LR\n A[One] --> B[Two]\n classDef custom fill:#FFFFFF';
  const packet = compileDiagram(source, PRESETS[0].roles);
  assert.equal(packet.theme.layout, 'dagre');
  assert.equal(packet.theme.look, 'classic');
  assert.equal(packet.theme.securityLevel, 'strict');
  assert.equal(packet.theme.htmlLabels, false);
  assert.match(packet.source, /classDef custom/);
  assert.throws(() => validateFrozenSource(source), /固定スタイル/);
});

test('supplemental tables render without a Mermaid engine and escape source text', async () => {
  const source = JSON.stringify({schema: 'taskobo.table/v1', kind: 'raci', title: '<script>x</script>', columns: [{key: 'work'}, {key: 'owner'}, {key: 'team'}], rows: [{work: 'A&B', owner: 'A', team: 'R'}]});
  const packet = await renderDocument(source, {}, {});
  assert.equal(packet.type, 'document-table');
  assert.ok(packet.width > 0 && packet.height > 0);
  assert.match(packet.svg, /&lt;script&gt;/);
  assert.match(packet.svg, /A&amp;B/);
  assert.doesNotMatch(packet.svg, /<script>/);
  const invalid = JSON.parse(source); invalid.rows[0].team = 'A';
  await assert.rejects(renderDocument(JSON.stringify(invalid)), /最終責任者 A/);
});

test('a JSON table with a leading BOM renders without changing the original source', async () => {
  const source = '\uFEFF' + JSON.stringify({schema: 'taskobo.table/v1', columns: [{key: 'work'}, {key: 'owner'}], rows: [{work: 'Review', owner: 'Team'}]});
  const original = source;
  const packet = await renderDocument(source);
  assert.equal(packet.type, 'document-table');
  assert.match(packet.svg, /Review/);
  assert.equal(source, original);
  assert.equal(source.charCodeAt(0), 0xFEFF);
});
