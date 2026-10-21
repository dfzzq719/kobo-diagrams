#!/usr/bin/env node
// Uses an installed Chrome/Edge and Node's CDP WebSocket. No browser downloads.
import {createServer} from 'node:http';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const args = process.argv.slice(2);
const options = {};
for (let index = 0; index < args.length; index++) {
  if (!['--browser', '--output'].includes(args[index]) || !args[index + 1]) throw new Error('Use --browser <installed executable> or --output <report.json>.');
  options[args[index].slice(2)] = args[++index];
}
const browsers = [options.browser, process.env.CHROME_BIN, process.env.TASKOBO_CHROME_PATH,
  path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe') : null,
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean);
const browser = browsers.find(candidate => existsSync(candidate));
if (!browser) throw new Error('Install Chrome or Edge, or pass --browser. This test does not download a browser.');
if (!existsSync(path.join(root, 'node_modules/mermaid/dist/mermaid.esm.min.mjs'))) throw new Error('Run npm ci in the package directory first.');

async function pageTest() {
  try {
    const {default: mermaid} = await import('/node_modules/mermaid/dist/mermaid.esm.min.mjs');
    const {CORE_VERSION, MERMAID_VERSION, DIAGRAM_CATALOG, PRESETS, DEFAULT_SETTINGS, createDiagramProfile,
      validateDiagramProfile, createMermaidRenderer, renderDocument, renderDiagram, svgToPng} = await import('/src/index.mjs');
    const report = {coreVersion: CORE_VERSION, engineVersion: MERMAID_VERSION, cases: [], errors: []};
    const check = (value, message) => {if (!value) throw new Error(message);};
    const inspect = packet => {
      const parsed = new DOMParser().parseFromString(packet.svg, 'image/svg+xml');
      check(!parsed.querySelector('parsererror'), 'Malformed SVG');
      check(packet.width > 0 && packet.height > 0, 'Missing SVG dimensions');
      check(parsed.querySelector('svg'), 'Missing SVG root');
      return {width: packet.width, height: packet.height, textNodes: parsed.querySelectorAll('text').length};
    };
    const profile = validateDiagramProfile(JSON.parse(JSON.stringify(createDiagramProfile({roles: PRESETS[0].roles, settings: DEFAULT_SETTINGS}))));
    let gantt;
    for (const example of DIAGRAM_CATALOG) {
      try {
        const packet = await renderDocument(example.source, profile.roles, profile.settings, {mermaid});
        report.cases.push({id: example.id, ...inspect(packet)});
        if (example.id === 'gantt') gantt = packet;
      } catch (error) {report.errors.push({id: example.id, error: String(error.stack || error)});}
    }
    try {
      const source = JSON.stringify({schema: 'taskobo.table/v1', kind: 'raci', title: 'Responsibility example', columns: [{key: 'work'}, {key: 'owner'}, {key: 'team'}], rows: [{work: 'Review <scope>', owner: 'A', team: 'R'}]});
      const packet = await renderDocument(source, profile.roles, profile.settings, {mermaid});
      report.cases.push({id: 'raci-table', ...inspect(packet)});
      check(packet.svg.includes('&lt;scope&gt;'), 'Table text was not escaped');
    } catch (error) {report.errors.push({id: 'raci-table', error: String(error.stack || error)});}
    try {
      check(gantt, 'Gantt rendering failed before PNG export');
      const blob = await svgToPng(gantt);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      check(blob.type === 'image/png' && bytes.length > 100 && bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10', 'Invalid PNG output');
      report.cases.push({id: 'gantt-png', bytes: bytes.length});
    } catch (error) {report.errors.push({id: 'gantt-png', error: String(error.stack || error)});}
    try {
      const renderer = createMermaidRenderer(mermaid);
      // Same engine, simultaneous callers and different policies/themes.
      const [plain, enterprise] = await Promise.all([
        renderer.render('flowchart TD\n A[Plain] --> B[Editor]', {config: {theme: 'dark', look: 'handDrawn', securityLevel: 'loose', htmlLabels: true}, id: 'plain-smoke'}),
        renderDiagram('flowchart LR\n A[Enterprise] --> B[Profile]', profile.roles, profile.settings, {mermaid}),
      ]);
      check(plain.svg.includes('Plain'), 'Ordinary Mermaid lost its content');
      check(enterprise.theme.layout === 'dagre' && enterprise.theme.look === 'classic', 'Enterprise layout policy changed');
      report.cases.push({id: 'shared-engine-concurrency', ...inspect(enterprise)});
    } catch (error) {report.errors.push({id: 'shared-engine-concurrency', error: String(error.stack || error)});}
    const manifestResponse = await fetch('/examples/project-case/case-manifest.json');
    check(manifestResponse.ok, 'Complete project-case manifest is missing');
    const projectCase = await manifestResponse.json();
    check(projectCase.documents?.length === 6, 'Expected all six linked project documents');
    const caseProfile = createDiagramProfile(projectCase.profileOptions || {});
    for (const document of projectCase.documents) {
      try {
        check(/^[a-z][a-z-]*\.(?:mmd|json)$/.test(document.file), 'Invalid case source filename');
        const response = await fetch('/examples/project-case/' + document.file);
        check(response.ok, 'Project source is missing');
        const source = await response.text();
        const packet = await renderDocument(source, caseProfile.roles, caseProfile.settings, {mermaid});
        const detail = inspect(packet);
        if (document.id === 'raci') {
          const svg = new DOMParser().parseFromString(packet.svg, 'image/svg+xml');
          check(svg.querySelectorAll('[data-raci-role]').length === 117, 'The full 14 × 8 RACI or five-role legend was reduced');
        }
        report.cases.push({id: 'project-case-' + document.id, ...detail});
      } catch (error) {report.errors.push({id: 'project-case-' + document.id, error: String(error.stack || error)});}
    }
    report.ok = report.errors.length === 0 && report.cases.length === DIAGRAM_CATALOG.length + 3 + projectCase.documents.length;
    window.__koboSmoke = report;
  } catch (error) {window.__koboSmoke = {ok: false, error: String(error.stack || error)};}
}

const html = `<!doctype html><meta charset="utf-8"><title>Kobo diagrams browser smoke</title><script type="module">(${pageTest.toString()})();</script>`;
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/') {response.setHeader('content-type', 'text/html;charset=utf-8'); response.end(html); return;}
    if (!pathname.startsWith('/src/') && !pathname.startsWith('/node_modules/mermaid/dist/') && !pathname.startsWith('/examples/project-case/')) {response.writeHead(404); response.end(); return;}
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) {response.writeHead(403); response.end(); return;}
    response.setHeader('content-type', file.endsWith('.json') ? 'application/json' : file.endsWith('.mmd') ? 'text/plain;charset=utf-8' : 'text/javascript;charset=utf-8');
    response.end(await readFile(file));
  } catch {response.writeHead(404); response.end();}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const profile = await mkdtemp(path.join(os.tmpdir(), 'kobo-diagrams-smoke-'));
let processHandle, socket;
let stderr = '';
try {
  processHandle = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, url], {windowsHide: true, stdio: ['ignore', 'ignore', 'pipe']});
  processHandle.stderr.on('data', chunk => {stderr = (stderr + chunk).slice(-3000);});
  processHandle.on('error', error => {stderr = String(error);});
  let port;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); if (port) break;} catch {}
    await delay(100);
  }
  if (!port) throw new Error('Browser CDP did not start. ' + stderr);
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = pages.find(item => item.type === 'page' && item.url.startsWith(url));
  if (!page) throw new Error('Smoke test browser page was not created.');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {socket.addEventListener('open', resolve, {once: true}); socket.addEventListener('error', reject, {once: true});});
  let serial = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) {const {resolve, reject} = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);}});
  const cdp = (method, params) => new Promise((resolve, reject) => {const id = ++serial; pending.set(id, {resolve, reject}); socket.send(JSON.stringify({id, method, params}));});
  let report;
  const renderDeadline = Date.now() + 90000;
  while (Date.now() < renderDeadline) {
    const result = await cdp('Runtime.evaluate', {expression: 'globalThis.__koboSmoke ?? null', returnByValue: true});
    report = result.result?.value;
    if (report) break;
    await delay(150);
  }
  if (!report) throw new Error('Browser render timed out. ' + stderr);
  const output = JSON.stringify(report, null, 2) + '\n';
  if (options.output) await writeFile(path.resolve(options.output), output);
  process.stdout.write(output);
  if (!report.ok) process.exitCode = 1;
} finally {
  socket?.close();
  if (processHandle && processHandle.exitCode === null) {
    const stopped = new Promise(resolve => processHandle.once('exit', resolve));
    processHandle.kill();
    await Promise.race([stopped, delay(3000)]);
  }
  await new Promise(resolve => server.close(resolve));
  // Only remove the fresh, explicitly bounded test profile created above.
  if (path.dirname(path.resolve(profile)) !== path.resolve(os.tmpdir()) || !path.basename(profile).startsWith('kobo-diagrams-smoke-')) throw new Error('Refusing to remove an unexpected browser profile path.');
  await rm(profile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
}
