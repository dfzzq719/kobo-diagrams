/** Portable colour utilities. No DOM, storage, network, or Node dependencies. */
export const ROLE_DEFS = Object.freeze([
  ['paper', 'キャンバス'], ['surface', 'ノード面'], ['ink', '本文'], ['muted', '補助文字'],
  ['primary', '強調色'], ['anchor', '軸色'], ['line', '接続線'], ['border', '枠線'],
  ['success', '成功'], ['warning', '注意'], ['danger', 'リスク'],
].map(([key, label]) => Object.freeze({ key, label })));

const BASE = Object.freeze({
  paper: '#FFFEFA', surface: '#FFFFFF', ink: '#0D2046', muted: '#52637A',
  primary: '#1456D9', anchor: '#0D2046', line: '#77869D', border: '#52637A',
  success: '#0A6954', warning: '#895B12', danger: '#B5323B',
});
const preset = (id, label, description, roles, tones={}) => Object.freeze({
  id, label, description, roles: Object.freeze({ ...BASE, ...roles }),tones:Object.freeze(tones),
});
const LIGHT_STRUCTURE={paper:'#FFFFFF',surface:'#FFFFFF',ink:'#202A36',muted:'#536173',line:'#738093',border:'#6B788A',success:'#1F6D50',warning:'#8A5900',danger:'#B33B45'};
const LIGHT_TONES={neutral:'#F3F5F7',successSoft:'#EAF5EF',warningSoft:'#FFF4DB',dangerSoft:'#FCECEE'};
export const PRESETS = Object.freeze([
  preset('taskobo', 'Taskobo・ブルー', '温かな白地、濃紺の見出し、コバルトの強調。比較の基準。', {}),
  preset('graphite', 'スレート', '白地と青みのある石墨色。色数を抑えた報告書・経営資料に。', {
    ...LIGHT_STRUCTURE,primary:'#435569',anchor:'#293847',
  },{...LIGHT_TONES,primarySoft:'#EAF0F5'}),
  preset('forest', 'エバーグリーン', '白地に深緑の見出しと強調。本文と線は中性色で統一。', {
    ...LIGHT_STRUCTURE,primary:'#176C4C',anchor:'#253B34',
  },{...LIGHT_TONES,primarySoft:'#E6F3EC'}),
  preset('teal', 'ミネラル・ティール', '澄んだ青緑と白い情報面。業務設計・技術文書に。', {
    ...LIGHT_STRUCTURE,primary:'#08778A',anchor:'#233D47',
  },{...LIGHT_TONES,primarySoft:'#E4F3F5'}),
  preset('violet', 'インディゴ', '青紫を見出しと要点に限定。本文は落ち着いた無彩色。', {
    ...LIGHT_STRUCTURE,primary:'#6352B3',anchor:'#34394F',
  },{...LIGHT_TONES,primarySoft:'#EEEBFA'}),
  preset('burgundy', 'プラム', '白地にプラムの強調。細かな情報は中性色で静かに整理。', {
    ...LIGHT_STRUCTURE,primary:'#903F67',anchor:'#403540',
  },{...LIGHT_TONES,primarySoft:'#F7EAF0'}),
  preset('mono', 'モノクロ・プリント', '白地と無彩色。分類や状態は文字・番号・線種と併せて読む。', {
    paper:'#FFFFFF',surface:'#FFFFFF',ink:'#202020',muted:'#585858',primary:'#383838',anchor:'#252525',line:'#777777',border:'#686868',success:'#505050',warning:'#606060',danger:'#303030',
  },{neutral:'#F4F4F4',primarySoft:'#EAEAEA',successSoft:'#EFEFEF',warningSoft:'#F2F2F2',dangerSoft:'#E8E8E8'}),
  preset('dark', 'ミッドナイト', '深い藍の背景と明るい本文。見出し面は暗く保つ画面用配色。', {
    paper:'#111824',surface:'#1C2737',ink:'#EDF1F7',muted:'#B3BDCA',primary:'#8EB8F5',anchor:'#24354B',line:'#8F9BAB',border:'#7E8D9F',success:'#71BF9A',warning:'#E7B866',danger:'#EE9298',
  },{neutral:'#192433',primarySoft:'#233650',successSoft:'#20372F',warningSoft:'#3B3020',dangerSoft:'#3D2830'}),
]);

export function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const match = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const digits = match[1].length === 3
    ? [...match[1]].map(char => char + char).join('') : match[1];
  return `#${digits.toUpperCase()}`;
}

function requireHex(value) {
  const result = normalizeHex(value);
  if (!result) throw new TypeError(`無効な色：${String(value)}。3 桁または 6 桁の HEX を入力してください。`);
  return result;
}

function rgb(value) {
  const hex = requireHex(value);
  return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
}

function luminance(value) {
  const channels = rgb(value).map(channel => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function mixHex(a, b, weight) {
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 1) {
    throw new RangeError('混色の比率は 0〜1 の有限数で指定してください。');
  }
  const first = rgb(a);
  const second = rgb(b);
  return '#' + first.map((channel, i) => Math.round(channel * (1 - weight) + second[i] * weight)
    .toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function onColor(background,foreground='#202020') {
  requireHex(background);
  requireHex(foreground);
  const whiteRatio = contrastRatio('#FFFFFF', background);
  const inkRatio = contrastRatio(foreground, background);
  // Prefer the document's own ink when readable, without adding a navy cast
  // to neutral/print themes. Black/white remains the small-contrast fallback.
  if (whiteRatio >= inkRatio && whiteRatio >= 4.5) return '#FFFFFF';
  if (inkRatio >= 4.5) return foreground;
  return contrastRatio('#000000', background) > whiteRatio ? '#000000' : '#FFFFFF';
}

function completeRoles(roles = {}) {
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) {
    throw new TypeError('配色は用途ごとの色を含むオブジェクトで指定してください。');
  }
  const result = { ...BASE };
  for (const { key, label } of ROLE_DEFS) {
    if (roles[key] === undefined) continue;
    const hex = normalizeHex(roles[key]);
    if (!hex) throw new TypeError(`${label}（${key}）は有効な 3 桁または 6 桁の HEX ではありません。`);
    result[key] = hex;
  }
  return result;
}

export function derivePalette(roles = {}) {
  const palette = completeRoles(roles);
  const dark = luminance(palette.paper) < 0.18;
  const softness = dark ? 0.18 : 0.09;
  const matched=PRESETS.find(preset=>ROLE_DEFS.every(({key})=>preset.roles[key]===palette[key]));
  const monochrome=ROLE_DEFS.every(({key})=>{const channels=rgb(palette[key]);return channels.every(channel=>channel===channels[0]);});
  // Categorical peers are independent of success/warning/risk semantics.
  // A stable 12-color sequence avoids abruptly switching to near-white fills.
  const categoryLight=['#245AB9','#167D91','#7960AD','#AD722B','#526E88','#A14F79','#3A75A6','#47786F','#8C69A7','#8D6843','#6E6B89','#A06459'];
  const categoryDark=['#8EB8F5','#67BDC8','#B3A1DF','#D9AF72','#93B2CB','#D899B7','#78ACD5','#8DBEB4','#C3A4DD','#C3AA86','#B2AECF','#D4A598'];
  const categoryGray=['#303030','#717171','#4C4C4C','#8A8A8A','#5C5C5C','#3C3C3C','#808080','#424242','#686868','#555555','#767676','#898989'];
  let series=monochrome?categoryGray:[...(dark?categoryDark:categoryLight)];
  if(!monochrome){
    // Keep the theme in the first category; repair only data-series legibility,
    // never the explicitly chosen brand role itself.
    const first=adjustedColor(palette.primary,[palette.paper,palette.surface],3),seed=rgb(first);
    const distances=series.map(color=>rgb(color).reduce((sum,channel,index)=>sum+(channel-seed[index])**2,0));
    const closest=distances.indexOf(Math.min(...distances));
    series=[first,...series.filter((_,index)=>index!==closest)];
    for(let i=1;i<series.length;i++)series[i]=adjustedColor(series[i],[palette.paper,palette.surface],3);
  }
  const result={
    ...palette,
    primarySoft: mixHex(palette.paper, palette.primary, softness),
    successSoft: mixHex(palette.paper, palette.success, softness),
    warningSoft: mixHex(palette.paper, palette.warning, softness),
    dangerSoft: mixHex(palette.paper, palette.danger, softness),
    neutral: mixHex(palette.paper, palette.ink, dark ? 0.055 : 0.035),
    grid: mixHex(palette.paper, palette.line, dark ? 0.24 : 0.18),
    ...(matched?.tones||{}),
    onPrimary: onColor(palette.primary,palette.ink),
    onAnchor: onColor(palette.anchor,palette.ink),
    series,
    seriesSoft:series.map(color=>mixHex(palette.paper,color,dark?.2:.075)),
  };
  return result;
}

/** Five nominal responsibility categories, independent of business status. */
export function deriveRaciPalette(roles = {}) {
  const p=derivePalette(roles),dark=luminance(p.paper)<0.18;
  const monochrome=['paper','surface','ink','muted','primary','anchor','line','border'].every(key=>{const channels=rgb(p[key]);return channels.every(channel=>channel===channels[0]);});
  if(monochrome){
    const fills=dark?{A:'#626262',R:'#303030',C:'#222222',I:'#191919','A/R':'#4B4B4B'}:{A:'#3F3F3F',R:'#DFDFDF',C:'#F2F2F2',I:'#FAFAFA','A/R':'#5A5A5A'};
    return Object.fromEntries(Object.entries(fills).map(([code,fill])=>[code,{fill,ink:onColor(fill,p.ink)}]));
  }
  // Responsibility is a reading hierarchy, not five competing chart series.
  // A small brand contribution keeps one blue/slate family across presets;
  // consulted/informed cells stay close to the document's own paper.
  const fills={
    A:mixHex(dark?'#2B4968':'#304A67',p.primary,dark?.15:.12),
    R:mixHex(p.paper,mixHex(dark?'#7C98B5':'#718CA6',p.primary,.08),dark?.26:.24),
    C:mixHex(p.paper,dark?'#8292A5':'#617287',dark?.10:.075),
    I:mixHex(p.paper,dark?'#8292A5':'#617287',dark?.04:.035),
    'A/R':mixHex(dark?'#445362':'#485A68',p.primary,.06),
  };
  return Object.fromEntries(Object.entries(fills).map(([code,fill])=>[code,{fill,ink:onColor(fill,p.ink)}]));
}

// Shared by assessment and repair, so repaired colours are tested against the
// actual soft fills used in the diagram rather than only the page background.
const textBackgrounds = ['paper', 'surface', 'neutral', 'primarySoft', 'successSoft', 'warningSoft', 'dangerSoft'];
const backgroundLabels = {
  paper: 'キャンバス', surface: 'ノード面', neutral: '無彩色の面', primarySoft: '強調色の淡色面',
  successSoft: '成功色の淡色面', warningSoft: '注意色の淡色面', dangerSoft: 'リスク色の淡色面',
};

export function assessPalette(roles = {}) {
  const p = derivePalette(roles);
  const checks = [];
  const add = (name, foreground, background, minimum) => {
    const ratio = contrastRatio(p[foreground], p[background]);
    checks.push({ name, foreground: p[foreground], background: p[background], ratio, minimum, passes: ratio >= minimum });
  };
  for (const bg of textBackgrounds) add(`本文 / ${backgroundLabels[bg]}`, 'ink', bg, 4.5);
  for (const bg of textBackgrounds) add(`補助文字 / ${backgroundLabels[bg]}`, 'muted', bg, 4.5);
  add('強調色の上の文字', 'onPrimary', 'primary', 4.5);
  add('軸色の上の文字', 'onAnchor', 'anchor', 4.5);
  for (const [role, label] of [['success', '成功'], ['warning', '注意'], ['danger', 'リスク']]) {
    add(`${label}文字 / ${label}淡色面`, role, `${role}Soft`, 4.5);
  }
  for (const bg of ['paper', 'surface', 'neutral']) add(`接続線 / ${backgroundLabels[bg]}`, 'line', bg, 3);
  for (const bg of textBackgrounds) add(`必要な枠線 / ${backgroundLabels[bg]}`, 'border', bg, 3);
  return { allPass: checks.every(check => check.passes), checks };
}

function adjustedColor(original, backgrounds, minimum) {
  const passes = color => backgrounds.every(bg => contrastRatio(color, bg) >= minimum);
  if (passes(original)) return original;
  const originalRGB = rgb(original);
  const distance = color => rgb(color).reduce((sum, channel, i) => sum + (channel - originalRGB[i]) ** 2, 0);
  let best = null;
  let bestDistance = Infinity;
  const consider = color => {
    const delta = distance(color);
    if (delta < bestDistance && passes(color)) { best = color; bestDistance = delta; }
  };
  // Search both hue-preserving ramps and grayscale. Grayscale also finds a
  // feasible intermediate colour when neither black nor white passes every fill.
  for (let step = 0; step <= 255; step++) {
    consider(mixHex(original, '#000000', step / 255));
    consider(mixHex(original, '#FFFFFF', step / 255));
    const byte = step.toString(16).padStart(2, '0').toUpperCase();
    consider(`#${byte}${byte}${byte}`);
  }
  return best ?? original;
}

export function repairPalette(roles = {}) {
  const result = completeRoles(roles);
  // neutral depends on ink; resolve it again after repairing that role.
  for (let pass = 0; pass < 2; pass++) {
    const p = derivePalette(result);
    result.ink = adjustedColor(result.ink, textBackgrounds.map(key => p[key]), 4.5);
    const refreshed = derivePalette(result);
    result.muted = adjustedColor(result.muted, textBackgrounds.map(key => refreshed[key]), 4.5);
    result.line = adjustedColor(result.line, ['paper', 'surface', 'neutral'].map(key => refreshed[key]), 3);
    result.border = adjustedColor(result.border, textBackgrounds.map(key => refreshed[key]), 3);
  }
  return result;
}

const mermaidRoles = {
  background: 'paper', mainBkg: 'surface', textColor: 'ink', primaryTextColor: 'ink',
  secondaryTextColor: 'ink', tertiaryTextColor: 'ink', primaryColor: 'primary',
  primaryBorderColor: 'border', lineColor: 'line', clusterBorder: 'border',
  clusterBkg: 'surface', noteBkgColor: 'surface', noteTextColor: 'ink',
  noteBorderColor: 'border', actorBkg: 'surface', actorTextColor: 'ink',
  signalColor: 'line', signalTextColor: 'ink', edgeLabelBackground: 'paper',
};
const aliases = {
  bg: 'paper', background: 'paper', canvas: 'paper', card: 'surface', panel: 'surface',
  text: 'ink', textprimary: 'ink', foreground: 'ink', textsecondary: 'muted',
  secondarytext: 'muted', accent: 'primary', brand: 'primary', navy: 'anchor',
  connector: 'line', edge: 'line', outline: 'border', positive: 'success',
  caution: 'warning', error: 'danger', negative: 'danger',
};

function namedRole(label, isMermaid = false) {
  if (isMermaid && mermaidRoles[label]) return mermaidRoles[label];
  const cleaned = label.replace(/^--/, '').replace(/^(?:taskobo[-_]?|color[-_]?|theme[-_]?)/i, '')
    .replace(/[-_\s]/g, '').toLowerCase();
  return ROLE_DEFS.some(role => role.key === cleaned) ? cleaned : aliases[cleaned];
}

const hexPattern = /#[\da-f]{6}(?![\da-f])|#[\da-f]{3}(?![\da-f])/gi;

export function extractTextPalette(text, filename = '') {
  if (typeof text !== 'string' || !text.trim()) throw new Error('読み取れるテキストがありません。HEX を含む CSS または JSON を選んでください。');
  const found = [];
  const suggestedRoles = {};
  let format = 'テキスト';
  let mermaid = false;
  let explicitRoles = 0;
  const add = (value, label, role) => {
    const hex = normalizeHex(value);
    if (!hex) return;
    found.push({ hex, label: String(label || hex), ...(role ? { role } : {}) });
    if (role) { suggestedRoles[role] = hex; explicitRoles++; }
  };
  const trimmed = text.trim();
  const looksJSON = /^[\[{]/.test(trimmed) || /\.json$/i.test(filename);
  let parsed;
  if (looksJSON) {
    try { parsed = JSON.parse(trimmed); format = 'JSON'; }
    catch (error) {
      if (/\.json$/i.test(filename) || /^\[/.test(trimmed)) {
        throw new Error('JSON の引用符・カンマ・括弧を確認してください。');
      }
    }
  }
  if (parsed !== undefined) {
    const visit = (value, path = [], inMermaid = false) => {
      if (Array.isArray(value)) {
        value.forEach((entry, index) => visit(entry, [...path, String(index)], inMermaid));
      } else if (value && typeof value === 'object') {
        // Common palette arrays: [{ role: 'primary', hex: '#1456D9' }].
        const swatch = value.hex ?? value.value ?? value.color;
        if (typeof swatch === 'string' && normalizeHex(swatch)) {
          const label = value.role ?? value.key ?? value.name ?? value.label ?? path.at(-1) ?? '色';
          add(swatch, value.label ?? value.name ?? label, namedRole(String(label), inMermaid));
        }
        for (const [key, child] of Object.entries(value)) {
          if (['hex', 'value', 'color'].includes(key) && normalizeHex(swatch)) continue;
          const nextMermaid = inMermaid || key === 'themeVariables';
          if (key === 'themeVariables') mermaid = true;
          visit(child, [...path, key], nextMermaid);
        }
      } else if (typeof value === 'string') {
        const key = path.at(-1) ?? '色';
        const role = namedRole(key, inMermaid);
        if (normalizeHex(value)) add(value, path.join('.') || value, role);
        else for (const match of value.matchAll(hexPattern)) add(match[0], path.join('.') || match[0], role);
      }
    };
    visit(parsed);
    if (mermaid) format = 'Mermaid themeVariables JSON';
  } else {
    const cssVariables = /(--[\w-]+)\s*:\s*([^;}\n]+)/g;
    for (const declaration of text.matchAll(cssVariables)) {
      const role = namedRole(declaration[1]);
      for (const match of declaration[2].matchAll(hexPattern)) add(match[0], declaration[1], role);
    }
    if (found.length) format = 'CSS 変数';
    // Preserve additional swatches outside custom-property declarations too.
    for (const match of text.matchAll(hexPattern)) {
      if (!found.some(color => color.hex === normalizeHex(match[0]))) add(match[0], 'テキスト中の HEX');
    }
  }
  if (!found.length) throw new Error('3 桁または 6 桁の HEX が見つかりません。#1456D9 などを含む CSS / JSON を選んでください。');
  const colors = [];
  for (const color of found) {
    const previous = colors.find(entry => entry.hex === color.hex);
    if (!previous) colors.push({ ...color });
    else if (color.role && !previous.role) Object.assign(previous, { role: color.role, label: color.label });
  }
  const evidence = [`${filename ? `「${filename}」` : '入力テキスト'} から ${format} を読み取り、${colors.length} 色の HEX を検出しました。`];
  if (explicitRoles) evidence.push(`用途・変数名から ${Object.keys(suggestedRoles).length} 件の配色を対応付けました。その他は現在の配色を保ちます。`);
  else evidence.push('用途を特定できなかったため、色のみを抽出しました。使い道を選んでください。');
  evidence.push('ファイル内の明示的な色指定です。画像や正式なブランド規定を再現したという意味ではありません。');
  return { colors, suggestedRoles, evidence, confidence: explicitRoles ? (mermaid ? 0.9 : 0.98) : 0.45 };
}
