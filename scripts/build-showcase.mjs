#!/usr/bin/env node
/** Rebuild real renderer figures. Requires npm ci and an installed Chrome/Edge. */
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'docs/assets');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--browser')) throw new Error('Use --browser <installed Chrome/Edge executable>.');
const candidates = [args[1], process.env.CHROME_BIN, process.env.TASKOBO_CHROME_PATH,
  path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean);
const browser = candidates.find(candidate => existsSync(candidate));
if (!browser) throw new Error('Install Chrome/Edge or pass --browser; this generator does not download a browser.');
if (!existsSync(path.join(root, 'node_modules/mermaid/dist/mermaid.esm.mjs'))) throw new Error('Run npm ci first.');
await mkdir(assets, {recursive: true});

const inputs = {
  profileOptions: {settings: {fontSize: 22, density: 'compact', curve: 'linear'}, standard: {name: 'Atlas example standard', version: '1.0'}},
  sources: {
    wbs: `flowchart TB
  Project["Atlas service launch"]:::anchor
  Project --> Scope["Scope & research"]:::normal
  Project --> Build["Prototype & delivery"]:::normal
  Project --> Accept["Acceptance & handover"]:::normal`,
    workflow: `flowchart LR
  Draft["Draft the change"]:::normal --> Review{"Evidence complete?"}:::decision
  Review -->|Yes| Approve["Approve & baseline"]:::anchor
  Review -->|Revise| Draft
  Approve --> Deliver["Deliver & verify"]:::normal
  Deliver --> Close["Accept & close"]:::success`,
    gantt: `gantt
  dateFormat YYYY-MM-DD
  axisFormat %b %d
  todayMarker off
  section Scope
  Brief & research :brief, 2026-10-05, 2026-10-12
  section Delivery
  Prototype :prototype, 2026-10-12, 2026-10-23
  Verification :verification, 2026-10-19, 2026-10-28
  section Handover
  Pilot ready :milestone, pilot, 2026-10-29, 0d`,
    raci: JSON.stringify({schema: 'taskobo.table/v1', kind: 'raci', title: 'Atlas responsibilities',
      columns: [{key: 'work', label: 'Work', width: 180}, {key: 'lead', label: 'Lead', width: 115}, {key: 'team', label: 'Team', width: 115}],
      rows: [{work: 'Scope', lead: 'A/R', team: 'C'}, {work: 'Prototype', lead: 'A', team: 'R'}, {work: 'Release', lead: 'A/R', team: 'I'}]}, null, 2),
    architecture: `flowchart LR
  Core["@taskobo/diagrams"]:::anchor
  Core --> BuildA["Taskobo<br/>image build"]:::normal
  Core --> BuildB["DOCSKOBO<br/>image build"]:::normal
  BuildA --> BrowserA["Taskobo<br/>browser renderer"]:::neutral
  BuildB --> BrowserB["DOCSKOBO<br/>browser renderer"]:::neutral`,
  },
};
const descriptions = {
  wbs: ['Work breakdown', 'One outcome, three deliverables.'],
  workflow: ['Decision flow', 'A review loop keeps evidence ahead of approval.'],
  gantt: ['Delivery schedule', 'Work in time, with an explicit release milestone.'],
  raci: ['Responsibility matrix', 'Ownership is explicit; the supporting roles stay quiet.'],
  architecture: ['One source. Two independent deployments.', 'Each image bundles the same package; browser windows exchange source and profile.'],
};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha = content => createHash('sha256').update(content).digest('hex');
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'}[char]));
const b64svg = svg => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
const image = (chart, x, y, width, height) => `<image x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMin meet" href="${b64svg(chart.svg)}"/>`;
const svgStart = (width, height, title, description) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="figure-title figure-description"><title id="figure-title">${escape(title)}</title><desc id="figure-description">${escape(description)}</desc><rect width="100%" height="100%" fill="#FFFEFA"/><g font-family="Noto Sans JP, Yu Gothic, Meiryo, Arial, sans-serif" fill="#0D2046">`;

async function renderPage() {
  try {
    const [{default: mermaid}, core] = await Promise.all([import('/node_modules/mermaid/dist/mermaid.esm.mjs'), import('/src/index.mjs')]);
    const input = await (await fetch('/inputs')).json();
    const profile = core.createDiagramProfile(input.profileOptions);
    const charts = {};
    for (const [id, source] of Object.entries(input.sources)) {
      const packet = await core.renderDocument(source, profile.roles, profile.settings, {mermaid});
      if (!packet.width || !packet.height || !packet.svg.startsWith('<svg')) throw new Error(`Invalid ${id} output.`);
      charts[id] = {svg: packet.svg, width: packet.width, height: packet.height, type: packet.type};
    }
    window.__showcase = {ok: true, charts, profile, coreVersion: core.CORE_VERSION, mermaidVersion: core.MERMAID_VERSION};
  } catch (error) {window.__showcase = {ok: false, error: String(error.stack || error)};}
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/') {response.setHeader('content-type', 'text/html;charset=utf-8'); response.end(`<!doctype html><meta charset="utf-8"><title>Build Kobo Diagrams figures</title><script type="module">(${renderPage.toString()})();</script>`); return;}
    if (pathname === '/inputs') {response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(inputs)); return;}
    if (pathname.startsWith('/view/')) {
      const id = pathname.slice('/view/'.length);
      if (!/^[a-z-]+$/.test(id)) throw new Error('Invalid figure ID.');
      response.setHeader('content-type', 'text/html;charset=utf-8');
      response.end(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#FFFEFA}img{display:block}</style><img src="/docs/assets/${id}.svg" alt="Rendered figure">`);
      return;
    }
    if (!pathname.startsWith('/src/') && !pathname.startsWith('/node_modules/mermaid/dist/') && !pathname.startsWith('/docs/assets/')) {response.writeHead(404); response.end(); return;}
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) {response.writeHead(403); response.end(); return;}
    response.setHeader('content-type', file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.json') ? 'application/json' : 'text/javascript;charset=utf-8');
    response.end(await readFile(file));
  } catch {response.writeHead(404); response.end();}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const temporaryRoot = os.tmpdir();
const profileDirectory = await mkdtemp(path.join(temporaryRoot, 'kobo-showcase-'));
let child, socket, diagnostic = '';
const outputFiles = [];
try {
  child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profileDirectory}`, origin], {windowsHide: true, stdio: ['ignore', 'ignore', 'pipe']});
  child.stderr.on('data', chunk => {diagnostic = (diagnostic + chunk).slice(-3000);});
  child.on('error', error => {diagnostic = String(error);});
  let port;
  const launchDeadline = Date.now() + 20000;
  while (Date.now() < launchDeadline) {
    try {port = Number((await readFile(path.join(profileDirectory, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); if (port) break;} catch {}
    await delay(100);
  }
  if (!port) throw new Error('Browser did not start. ' + diagnostic);
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = pages.find(item => item.type === 'page' && item.url.startsWith(origin));
  if (!page) throw new Error('Generator page was not created.');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {socket.addEventListener('open', resolve, {once: true}); socket.addEventListener('error', reject, {once: true});});
  let serial = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) {const waiter = pending.get(message.id); pending.delete(message.id); message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result);}});
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {const id = ++serial; pending.set(id, {resolve, reject}); socket.send(JSON.stringify({id, method, params}));});
  const evaluate = async expression => {const result = await cdp('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result?.value;};
  let result;
  const renderDeadline = Date.now() + 60000;
  while (Date.now() < renderDeadline) {result = await evaluate('globalThis.__showcase ?? null'); if (result) break; await delay(150);}
  if (!result?.ok) throw new Error(result?.error || 'Rendering timed out.');
  const {charts} = result;
  const write = async (name, value) => {await writeFile(path.join(assets, name), value); outputFiles.push(name);};
  for (const [id, chart] of Object.entries(charts)) await write(`${id}.svg`, chart.svg + '\n');

  const hero = svgStart(1600, 960, 'Kobo Diagrams — a common language for project work', 'Actual package output: a four-node work breakdown, a dated delivery schedule and a three-row responsibility matrix. Fictional Atlas project data.') +
    '<text x="64" y="134" font-size="92" font-weight="800" letter-spacing="-3">Kobo Diagrams</text>' +
    '<text x="68" y="204" font-size="33" font-weight="500">A common language for project work.</text>' +
    '<text x="68" y="264" font-size="22" fill="#52637A">Mermaid rendering. Shared styles. Portable profiles.</text>' +
    image(charts.wbs, 830, 70, 700, 280) +
    '<path d="M64 390H1536" stroke="#D7DCE6"/>' +
    '<text x="68" y="450" font-size="30" font-weight="700">Plan the delivery.</text>' +
    image(charts.gantt, 48, 483, 890, 342) +
    '<text x="1010" y="450" font-size="30" font-weight="700">Make ownership clear.</text>' +
    image(charts.raci, 994, 482, 536, 400) +
    `<text x="68" y="910" font-size="19" fill="#52637A">Real renderer output · Mermaid ${escape(result.mermaidVersion)} · Fictional project data</text>` +
    '</g></svg>\n';
  await write('showcase.svg', hero);
  for (const [id, chart] of Object.entries(charts)) {
    const width = Math.max(900, Math.ceil(chart.width) + 96);
    const height = Math.ceil(chart.height) + 180;
    const [title, description] = descriptions[id];
    const figure = svgStart(width, height, title, `${description} Actual renderer output from fictional source.`) +
      `<text x="48" y="57" font-size="30" font-weight="700">${escape(title)}</text>` +
      `<text x="48" y="94" font-size="18" fill="#52637A">${escape(description)}</text>` +
      image(chart, 48, 128, width - 96, chart.height) + '</g></svg>\n';
    await write(`${id}-figure.svg`, figure);
    chart.figureWidth = width;
    chart.figureHeight = height;
  }
  const capture = async (id, width, height, description) => {
    await cdp('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
    await cdp('Page.navigate', {url: `${origin}/view/${id}`});
    for (let attempt = 0; attempt < 50; attempt++) {if (await evaluate(`location.pathname === ${JSON.stringify('/view/' + id)} && document.readyState === "complete" && document.images.length === 1 && [...document.images].every(image => image.complete && image.naturalWidth > 0)`)) break; await delay(100);}
    await evaluate('document.fonts.ready.then(() => true)');
    const shot = await cdp('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    const provenance = {description, generator: 'scripts/build-showcase.mjs', coreVersion: result.coreVersion, mermaidVersion: result.mermaidVersion, sourceSHA256: sha(JSON.stringify(inputs))};
    await write(`${id}.png`, pngText(Buffer.from(shot.data, 'base64'), provenance));
  };
  await capture('showcase', 1600, 960, 'Composite of actual package-rendered WBS, Gantt and RACI; no AI-generated imagery.');
  for (const [id, chart] of Object.entries(charts)) await capture(`${id}-figure`, chart.figureWidth, chart.figureHeight, `Actual ${id} output from the package browser renderer; fictional source data.`);
  await write('showcase-inputs.json', JSON.stringify({...inputs, profile: result.profile}, null, 2) + '\n');
  await write('showcase.html', `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kobo Diagrams — renderer gallery</title><style>html{background:#fffefa;color:#0d2046;font:18px/1.6 "Noto Sans JP","Yu Gothic",Meiryo,sans-serif}body{max-width:1500px;margin:auto;padding:24px}img{width:100%;height:auto;display:block}figure{margin:48px 0}a{color:#1456d9}figcaption{padding:12px 0;color:#52637a}h1{font-size:48px;letter-spacing:-.025em;margin:0}p{max-width:70ch}</style><h1>Kobo Diagrams</h1><p>Real renderer output, one shared profile. All Atlas project data is fictional. <a href="../gallery.md">Sources and reproduction</a></p><img src="showcase.svg" alt="Kobo Diagrams with real work breakdown, schedule and RACI examples">${Object.entries(descriptions).map(([id, [title, description]]) => `<figure><img src="${id}-figure.svg" alt="${escape(title + ': ' + description)}"><figcaption>${escape(description)} <a href="${id}.svg">Original SVG</a></figcaption></figure>`).join('')}</html>\n`);
  const manifest = {generator: 'scripts/build-showcase.mjs', renderer: {package: '@taskobo/diagrams', coreVersion: result.coreVersion, mermaidVersion: result.mermaidVersion}, inputsSHA256: sha(JSON.stringify(inputs)), files: {}};
  for (const name of [...outputFiles].sort()) manifest.files[name] = sha(await readFile(path.join(assets, name)));
  await writeFile(path.join(assets, 'showcase-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  process.stdout.write(`Built ${outputFiles.length + 1} showcase files from core ${result.coreVersion} / Mermaid ${result.mermaidVersion}.\n`);
} finally {
  socket?.close();
  if (child && child.exitCode === null) {const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill(); await Promise.race([stopped, delay(3000)]);}
  await new Promise(resolve => server.close(resolve));
  // Delete only the fresh browser profile created by this invocation.
  const resolvedProfile = path.resolve(profileDirectory);
  if (!resolvedProfile.startsWith(path.resolve(temporaryRoot) + path.sep) || !path.basename(resolvedProfile).startsWith('kobo-showcase-')) throw new Error('Refusing to remove an unexpected browser profile path.');
  await rm(resolvedProfile, {recursive: true, force: true, maxRetries: 3}).catch(() => {});
}

function pngText(buffer, provenance) {
  const data = Buffer.from('Description\0' + JSON.stringify(provenance), 'utf8');
  const type = Buffer.from('tEXt');
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  const end = buffer.length - 12;
  if (buffer.toString('ascii', end + 4, end + 8) !== 'IEND') throw new Error('Invalid browser PNG.');
  return Buffer.concat([buffer.subarray(0, end), length, type, data, checksum, buffer.subarray(end)]);
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) {crc ^= value; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);}
  return (crc ^ 0xffffffff) >>> 0;
}
