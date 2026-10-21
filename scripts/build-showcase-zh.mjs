#!/usr/bin/env node
/** Render the four Chinese case documents with the installed core and browser. */
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir, mkdtemp, rm, readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const caseDirectory = path.join(root, 'examples/project-case');
const assets = path.join(root, 'docs/assets/crm-case/zh-CN');
const qaDirectory = path.resolve(root, '../../output/kobo-diagrams-zh-qa');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--browser')) throw new Error('Use --browser <installed Chrome/Edge executable>.');
const browser = [args[1], process.env.CHROME_BIN, process.env.TASKOBO_CHROME_PATH,
  path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean).find(candidate => existsSync(candidate));
if (!browser) throw new Error('Install Chrome/Edge or pass --browser; this generator does not download a browser.');
if (!existsSync(path.join(root, 'node_modules/mermaid/dist/mermaid.esm.mjs'))) throw new Error('Run npm ci first.');
const caseManifest = JSON.parse(await readFile(path.join(caseDirectory, 'case-manifest.json'), 'utf8'));
const documents = [
  {id:'wbs', file:'wbs.mmd', title:'工作分解与验收', description:'将交付范围拆成可验收的工作包，逐项明确完成条件。'},
  {id:'raci', file:'raci.json', title:'责任分配矩阵', description:'明确每项工作的最终责任、执行与沟通角色。'},
  {id:'workflow', file:'change-control.mmd', title:'变更评估与决策', description:'保留评估、批准、阻止、独立验证与业务验收的关键分支。'},
  {id:'gantt', file:'schedule.mmd', title:'项目日程与进度', description:'区分基准、实际、预测与待批准的后续计划。'},
];
const sha = value => createHash('sha256').update(value).digest('hex');
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const inputs = {locale:'zh-CN', caseId:caseManifest.caseId, statusDate:caseManifest.statusDate, profileOptions:caseManifest.profileOptions, documents, sources:{}, rendererSourceSHA256:{}};
if (!inputs.profileOptions) throw new Error('The parent case manifest must provide profileOptions.');
for (const document of documents) inputs.sources[document.id] = await readFile(path.join(caseDirectory, 'zh-CN', document.file), 'utf8');
for (const file of (await readdir(path.join(root,'src'))).filter(file=>file.endsWith('.mjs')).sort()) inputs.rendererSourceSHA256[file] = sha(await readFile(path.join(root,'src',file)));
await mkdir(assets, {recursive:true});
await mkdir(qaDirectory, {recursive:true});
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));

async function renderPage() {
  try {
    const [{default:mermaid}, core] = await Promise.all([import('/node_modules/mermaid/dist/mermaid.esm.mjs'), import('/src/index.mjs')]);
    const input = await (await fetch('/inputs')).json();
    const profile = core.createDiagramProfile(input.profileOptions);
    const charts = {};
    for (const documentInput of input.documents) {
      const {id} = documentInput;
      const packet = await core.renderDocument(input.sources[id], profile.roles, profile.settings, {mermaid});
      const holder = document.createElement('div');
      holder.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none';
      holder.innerHTML = packet.svg;
      document.body.append(holder);
      await document.fonts.ready;
      const svg = holder.querySelector('svg');
      if (!svg || !packet.width || !packet.height) throw new Error(`Invalid ${id} output.`);
      // Presentation translation changes text only. All coordinates, paths,
      // cell colours, task states and dimensions stay as the core rendered them.
      const geometry = () => JSON.stringify([svg,...svg.querySelectorAll('*')].map(element=>[element.tagName,[...element.attributes].filter(attribute=>attribute.name!=='aria-label').map(attribute=>[attribute.name,attribute.value])]));
      const originalGeometry = geometry(), localization = [];
      const replaceText = (element, translated, selector) => {
        const original = element.textContent;
        const nodes = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) nodes.push(walker.currentNode);
        if (!nodes.length) throw new Error(`No text node in ${selector}`);
        nodes[0].data = translated;
        for (const node of nodes.slice(1)) node.data = '';
        localization.push({selector,original,translated});
      };
      if (id === 'raci') {
        const labels = {'A':'最终责任','R':'执行','C':'咨询','I':'告知','A/R':'最终与执行'};
        const legend = svg.querySelector('.raci-legend');
        if (!legend) throw new Error('RACI legend was not rendered.');
        legend.setAttribute('aria-label','责任编码与配色');
        const swatches = [...legend.querySelectorAll('rect[data-raci-role]')];
        if (swatches.length !== 5) throw new Error('Unexpected RACI legend structure.');
        for (const swatch of swatches) {
          const role = swatch.getAttribute('data-raci-role');
          const label = swatch.nextElementSibling?.nextElementSibling;
          if (!labels[role] || !label?.matches('text.legend')) throw new Error('Unexpected RACI legend label.');
          replaceText(label, labels[role], `.raci-legend [data-raci-role="${role}"] + text + text.legend`);
        }
      }
      if (id === 'gantt') {
        const lines = [
          '基准＝空心虚线　已完成实际＝填色实线　完成预测＝填色虚线（任务完整期间）',
          '风险色＝完成延误或已逾期　警示色＝未来预计延误或风险　强调色＝期限内预测　成功色＝按期完成',
          `差异＝实际／预测结束日 − 基准结束日（含周末和节假日的日历天）　状态日 ${input.statusDate}`,
          '计划草案＝浅色点线条　空心菱形＝待决事项或计划节点（未批准，并非实际完成）',
        ];
        const legend = [...svg.querySelectorAll('.taskobo-gantt-status-legend text')];
        if (legend.length !== lines.length) throw new Error('Unexpected schedule legend structure.');
        legend.forEach((element,index)=>replaceText(element,lines[index],`.taskobo-gantt-status-legend text:nth-child(${index+1})`));
        const replacements = [
          ['完了・遅延確定','已完成且确认延期'],['完了・期限内','已完成且按期'],['未完了・期限超過','未完成且已逾期'],
          ['将来の遅延見込み','未来预计延期'],['期限内予測・要注意','预计按期但需关注'],['期限内予測','预计按期'],
          ['基準終了','基准结束'],['実績終了','实际结束'],['予測終了','预测结束'],['暦日','日历天'],
          ['未承認の計画・判断予定','未批准的计划或待决事项'],[' から ',' 至 '],['集計基準日 ','状态日 '],
          ['日付目盛・下部の時間軸と同じ','日期刻度，与下方时间轴一致'],['、差 ','，差异 '],['、','，'],
        ];
        for (const element of svg.querySelectorAll('[aria-label]')) {
          let text = element.getAttribute('aria-label');
          for (const [original,translated] of replacements) text = text.replaceAll(original,translated);
          element.setAttribute('aria-label',text);
        }
      }
      if (id === 'workflow') {
        const labels = {alt:'分支',par:'并行',opt:'可选',loop:'循环',break:'中断',critical:'关键',option:'选项'};
        for (const text of svg.querySelectorAll('text')) {
          const original = text.textContent.trim();
          if (labels[original]) replaceText(text,labels[original],`text(${original})`);
        }
      }
      const geometryPreserved = originalGeometry === geometry();
      if (!geometryPreserved) throw new Error(`Presentation localization changed ${id} geometry.`);
      const visibleText = [...svg.querySelectorAll('text,foreignObject')].map(element=>element.textContent).join('\n');
      const untranslated = visibleText.match(/[\u3040-\u30ff]+|\b(?:Complete|Source|Columns|diagram|Baseline|Forecast|Business|Development|Sponsor)\b/g) || [];
      if (untranslated.length) throw new Error(`Untranslated visible ${id} labels: ${untranslated.join(', ')}`);
      const box = svg.viewBox.baseVal;
      const bounds = node => {
        const b = node.getBBox(), matrix = svg.getScreenCTM().inverse().multiply(node.getScreenCTM());
        const points = [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
        return {x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y))};
      };
      const overflow = [...svg.querySelectorAll('text')].map(element=>({text:element.textContent.trim(),...bounds(element)})).filter(b=>b.text&&(b.x<box.x-2||b.y<box.y-2||b.right>box.x+box.width+2||b.bottom>box.y+box.height+2));
      charts[id] = {svg:svg.outerHTML, width:packet.width, height:packet.height, type:packet.type, localization, geometryPreserved, overflow};
      holder.remove();
    }
    window.__showcase = {ok:true, charts, profile, coreVersion:core.CORE_VERSION, mermaidVersion:core.MERMAID_VERSION};
  } catch (error) {window.__showcase = {ok:false,error:String(error.stack||error)};}
}

const server = createServer(async (request,response)=>{
  try {
    const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if (pathname === '/') {response.setHeader('content-type','text/html;charset=utf-8');response.end(`<!doctype html><meta charset="utf-8"><script type="module">(${renderPage.toString()})();</script>`);return;}
    if (pathname === '/inputs') {response.setHeader('content-type','application/json');response.end(JSON.stringify(inputs));return;}
    if (pathname.startsWith('/view/')) {
      const id = pathname.slice('/view/'.length);
      if (!/^(wbs|raci|workflow|gantt)-figure$/.test(id)) throw new Error('Invalid figure.');
      response.setHeader('content-type','text/html;charset=utf-8');
      response.end(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#FFFEFA}img{display:block}</style><img src="/docs/assets/crm-case/zh-CN/${id}.svg" alt="项目图表">`);return;
    }
    if (!pathname.startsWith('/src/')&&!pathname.startsWith('/node_modules/mermaid/dist/')&&!pathname.startsWith('/docs/assets/')) {response.writeHead(404);response.end();return;}
    const file = path.resolve(root,'.'+pathname);
    if (!file.startsWith(root+path.sep)) {response.writeHead(403);response.end();return;}
    response.setHeader('content-type',file.endsWith('.svg')?'image/svg+xml':file.endsWith('.html')?'text/html;charset=utf-8':file.endsWith('.png')?'image/png':file.endsWith('.json')?'application/json':'text/javascript;charset=utf-8');
    response.end(await readFile(file));
  } catch {response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const temporaryRoot = os.tmpdir(), profileDirectory = await mkdtemp(path.join(temporaryRoot,'kobo-showcase-zh-'));
let child, socket, diagnostic = '';
const files = [];
try {
  child = spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profileDirectory}`,origin],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  child.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk).slice(-3000);});
  child.on('error',error=>{diagnostic=String(error);});
  let port;
  const launchDeadline = Date.now()+20000;
  while(Date.now()<launchDeadline){try{port=Number((await readFile(path.join(profileDirectory,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}await delay(100);}
  if(!port)throw new Error('Browser did not start. '+diagnostic);
  const pages = await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = pages.find(item=>item.type==='page'&&item.url.startsWith(origin));
  if(!page)throw new Error('Generator page was not created.');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let serial=0;
  const pending = new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const waiter=pending.get(message.id);pending.delete(message.id);message.error?waiter.reject(new Error(JSON.stringify(message.error))):waiter.resolve(message.result);}});
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result?.value;};
  let result;
  const renderDeadline=Date.now()+60000;
  while(Date.now()<renderDeadline){result=await evaluate('globalThis.__showcase??null');if(result)break;await delay(150);}
  if(!result?.ok)throw new Error(result?.error||'Rendering timed out.');
  const write=async(name,value)=>{await writeFile(path.join(assets,name),value);files.push(name);};
  const inputHash=sha(JSON.stringify(inputs));
  const measurements=[];
  const statusDate=inputs.statusDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1年$2月$3日');
  for(const document of documents){
    const {id,title}=document,chart=result.charts[id];
    await write(`${id}.svg`,chart.svg+'\n');
    const width=Math.max(1000,Math.ceil(chart.width)+80),height=Math.ceil(chart.height)+170;
    if(width*height>70_000_000||width>16000||height>24000)throw new Error(`${id} exceeds safe complete PNG dimensions.`);
    const figure=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="figure-title figure-description"><title id="figure-title">${escape(title)}</title><desc id="figure-description">${escape(document.description)}</desc><rect width="100%" height="100%" fill="#FFFEFA"/><g font-family="Microsoft YaHei, Noto Sans JP, Yu Gothic, Meiryo, sans-serif" fill="#0D2046"><text x="40" y="49" font-size="32" font-weight="700">${escape(title)}</text><text x="40" y="86" font-size="19" fill="#52637A">客户服务系统导入｜虚构项目示例｜状态日${statusDate}</text><image x="40" y="120" width="${width-80}" height="${chart.height}" preserveAspectRatio="xMidYMin meet" href="data:image/svg+xml;base64,${Buffer.from(chart.svg).toString('base64')}"/></g></svg>\n`;
    await write(`${id}-figure.svg`,figure);
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await cdp('Page.navigate',{url:`${origin}/view/${id}-figure`});
    let loaded=false;
    for(let attempt=0;attempt<50;attempt++){loaded=await evaluate(`location.pathname==='/view/${id}-figure'&&document.readyState==='complete'&&document.images.length===1&&document.images[0].complete&&document.images[0].naturalWidth>0`);if(loaded)break;await delay(100);}
    if(!loaded)throw new Error(`Figure failed to load: ${id}`);
    await evaluate('document.fonts.ready.then(()=>true)');
    const screenshot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await write(`${id}-figure.png`,pngText(Buffer.from(screenshot.data,'base64'),{generator:'scripts/build-showcase-zh.mjs',locale:'zh-CN',coreVersion:result.coreVersion,mermaidVersion:result.mermaidVersion,inputsSHA256:inputHash}));
    measurements.push({id,title,sourceFile:`examples/project-case/zh-CN/${document.file}`,sourceSHA256:sha(inputs.sources[id]),width:chart.width,height:chart.height,figure:{width,height},geometryPreserved:chart.geometryPreserved,localization:chart.localization,overflow:chart.overflow});
  }
  await write('inputs.json',JSON.stringify({...inputs,profile:result.profile},null,2)+'\n');
  await write('showcase.html',galleryHtml(documents,statusDate));
  const layouts=[];
  for(const[name,width,height]of[['desktop',1440,1080],['mobile',390,844]]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:name==='mobile'});
    await cdp('Page.navigate',{url:`${origin}/docs/assets/crm-case/zh-CN/showcase.html`});
    let loaded=false;
    for(let attempt=0;attempt<50;attempt++){loaded=await evaluate('location.pathname.endsWith("/zh-CN/showcase.html")&&document.readyState==="complete"&&[...document.images].every(image=>image.complete&&image.naturalWidth>0)');if(loaded)break;await delay(100);}
    if(!loaded)throw new Error('Chinese gallery images failed to load.');
    const metrics=await evaluate('({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,images:document.images.length,sections:document.querySelectorAll("main section").length})');
    if(metrics.documentWidth>width||metrics.images!==4||metrics.sections!==4)throw new Error(`Gallery ${name} layout failed.`);
    layouts.push({name,width,height,...metrics});
    const screenshot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(path.join(qaDirectory,`${name}.png`),Buffer.from(screenshot.data,'base64'));
  }
  const manifest={generator:'scripts/build-showcase-zh.mjs',locale:'zh-CN',caseId:inputs.caseId,statusDate:inputs.statusDate,renderer:{coreVersion:result.coreVersion,mermaidVersion:result.mermaidVersion,sourceSHA256:inputs.rendererSourceSHA256},inputsSHA256:inputHash,presentationLocalization:'Text and accessible labels only; original geometry, colours, state and dates retained.',documents:measurements,layouts,files:{}};
  for(const file of files.sort())manifest.files[file]=sha(await readFile(path.join(assets,file)));
  await writeFile(path.join(assets,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  process.stdout.write(JSON.stringify({built:files.length+1,coreVersion:result.coreVersion,mermaidVersion:result.mermaidVersion,documents:measurements.map(({id,width,height,figure,overflow})=>({id,width,height,figure,overflow})),qaDirectory})+'\n');
} finally {
  socket?.close();
  if(child&&child.exitCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill();await Promise.race([stopped,delay(3000)]);}
  await new Promise(resolve=>server.close(resolve));
  const resolved=path.resolve(profileDirectory);
  if(!resolved.startsWith(path.resolve(temporaryRoot)+path.sep)||!path.basename(resolved).startsWith('kobo-showcase-zh-'))throw new Error('Unexpected browser profile path.');
  await rm(resolved,{recursive:true,force:true,maxRetries:3}).catch(()=>{});
}

function galleryHtml(documents,statusDate){
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>项目图表示例</title><style>:root{color-scheme:light;background:#fffefa;color:#0d2046;font:18px/1.7 "Microsoft YaHei","Noto Sans JP",sans-serif}*{box-sizing:border-box}body{max-width:1400px;margin:auto;padding:28px 44px 64px}a{color:#1456d9;text-underline-offset:4px}a:focus-visible{outline:3px solid #c64c38;outline-offset:4px}h1{font-size:36px;line-height:1.3;margin:0 0 12px}h2{font-size:29px;line-height:1.4;margin:0 0 10px}p{max-width:60ch;margin:10px 0}.note,.links{color:#52637a;font-size:16px}nav,.links{display:flex;gap:10px 24px;flex-wrap:wrap}nav{border-bottom:1px solid #d7dce6;padding:18px 0;margin:20px 0 36px}section+section{border-top:1px solid #d7dce6;padding-top:32px;margin-top:48px}figure{margin:20px 0 12px}figure img{display:block;width:100%;height:auto}@media(max-width:700px){body{padding:20px 18px 40px}h1{font-size:29px}h2{font-size:25px}section+section{margin-top:36px;padding-top:28px}}</style><h1>项目图表示例</h1><p class="note">客户服务系统导入｜虚构项目示例｜状态日${escape(statusDate)}</p><nav aria-label="图表类型">${documents.map(document=>`<a href="#${document.id}">${escape(document.title)}</a>`).join('')}</nav><main>${documents.map(document=>`<section id="${document.id}"><h2>${escape(document.title)}</h2><p>${escape(document.description)}</p><figure><a href="${document.id}.svg"><img src="${document.id}-figure.png" alt="${escape(document.title)}完整图"></a></figure><p class="links"><a href="${document.id}.svg">查看矢量图</a><a href="${document.id}-figure.png">查看完整图片</a><a href="../../../../examples/project-case/zh-CN/${document.file}">查看源文件</a></p></section>`).join('')}</main></html>\n`;
}
function pngText(buffer,metadata){
  const data=Buffer.from('Description\0'+JSON.stringify(metadata),'utf8'),type=Buffer.from('tEXt'),length=Buffer.alloc(4),checksum=Buffer.alloc(4);
  length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([type,data])));
  const end=buffer.length-12;
  if(buffer.toString('ascii',end+4,end+8)!=='IEND')throw new Error('Invalid browser PNG.');
  return Buffer.concat([buffer.subarray(0,end),length,type,data,checksum,buffer.subarray(end)]);
}
function crc32(buffer){let crc=0xffffffff;for(const value of buffer){crc^=value;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
