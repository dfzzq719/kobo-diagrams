import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS, derivePalette, deriveRaciPalette, contrastRatio, renderDocument} from '../src/index.mjs';

const codes = ['A', 'R', 'C', 'I', 'A/R'];
const rgb = hex => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
const difference = (a, b) => Math.max(...rgb(a).map((channel, index) => Math.abs(channel - rgb(b)[index])));
const source = JSON.stringify({
  schema: 'taskobo.table/v1', kind: 'raci', title: 'Example responsibilities',
  columns: [{key: 'work'}, {key: 'lead'}, {key: 'maker'}, {key: 'reviewer'}, {key: 'audience'}, {key: 'backup'}],
  rows: [
    {work: 'Plan', lead: 'A', maker: 'R', reviewer: 'C', audience: 'I', backup: ''},
    {work: 'Deliver', lead: '', maker: 'A/R', reviewer: 'C', audience: 'I', backup: ''},
    {work: 'Review', lead: '', maker: 'R/A', reviewer: 'C', audience: 'I', backup: ''},
  ],
});

test('default RACI uses a quiet blue and slate reading hierarchy', () => {
  const colors = deriveRaciPalette();
  assert.deepEqual(Object.fromEntries(codes.map(code => [code, colors[code].fill])), {
    A: '#2D4B75', R: '#DBE2E7', C: '#F3F4F1', I: '#F9F9F6', 'A/R': '#455A6F',
  });
  assert.ok(contrastRatio(colors.A.fill, '#FFFEFA') > contrastRatio(colors.R.fill, '#FFFEFA'));
  assert.ok(contrastRatio(colors.R.fill, '#FFFEFA') > contrastRatio(colors.C.fill, '#FFFEFA'));
  assert.ok(contrastRatio(colors.C.fill, '#FFFEFA') > contrastRatio(colors.I.fill, '#FFFEFA'));
});

for (const preset of PRESETS) {
  test(`${preset.id}: all RACI letters and table text remain readable`, () => {
    const p = derivePalette(preset.roles), colors = deriveRaciPalette(preset.roles);
    assert.deepEqual(Object.keys(colors), codes);
    assert.equal(new Set(codes.map(code => colors[code].fill)).size, codes.length);
    for (const code of codes) assert.ok(contrastRatio(colors[code].ink, colors[code].fill) >= 4.5, `${code} letter contrast`);
    assert.ok(contrastRatio(p.ink, p.paper) >= 4.5, 'title contrast');
    assert.ok(contrastRatio(p.muted, p.paper) >= 4.5, 'legend description contrast');
    assert.ok(contrastRatio(p.onAnchor, p.anchor) >= 4.5, 'column header contrast');
    assert.ok(difference(colors.C.fill, p.paper) <= 24, 'C recedes toward paper');
    assert.ok(difference(colors.I.fill, p.paper) <= 12, 'I stays almost neutral');
    assert.ok(difference(colors.I.fill, p.paper) < difference(colors.C.fill, p.paper));
    if (preset.id !== 'mono') {
      for (const code of ['A', 'R', 'A/R']) {
        const [red, green, blue] = rgb(colors[code].fill);
        assert.ok(red <= green && green <= blue, `${code} remains in the blue/slate family`);
      }
      assert.ok(Math.max(...rgb(colors['A/R'].fill)) - Math.min(...rgb(colors['A/R'].fill)) < 55, 'combined responsibility avoids a saturated accent');
    }
  });

  test(`${preset.id}: rendered cells and legend map exact RACI letters to the palette`, async () => {
    const colors = deriveRaciPalette(preset.roles);
    const {svg} = await renderDocument(source, preset.roles);
    const mapped = [...svg.matchAll(/<rect\b([^>]*data-raci-role="([^"]+)"[^>]*)\/><text\b([^>]*)>([\s\S]*?)<\/text>/g)];
    for (const code of codes) {
      const entries = mapped.filter(([, , role]) => role === code);
      assert.ok(entries.length >= 2, `${code} appears in cells and legend`);
      for (const [, rectangle, , textAttributes, content] of entries) {
        assert.equal(rectangle.match(/\bfill="([^"]+)"/)[1], colors[code].fill);
        assert.equal(textAttributes.match(/\bfill:(#[\dA-Fa-f]+)/)[1], colors[code].ink);
        const letter = content.replace(/<[^>]*>/g, '');
        assert.ok(letter === code || (code === 'A/R' && letter === 'R/A'), `${code} is visible without depending on its color`);
      }
    }
  });
}

test('black and white RACI remains grayscale in light and dark documents', () => {
  const mono = PRESETS.find(preset => preset.id === 'mono').roles;
  const darkMono = {...mono, paper: '#111111', surface: '#1C1C1C', ink: '#EEEEEE', muted: '#BBBBBB'};
  for (const roles of [mono, darkMono]) for (const {fill, ink} of Object.values(deriveRaciPalette(roles))) {
    assert.equal(new Set(rgb(fill)).size, 1);
    assert.ok(contrastRatio(ink, fill) >= 4.5);
  }
});

test('RACI keeps brand coordination separate from business status colors', () => {
  const roles = PRESETS[0].roles;
  const recoloredStatus = {...roles, success: '#FF0000', warning: '#00FF00', danger: '#0000FF'};
  assert.deepEqual(deriveRaciPalette(recoloredStatus), deriveRaciPalette(roles));
  assert.notEqual(deriveRaciPalette(PRESETS.find(preset => preset.id === 'forest').roles).A.fill, deriveRaciPalette(roles).A.fill);
  assert.deepEqual(derivePalette(roles).series.slice(0, 3), ['#1456D9', '#167D91', '#7960AD']);
  assert.equal(derivePalette(roles).success, roles.success);
  assert.equal(derivePalette(roles).warning, roles.warning);
  assert.equal(derivePalette(roles).danger, roles.danger);
});
