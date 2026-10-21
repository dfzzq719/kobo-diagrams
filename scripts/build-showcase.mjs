#!/usr/bin/env node
/** Rebuild real renderer figures. Requires npm ci and an installed Chrome/Edge. */
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir, mkdtemp, rm, readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'docs/assets/crm-case');
const caseDirectory = path.join(root, 'examples/project-case');
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

const caseManifest = JSON.parse(await readFile(path.join(caseDirectory, 'case-manifest.json'), 'utf8'));
if (!Array.isArray(caseManifest.documents)) throw new Error('The case manifest needs documents[].');
const documents = caseManifest.documents;
const inputs = {caseManifest, profileOptions: caseManifest.profileOptions ?? {
  settings: {fontSize: 18, density: 'comfortable', curve: 'basis'},
  standard: {name: 'CRM project case standard', version: '1.0'},
}, sources: {}};
if (typeof caseManifest.scenario === 'string') {
  const scenarioFile = path.resolve(caseDirectory,caseManifest.scenario);
  if (!scenarioFile.startsWith(caseDirectory+path.sep)) throw new Error('Scenario must stay in the case directory.');
  inputs.scenario = JSON.parse(await readFile(scenarioFile,'utf8'));
}
const assetStems = new Set();
for (const document of documents) {
  if (!/^[a-z][a-z0-9-]*$/.test(document.id) || typeof document.file !== 'string') throw new Error('Invalid document ID or file.');
  const stem = assetStem(document);
  if (assetStems.has(stem)) throw new Error(`Duplicate asset basename: ${stem}`);
  assetStems.add(stem);
  const file = path.resolve(caseDirectory, document.file);
  if (!file.startsWith(caseDirectory + path.sep)) throw new Error('Case source must stay in examples/project-case.');
  inputs.sources[document.id] = await readFile(file, 'utf8');
}
for (const id of ['wbs', 'workflow', 'gantt', 'raci', 'risk', 'issues']) if (!inputs.sources[id]) throw new Error(`Missing full case document: ${id}`);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha = content => createHash('sha256').update(content).digest('hex');
inputs.rendererSourceSHA256 = {};
for (const file of (await readdir(path.join(root,'src'))).filter(file=>file.endsWith('.mjs')).sort()) inputs.rendererSourceSHA256[file]=sha(await readFile(path.join(root,'src',file)));
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
      const holder = document.createElement('div');
      holder.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none';
      holder.innerHTML = packet.svg;
      document.body.append(holder);
      await document.fonts.ready;
      const root = holder.querySelector('svg');
      const normalize = value => String(value).replace(/\s+/g, ' ').trim();
      const bounds = node => {
        const box = node.getBBox(), matrix = root.getScreenCTM().inverse().multiply(node.getScreenCTM());
        const points = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]].map(([x,y]) => new DOMPoint(x,y).matrixTransform(matrix));
        const xs = points.map(point => point.x), ys = points.map(point => point.y);
        return {x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs)-Math.min(...xs), height: Math.max(...ys)-Math.min(...ys)};
      };
      const labels = [...root.querySelectorAll('text')].map(node => ({text: normalize(node.textContent), id: node.id, ...bounds(node)})).filter(item => item.text);
      const nodes = [...root.querySelectorAll('.node,rect.task')].map(node => ({text: normalize(node.textContent), id: node.id, ...bounds(node)}));
      const clusters = [...root.querySelectorAll('g.cluster')].map(node=>({text:normalize(node.textContent),id:node.id,...bounds(node)}));
      const actors = [...root.querySelectorAll('rect.actor-top')].map(node=>({id:node.getAttribute('name'),...bounds(node)}));
      const axisLabels = [...root.querySelectorAll('.tick text')].map(node=>({text:normalize(node.textContent),...bounds(node)})).filter(label=>label.text);
      const box = root.viewBox.baseVal;
      let table;
      if (packet.type === 'document-table') {
        const cells = [...root.querySelectorAll('rect')].map(node => ({x:Number(node.getAttribute('x')),y:Number(node.getAttribute('y')),width:Number(node.getAttribute('width')),height:Number(node.getAttribute('height'))})).filter(cell => cell.x>=24 && cell.y>=80 && cell.width>=115 && cell.width<=330 && cell.height>0);
        const columns = cells.filter(cell => cell.y === 80).sort((a,b)=>a.x-b.x);
        const first = columns[0];
        const rows = cells.filter(cell => cell.x === first.x && cell.width === first.width && cell.y>80).sort((a,b)=>a.y-b.y);
        table = {columns,rows,header:{x:first.x,y:80,width:columns.reduce((sum,column)=>sum+column.width,0),height:first.height}};
      }
      charts[id] = {svg: packet.svg, width: packet.width, height: packet.height, type: packet.type, viewBox: {x:box.x,y:box.y,width:box.width,height:box.height}, labels, nodes, clusters, actors, axisLabels, ...(table ? {table} : {})};
      holder.remove();
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
      response.end(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#FFFEFA}img{display:block}</style><img src="/docs/assets/crm-case/${id}.svg" alt="Rendered figure">`);
      return;
    }
    if (!pathname.startsWith('/src/') && !pathname.startsWith('/node_modules/mermaid/dist/') && !pathname.startsWith('/docs/assets/')) {response.writeHead(404); response.end(); return;}
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) {response.writeHead(403); response.end(); return;}
    response.setHeader('content-type', file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.html') ? 'text/html;charset=utf-8' : file.endsWith('.png') ? 'image/png' : file.endsWith('.json') ? 'application/json' : 'text/javascript;charset=utf-8');
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
  const viewports = {};
  for (const document of documents) {
    const {id} = document, chart = charts[id], stem = assetStem(document);
    await write(`${stem}.svg`, chart.svg + '\n');
    const width = Math.max(1000, Math.ceil(chart.width) + 80);
    const height = Math.ceil(chart.height) + 190;
    if (width * height > 70_000_000 || width > 16000 || height > 24000) throw new Error(`${id} exceeds a safe full PNG size. The full SVG is retained; review an explicit tiled export instead of shrinking away content.`);
    const figure = svgStart(width, height, `${document.title} — complete diagram`, 'The complete source is rendered without removing tasks, rows, roles or branches.') +
      `<text x="40" y="51" font-size="30" font-weight="700">${escape(document.title)} · Complete diagram</text>` +
      `<text x="40" y="89" font-size="19" fill="#52637A">${escape(countsText(document.counts))} · Status ${escape(caseManifest.statusDate)} · Fictional CRM case</text>` +
      image(chart, 40, 130, width - 80, chart.height) + '</g></svg>\n';
    await write(`${stem}-figure.svg`, figure);
    chart.figureWidth = width; chart.figureHeight = height;
    const crop = selectViewport(chart, document);
    viewports[id] = crop;
    chart.crop = crop;
    chart.detailSvg = cropSvg(chart.svg, crop);
    const detail = detailFigure(chart,document,crop);
    await write(`${stem}-detail.svg`, detail.svg);
    chart.detailWidth = detail.width; chart.detailHeight = detail.height;
  }

  const status = escape(caseManifest.statusDate);
  const matrixCounts = documents.find(document => document.id === 'raci').counts;
  const wbsCounts=documents.find(document=>document.id==='wbs').counts, scheduleCounts=documents.find(document=>document.id==='gantt').counts, riskCounts=documents.find(document=>document.id==='risk').counts, issueCounts=documents.find(document=>document.id==='issues').counts;
  const ganttDoc = documents.find(document=>document.id==='gantt');
  const ganttDetail = detailFigure(charts.gantt,ganttDoc,viewports.gantt);
  const rollback = charts.raci.table.rows[viewports.raci.sourceRows.last-1];
  const rollbackHeader = charts.raci.table.header;
  const rollbackBody = {x:rollbackHeader.x,y:rollback.y,width:rollbackHeader.width,height:rollback.height};
  const heroWidth = 1800, innerWidth = 1704;
  const ganttHeight = Math.ceil(innerWidth*ganttDetail.height/ganttDetail.width);
  const raciY = 192+ganttHeight+55;
  const raciHeaderHeight = innerWidth*rollbackHeader.height/rollbackHeader.width;
  const raciBodyHeight = innerWidth*rollbackBody.height/rollbackBody.width;
  const heroHeight = Math.ceil(raciY+100+raciHeaderHeight+9+raciBodyHeight+74);
  const hero = svgStart(heroWidth,heroHeight,'Kobo Diagrams — complete CRM case, readable schedule and emergency authority','Detail viewports of the unchanged full case SVGs. The full six-document case is available separately.')+
    '<text x="48" y="71" font-size="52" font-weight="800" letter-spacing="-1.5">Kobo Diagrams</text>'+
    `<text x="1752" y="65" text-anchor="end" font-size="22" fill="#52637A">CRM rollout · ${status}</text>`+
    `<text x="48" y="124" font-size="25">Complete case: ${wbsCounts.workPackages} work packages · ${scheduleCounts.totalEntries} schedule entries · ${matrixCounts.responsibilityRows} × ${matrixCounts.roles} RACI · ${riskCounts.risks} risks · ${issueCounts.issues} issues</text>`+
    '<path d="M48 160H1752" stroke="#D7DCE6"/>'+
    image({svg:ganttDetail.svg},48,192,innerWidth,ganttHeight)+
    `<text x="48" y="${raciY+26}" font-size="30" font-weight="700">Emergency rollback · RACI-${String(viewports.raci.sourceRows.last).padStart(2,'0')} detail</text>`+
    `<text x="48" y="${raciY+65}" font-size="21" fill="#52637A">Original activity row + original header · all ${matrixCounts.roles} roles · complete ${matrixCounts.responsibilityRows} × ${matrixCounts.roles} matrix available</text>`+
    image({svg:cropSvg(charts.raci.svg,rollbackHeader)},48,raciY+100,innerWidth,raciHeaderHeight)+
    image({svg:cropSvg(charts.raci.svg,rollbackBody)},48,raciY+109+raciHeaderHeight,innerWidth,raciBodyHeight)+
    `<text x="48" y="${heroHeight-27}" font-size="19" fill="#52637A">Actual renderer output · labelled source viewports · Full SVG + PNG for every complete case document in the gallery.</text></g></svg>\n`;
  await write('showcase.svg',hero);
  const mobileHeight=Math.ceil(heroHeight*780/heroWidth);
  const mobile=hero.replace(`width="${heroWidth}" height="${heroHeight}"`,`width="780" height="${mobileHeight}"`);
  await write('showcase-mobile.svg',mobile);
  const capture = async (id, width, height, description) => {
    await cdp('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false});
    await cdp('Page.navigate', {url: `${origin}/view/${id}`});
    for (let attempt = 0; attempt < 50; attempt++) {if (await evaluate(`location.pathname === ${JSON.stringify('/view/' + id)} && document.readyState === "complete" && document.images.length === 1 && [...document.images].every(image => image.complete && image.naturalWidth > 0)`)) break; await delay(100);}
    await evaluate('document.fonts.ready.then(() => true)');
    const shot = await cdp('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
    const provenance = {description, generator: 'scripts/build-showcase.mjs', coreVersion: result.coreVersion, mermaidVersion: result.mermaidVersion, sourceSHA256: sha(JSON.stringify(inputs))};
    await write(`${id}.png`, pngText(Buffer.from(shot.data, 'base64'), provenance));
  };
  await capture('showcase', heroWidth, heroHeight, 'Complete CRM case: real schedule and scope/responsibility viewports plus full matrix overview.');
  await capture('showcase-mobile', 780, mobileHeight, 'Mobile composition of actual full-case SVG viewports.');
  for (const document of documents) {
    const {id} = document, chart = charts[id], stem = assetStem(document);
    await capture(`${stem}-figure`, chart.figureWidth, chart.figureHeight, `Complete ${id} diagram. No task, row, role or branch removed from the committed CRM case source.`);
    await capture(`${stem}-detail`, chart.detailWidth, chart.detailHeight, `A labelled viewBox crop of the complete ${id} SVG. No simplified replacement source.`);
  }
  await write('inputs.json', JSON.stringify({...inputs, profile: result.profile}, null, 2) + '\n');
  await write('showcase.html', galleryHtml(documents, caseManifest));
  const qa = {renderer: {coreVersion: result.coreVersion, mermaidVersion: result.mermaidVersion}, caseId: caseManifest.caseId, statusDate: caseManifest.statusDate, documents: documents.map(document => ({id:document.id, assetStem:assetStem(document), sourceFile:document.file, sourceSHA256:sha(inputs.sources[document.id]), width:charts[document.id].width, height:charts[document.id].height, counts:document.counts, detail:viewports[document.id]})), layouts: []};
  for (const [name, width, height] of [['desktop', 1440, 1080], ['mobile', 390, 844]]) {
    await cdp('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile:name === 'mobile'});
    await cdp('Page.navigate', {url:`${origin}/docs/assets/crm-case/showcase.html`});
    for (let attempt = 0; attempt < 50; attempt++) {if (await evaluate('location.pathname.endsWith("showcase.html") && document.readyState === "complete" && [...document.images].every(image => image.complete && image.naturalWidth > 0)')) break; await delay(100);}
    const metrics = await evaluate('({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,figures:document.querySelectorAll("section.case-document").length,fullLinks:document.querySelectorAll("a.full-svg").length,details:document.querySelectorAll("img.detail").length})');
    const shot = await cdp('Page.captureScreenshot', {format:'png',captureBeyondViewport:false});
    await write(`qa-${name}.png`, pngText(Buffer.from(shot.data,'base64'), {description:`${name} gallery verification capture`,generator:'scripts/build-showcase.mjs',inputSHA256:sha(JSON.stringify(inputs))}));
    qa.layouts.push({name,width,height,...metrics});
    if (metrics.documentWidth > width || metrics.figures !== 4 || metrics.fullLinks !== 4 || metrics.details !== 0) throw new Error(`Gallery ${name} layout/coverage verification failed.`);
  }
  await write('qa.json', JSON.stringify(qa,null,2)+'\n');
  const manifest = {generator: 'scripts/build-showcase.mjs', caseId:caseManifest.caseId, statusDate:caseManifest.statusDate, renderer: {package: '@taskobo/diagrams', coreVersion: result.coreVersion, mermaidVersion: result.mermaidVersion,sourceSHA256:inputs.rendererSourceSHA256}, inputsSHA256: sha(JSON.stringify(inputs)), viewports,heroViewports:{gantt:viewports.gantt,raci:{sourceRow:viewports.raci.sourceRows.last,headerViewBox:rollbackHeader,bodyViewBox:rollbackBody}}, files: {}};
  for (const name of [...outputFiles].sort()) manifest.files[name] = sha(await readFile(path.join(assets, name)));
  await writeFile(path.join(assets, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
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

function countsText(counts = {}) {
  return Object.entries(counts).map(([key,value]) => `${value} ${key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').toLowerCase()}`).join(' · ');
}
function normalized(value) {return String(value).replace(/<[^>]*>/g,'').replace(/\s+/g,'').toLowerCase();}
function union(boxes) {
  const x = Math.min(...boxes.map(box => box.x)), y = Math.min(...boxes.map(box => box.y));
  return {x,y,width:Math.max(...boxes.map(box => box.x+box.width))-x,height:Math.max(...boxes.map(box => box.y+box.height))-y};
}
function viewportAt(chart, centerX, centerY, requestedWidth, requestedHeight) {
  const full = chart.viewBox;
  const width = Math.min(requestedWidth, full.width), height = Math.min(requestedHeight,full.height);
  const x = Math.max(full.x,Math.min(centerX-width/2,full.x+full.width-width));
  const y = Math.max(full.y,Math.min(centerY-height/2,full.y+full.height-height));
  return {x:Math.round(x*100)/100,y:Math.round(y*100)/100,width:Math.round(width*100)/100,height:Math.round(height*100)/100};
}
function selectViewport(chart, document) {
  const focusLabels = document.detail?.focusLabels ?? [];
  const matches = chart.labels.filter(label => focusLabels.some(focus => normalized(label.text).includes(normalized(focus))));
  if (!matches.length) throw new Error(`No rendered focus label matched ${document.id}; update manifest focusLabels instead of silently selecting a random crop.`);
  if (document.id === 'wbs') {
    const group=chart.clusters.find(cluster=>normalized(cluster.text).includes(normalized(focusLabels[0])));
    if (!group) throw new Error('The full WBS G3 cluster could not be located.');
    return {...viewportAt(chart,group.x+group.width/2,group.y+group.height/2,group.width+20,group.height+20),focusLabels,matchedLabels:matches.map(match=>match.text),method:'Complete G3 cluster boundary, including its actual three work-package leaves; no adjacent group or root fragment'};
  }
  if (document.id === 'workflow') {
    const preferred=focusLabels.slice(0,2).map(focus=>chart.labels.find(label=>normalized(label.text).includes(normalized(focus)))).filter(Boolean);
    if(preferred.length!==2) throw new Error('Both safety-blocker focus labels are required.');
    const box=union(preferred), actors=chart.actors.filter(actor=>actor.x+actor.width>=box.x-30 && actor.x<=box.x+box.width+30);
    const context=union(actors);
    const x=Math.min(box.x-30,context.x-15),right=Math.max(box.x+box.width+30,context.x+context.width+15);
    return {x,y:box.y-28,width:right-x,height:box.height+60,contextAnnotation:'Information Management Lead → Project Manager (PM)',focusLabels,matchedLabels:preferred.map(label=>label.text),method:'Unchanged original information-management blocking branch and arrow; participant names are a separate figure-context annotation, not redrawn actor boxes'};
  }
  if (document.id === 'gantt') {
    const match=inputs.sources.gantt.match(/^\s*%%\s*taskobo-gantt-status\s+(\{[^\n]+\})/m);
    const status=JSON.parse(match[1]);
    const items=status.items.filter(item=>{
      const label=chart.labels.find(label=>label.id===`${item.current}-text` || label.id.endsWith(`-${item.current}-text`));
      return label && focusLabels.some(focus=>normalized(label.text).includes(normalized(focus)));
    });
    if(items.length!==2) throw new Error('Exactly the API and migration baseline/current pairs are required.');
    const sections=focusLabels.filter(focus=>focus.startsWith('Trial')).map(focus=>chart.labels.find(label=>normalized(label.text).includes(normalized(focus))));
    const bands=items.map((item,index)=>{
      const selected=[item.baseline,item.current].flatMap(id=>[chart.nodes.find(node=>node.id===id || node.id.endsWith(`-${id}`)),chart.labels.find(label=>label.id===`${id}-text` || label.id.endsWith(`-${id}-text`))]).filter(Boolean);
      const box=union(selected), section=sections[index];
      if(!section) throw new Error('Gantt section context is missing.');
      return {ids:[item.baseline,item.current],box,contextViewBox:{x:chart.viewBox.x,y:section.y-10,width:Math.max(720,section.x+section.width+20-chart.viewBox.x),height:section.height+20}};
    });
    const ticks=chart.axisLabels;
    if(!ticks.length) throw new Error('The real Gantt date axis was not found.');
    const topY=Math.min(...ticks.map(tick=>tick.y)),axis=ticks.filter(tick=>tick.y<topY+40);
    const selectedBox=union(bands.map(band=>band.box));
    const start=Math.min(...axis.map(tick=>tick.x));
    const endTick=axis.filter(tick=>tick.x+tick.width>selectedBox.x+selectedBox.width+20).sort((a,b)=>a.x-b.x)[0] || axis.at(-1);
    const right=Math.max(selectedBox.x+selectedBox.width+20,endTick.x+endTick.width+12);
    const axisBox=union(axis.filter(tick=>tick.x>=start && tick.x+tick.width<=right));
    const axisViewBox={x:start-12,y:axisBox.y-7,width:right-start+12,height:axisBox.height+14};
    for(const band of bands) band.bodyViewBox={x:axisViewBox.x,y:band.box.y-10,width:axisViewBox.width,height:band.box.height+20};
    return {x:axisViewBox.x,y:selectedBox.y-10,width:axisViewBox.width,height:selectedBox.height+20,bands,axisViewBox,focusLabels,matchedLabels:matches.map(match=>match.text),method:'API and migration pairs only; original section strips and original, aligned date-axis viewport repeat for each unchanged row band; no sentence truncation'};
  }
  if (chart.table) {
    const table = chart.table;
    const rowIndexes = [...new Set(matches.map(match => table.rows.findIndex(row => match.y+match.height/2 >= row.y && match.y+match.height/2 <= row.y+row.height)).filter(index=>index>=0))].sort((a,b)=>a-b);
    if (!rowIndexes.length) throw new Error(`No table row geometry matched ${document.id}.`);
    const firstRow = rowIndexes[0], lastRow = rowIndexes.at(-1);
    const first = table.rows[firstRow], last = table.rows[lastRow];
    const panels = balancedColumnGroups(table.columns);
    for (const panel of panels) {
      panel.headerViewBox={x:panel.x,y:table.header.y,width:panel.width,height:table.header.height};
      panel.bodyViewBox={x:panel.x,y:first.y,width:panel.width,height:last.y+last.height-first.y};
    }
    const data=JSON.parse(inputs.sources[document.id]),key=data.columns[0].key;
    const sourceIds=data.rows.slice(firstRow,lastRow+1).map(row=>String(row[key]).match(/^(?:RACI|RISK|ISSUE)-\d+/)?.[0]).filter(Boolean);
    return {x:table.header.x,y:first.y,width:table.header.width,height:last.y+last.height-first.y,focusLabels,matchedLabels:matches.map(match=>match.text),sourceRows:{first:firstRow+1,last:lastRow+1},sourceIds,panels,method:'Original SVG header and the same complete source rows, grouped at actual column boundaries; no rebuilt table and no omitted columns'};
  }
  const enriched = [...matches];
  for (const match of matches) {
    const node = chart.nodes.find(node => (match.id && node.id === match.id.replace(/-text$/,'')) || normalized(node.text) === normalized(match.text));
    if (node) enriched.push(node);
  }
  let bounds = union(enriched);
  const width = document.id === 'gantt' ? 980 : 880;
  if (bounds.width > width || bounds.height > 760) {
    const first = enriched[0];
    bounds = {x:first.x,y:first.y,width:first.width,height:first.height};
  }
  const table = document.kind === 'table';
  const height = document.id === 'gantt' ? 500 : Math.max(420,Math.min(680,bounds.height+140));
  const centerX = table ? chart.viewBox.x + width/2 : bounds.x+bounds.width/2;
  let centerY = bounds.y+bounds.height/2;
  // Keep the actual table header for early-row details; late rows remain explicit viewports.
  if (table && bounds.y < height-100) centerY = chart.viewBox.y+height/2;
  const result = viewportAt(chart,centerX,centerY,width,height);
  return {...result,focusLabels,matchedLabels:matches.map(match => match.text),method:'viewBox crop of the complete SVG; source content unchanged'};
}
function svgHeading(text, x, y, fontSize=30, limit=70) {
  const lines = [];
  for (const word of String(text).split(/\s+/)) {
    if (!lines.length || lines.at(-1).length+word.length+1>limit) lines.push(word);
    else lines[lines.length-1]+=' '+word;
  }
  return {svg:`<text x="${x}" y="${y}" font-size="${fontSize}" font-weight="700">${lines.map((line,index)=>`<tspan x="${x}" dy="${index ? fontSize*1.25 : 0}">${escape(line)}</tspan>`).join('')}</text>`,height:lines.length*fontSize*1.25};
}
function detailFigure(chart,document,viewport) {
  const width = 1200, available = width-96;
  const heading = svgHeading(`${document.title} · Detail`,48,48,29,66);
  const top = 48+heading.height+62;
  let content = heading.svg+`<text x="48" y="${top-28}" font-size="20" fill="#52637A">Same complete SVG · enlarged viewport${viewport.panels ? 's' : ''} · full diagram available</text>`;
  let y = top;
  if (viewport.bands) {
    for (const band of viewport.bands) {
      const contextHeight=available*band.contextViewBox.height/band.contextViewBox.width;
      const axisHeight=available*viewport.axisViewBox.height/viewport.axisViewBox.width;
      const bodyHeight=available*band.bodyViewBox.height/band.bodyViewBox.width;
      content+=image({svg:cropSvg(chart.svg,band.contextViewBox)},48,y,available,contextHeight);
      y+=contextHeight+16;
      content+=image({svg:cropSvg(chart.svg,viewport.axisViewBox)},48,y,available,axisHeight);
      y+=axisHeight+8;
      content+=image({svg:cropSvg(chart.svg,band.bodyViewBox)},48,y,available,bodyHeight);
      y+=bodyHeight+50;
    }
  } else if (viewport.panels) {
    for (const panel of viewport.panels) {
      const scale=available/panel.width;
      const headerHeight=panel.headerViewBox.height*scale,bodyHeight=panel.bodyViewBox.height*scale;
      content+=`<text x="48" y="${y+25}" font-size="22" font-weight="600">${viewport.sourceIds?.length ? escape(viewport.sourceIds.join(' / ')) : `Source rows ${viewport.sourceRows.first}–${viewport.sourceRows.last}`} · Columns ${panel.firstColumn}–${panel.lastColumn}</text>`;
      content+=image({svg:cropSvg(chart.svg,panel.headerViewBox)},48,y+42,available,headerHeight);
      content+=image({svg:cropSvg(chart.svg,panel.bodyViewBox)},48,y+42+headerHeight+9,available,bodyHeight);
      y+=42+headerHeight+9+bodyHeight+54;
    }
  } else {
    if(viewport.contextAnnotation) {
      content+=`<text x="48" y="${y+29}" font-size="24" font-weight="600">${escape(viewport.contextAnnotation)}</text>`;
      y+=64;
    }
    if(viewport.headerViewBox) {
      const headerHeight=available*viewport.headerViewBox.height/viewport.headerViewBox.width;
      content+=image({svg:cropSvg(chart.svg,viewport.headerViewBox)},48,y,available,headerHeight);
      y+=headerHeight+22;
    }
    const height=available*viewport.height/viewport.width;
    content+=image({svg:cropSvg(chart.svg,viewport)},48,y,available,height);
    y+=height+42;
  }
  const height=Math.ceil(y+60);
  content+=`<text x="48" y="${height-28}" font-size="18" fill="#52637A">Full SVG: ${escape(assetStem(document))}.svg · Source: examples/project-case/${escape(document.file)}</text>`;
  return {width,height,svg:svgStart(width,height,`${document.title} — detail of complete diagram`,viewport.method)+content+'</g></svg>\n'};
}
function balancedColumnGroups(columns) {
  const total=columns.reduce((sum,column)=>sum+column.width,0),groups=Math.ceil(total/900),target=total/groups;
  let best,score=Infinity;
  const visit=(start,remaining,parts)=>{
    if(remaining===1){
      const last=columns.slice(start),width=last.reduce((sum,column)=>sum+column.width,0);
      const all=[...parts,{x:last[0].x,width,firstColumn:start+1,lastColumn:columns.length}];
      const value=all.reduce((sum,part)=>sum+(part.width-target)**2+Math.max(0,part.width-1050)**2*10,0);
      if(value<score){score=value;best=all;}return;
    }
    let width=0;
    for(let end=start;end<=columns.length-remaining;end++){
      width+=columns[end].width;
      visit(end+1,remaining-1,[...parts,{x:columns[start].x,width,firstColumn:start+1,lastColumn:end+1}]);
    }
  };
  visit(0,groups,[]);return best;
}
function tighterViewport(chart, viewport, width, height) {
  return viewportAt(chart,viewport.x+viewport.width/2,viewport.y+viewport.height/2,width,height);
}
function cropSvg(svg, viewport) {
  const opening = svg.match(/^<svg\b[^>]*>/)?.[0];
  if (!opening) throw new Error('SVG root was not found for a source-preserving crop.');
  const full = opening.match(/\bviewBox="([^"]+)"/)?.[1].trim().split(/[\s,]+/).map(Number);
  if (!full || full.length !== 4 || full.some(value=>!Number.isFinite(value))) throw new Error('Original SVG has no usable viewBox.');
  // Keep the original SVG bytes intact inside an isolated image document. Only
  // this outer viewBox changes, so percentage dimensions and scoped CSS inside
  // the original render retain their complete-document geometry.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${viewport.width}" height="${viewport.height}" viewBox="${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}" role="img"><title>Detail viewport of the unchanged complete SVG</title><image x="${full[0]}" y="${full[1]}" width="${full[2]}" height="${full[3]}" href="${b64svg(svg)}"/></svg>`;
}
function assetStem(document) {
  const stem = document.assetStem ?? document.id;
  if (typeof stem !== 'string' || !/^[a-z][a-z0-9-]*$/.test(stem)) throw new Error('Invalid asset basename.');
  return stem;
}
function galleryHtml(documents, manifest) {
  const categories = new Map([['wbs', 'WBS'], ['raci', 'RACI'], ['workflow', 'Change-control flow'], ['gantt', 'Schedule']]);
  const galleryDocuments = [...categories.keys()].map(id => documents.find(document => document.id === id));
  if (galleryDocuments.some(document => !document)) throw new Error('The gallery needs WBS, RACI, workflow and schedule documents.');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kobo Diagrams — CRM delivery diagrams</title><style>
  :root{color-scheme:light;background:#fffefa;color:#0d2046;font:18px/1.6 "Noto Sans JP","Yu Gothic",Meiryo,sans-serif}*{box-sizing:border-box}body{max-width:1400px;margin:auto;padding:28px 44px 64px}a{color:#1456d9;text-underline-offset:4px}a:focus-visible{outline:3px solid #c64c38;outline-offset:4px}::selection{background:#1456d9;color:#fff}h1{font-size:38px;line-height:1.2;letter-spacing:-.025em;margin:0 0 12px}h2{font-size:30px;line-height:1.3;margin:0 0 10px}p{max-width:78ch;margin:10px 0}.source-note,.figure-links{color:#52637a;font-size:16px}nav{display:flex;gap:12px 24px;flex-wrap:wrap;border-bottom:1px solid #d7dce6;padding:18px 0;margin:20px 0 36px}section.case-document+section.case-document{border-top:1px solid #d7dce6;padding-top:32px;margin-top:48px}figure{margin:20px 0 12px}.full-view img{display:block;width:100%;height:auto}.figure-links{display:flex;gap:8px 20px;flex-wrap:wrap}@media(max-width:700px){body{padding:20px 18px 40px}h1{font-size:30px}h2{font-size:25px}section.case-document+section.case-document{margin-top:36px;padding-top:28px}}
  </style><h1>CRM delivery diagrams</h1><p class="source-note">Fictional case · Status ${escape(manifest.statusDate)} · <a href="../../gallery.md">Documentation</a></p><nav aria-label="Diagram types">${galleryDocuments.map(document => `<a href="#${document.id}">${categories.get(document.id)}</a>`).join('')}</nav><main>${galleryDocuments.map(document => {
    const stem = assetStem(document);
    return `<section class="case-document" id="${document.id}"><h2>${categories.get(document.id)}</h2><p>${escape(document.description || document.question || '')}</p><figure class="full-view"><a href="${stem}.svg"><img src="${stem}-figure.png" alt="Complete ${escape(document.title)}"></a></figure><p class="figure-links"><a class="full-svg" href="${stem}.svg">Full SVG</a><a href="${stem}-figure.png">Full PNG</a><a href="../../../examples/project-case/${escape(document.file)}">Source</a><a href="${stem}-detail.png">Detail crop</a></p></section>`;
  }).join('')}</main></html>\n`;
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

