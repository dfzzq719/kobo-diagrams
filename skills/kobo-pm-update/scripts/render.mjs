#!/usr/bin/env node
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,rm,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {validateProject} from './project.mjs';
import {projectViews,projectSummary,reviewPage} from './view-model.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const textBytes=bytes=>Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const usage=`Kobo PM 中文项目更新包\n需要 Node.js 22.12+ 与本机已安装 Chrome/Edge；不会下载依赖或浏览器。\n\nnode scripts/render.mjs --doctor [--browser <浏览器路径>]\nnode scripts/render.mjs --verify [--out <已有更新包目录>]\nnode scripts/render.mjs --project <项目.json> --out <全新目录> [--review <审阅.json>] [--browser <浏览器路径>]\n\n--review 生成候选预览，明确标记尚未确认；不会覆盖项目输入。\n`;

function argumentsFor(argv){
  const args={};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];
    if(['--verify','--doctor','--help'].includes(key)){args[key.slice(2)]=true;continue;}
    if(!['--project','--review','--out','--browser'].includes(key)||!argv[i+1]||argv[i+1].startsWith('--'))throw new Error('未知或缺少值的参数：'+key+'。使用 --help 查看用法。');
    if(args[key.slice(2)])throw new Error('重复参数：'+key);
    args[key.slice(2)]=argv[++i];
  }
  return args;
}

function requireNode(){
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major<22||(major===22&&minor<12)||typeof WebSocket!=='function')throw new Error('需要 Node.js 22.12 或更新版本，含原生 WebSocket；请使用已安装的兼容 Node.js。');
}

async function verifyRuntime(){
  const runtime=path.join(ROOT,'assets/runtime'),bytes=textBytes(await readFile(path.join(runtime,'manifest.json'))),manifest=JSON.parse(bytes);
  if(manifest.schema!=='kobo.pm-runtime/v1'||manifest.coreVersion!=='0.1.2'||manifest.mermaidVersion!=='12.2.0')throw new Error('随包图表 runtime 版本不兼容。请重新安装完整 Skill。');
  const required=['core/index.mjs','core/version.mjs','core/profile.mjs','core/document-renderer.mjs','core/diagram-renderer.mjs','mermaid.min.js','LICENSE','NOTICE','mermaid-LICENSE.txt'];
  if(required.some(name=>!manifest.fileSHA256?.[name]))throw new Error('runtime manifest 缺少必要文件。');
  for(const [name,expected]of Object.entries(manifest.fileSHA256)){
    const file=path.resolve(runtime,name);
    if(!file.startsWith(runtime+path.sep)||!/^[a-f0-9]{64}$/.test(expected))throw new Error('runtime manifest 包含非法路径或哈希。');
    if(sha(textBytes(await readFile(file)))!==expected)throw new Error('runtime 完整性校验失败：'+name+'。请重新安装完整 Skill。');
  }
  return {manifest,manifestSHA256:sha(bytes)};
}

async function findBrowser(explicit){
  const candidates=explicit?[path.resolve(explicit)]:[
    process.env.KOBO_CHROME_PATH,process.env.CHROME_BIN,process.env.TASKOBO_CHROME_PATH,
    path.join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.PROGRAMFILES||'C:/Program Files','Microsoft/Edge/Application/msedge.exe'),
    process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/microsoft-edge'
  ].filter(Boolean);
  for(const file of candidates){try{if((await stat(file)).isFile())return file;}catch{}}
  throw new Error('找不到本机 Chrome/Edge。请用 --browser 指定已安装浏览器的绝对路径；脚本不会下载安装。');
}

async function connectCDP(url){
  const socket=new WebSocket(url),pending=new Map(),listeners=new Set();let serial=0;
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',()=>reject(new Error('无法连接本机浏览器调试端口。')),{once:true});});
  socket.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data));
    if(message.id){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);}
    else for(const listener of listeners)listener(message);
  });
  socket.addEventListener('close',()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(new Error('本机浏览器连接已关闭。'));}pending.clear();});
  return {
    send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('浏览器调用超时：'+method));},180000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});},
    wait(method,sessionId){return new Promise((resolve,reject)=>{const listener=message=>{if(message.method===method&&message.sessionId===sessionId){clearTimeout(timer);listeners.delete(listener);resolve(message.params);}};const timer=setTimeout(()=>{listeners.delete(listener);reject(new Error('本机页面加载超时。'));},45000);listeners.add(listener);});},
    close(){socket.close();}
  };
}

async function render(sources,statusDate,browser){
  const token=randomBytes(24).toString('hex'),tempRoot=await mkdtemp(path.join(os.tmpdir(),'kobo-pm-render-'));
  let child,cdp,server;
  try{
    const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8'};
    server=createServer(async(request,response)=>{
      try{
        if(request.method!=='GET'){response.writeHead(405);response.end();return;}
        const url=new URL(request.url,'http://127.0.0.1');
        if(url.pathname==='/job.json'){
          if(url.searchParams.get('token')!==token){response.writeHead(403);response.end();return;}
          response.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify({sources,statusDate}));return;
        }
        const relative=decodeURIComponent(url.pathname).replace(/^\//,'');
        const target=path.resolve(ROOT,relative);
        if(!relative.startsWith('assets/')||!target.startsWith(path.join(ROOT,'assets')+path.sep)||!mime[path.extname(target)]){response.writeHead(404);response.end();return;}
        const bytes=await readFile(target);
        response.writeHead(200,{'Content-Type':mime[path.extname(target)],'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'none'"});response.end(bytes);
      }catch{response.writeHead(404);response.end();}
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const url=`http://127.0.0.1:${server.address().port}/assets/runner.html?token=${token}`;
    child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-extensions','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+tempRoot,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    let browserError='';child.stderr.on('data',data=>{browserError=(browserError+data.toString()).slice(-2000);});child.on('error',error=>{browserError=error.message;});
    const devtools=path.join(tempRoot,'DevToolsActivePort');let endpoint='';
    for(let attempt=0;attempt<150;attempt++){
      if(child.exitCode!==null||browserError.startsWith('spawn '))throw new Error('浏览器启动失败：'+browserError);
      try{const [port,route]=(await readFile(devtools,'utf8')).trim().split(/\r?\n/);if(port&&route){endpoint=`ws://127.0.0.1:${port}${route}`;break;}}catch{}
      await delay(100);
    }
    if(!endpoint)throw new Error('浏览器启动超时。请确认本机允许 Chrome/Edge 无头模式运行。');
    cdp=await connectCDP(endpoint);
    const version=await cdp.send('Browser.getVersion');
    const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'}),{sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
    await cdp.send('Runtime.enable',{},sessionId);await cdp.send('Page.enable',{},sessionId);
    const loaded=cdp.wait('Page.loadEventFired',sessionId);await cdp.send('Page.navigate',{url},sessionId);await loaded;
    const result=await cdp.send('Runtime.evaluate',{expression:'window.__koboCompletion',awaitPromise:true,returnByValue:true},sessionId);
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.text||'本机页面执行失败。');
    const packet=result.result?.value;
    if(!packet?.ok)throw new Error(packet?.error||'出图任务没有返回有效结果。');
    return {...packet,browserVersion:{product:version.product,revision:version.revision,jsVersion:version.jsVersion}};
  }finally{
    if(cdp){await cdp.send('Browser.close').catch(()=>{});cdp.close();}
    if(child&&child.exitCode===null){await delay(350);if(child.exitCode===null)child.kill();}
    if(server)await new Promise(resolve=>server.close(resolve));
    const resolved=path.resolve(tempRoot),prefix=path.resolve(os.tmpdir())+path.sep+'kobo-pm-render-';
    // Only the newly-created browser profile belonging to this call is removed.
    if(resolved.startsWith(prefix))await rm(resolved,{recursive:true,force:true,maxRetries:6,retryDelay:250}).catch(()=>{});
  }
}

async function verifyOutput(directory){
  const root=path.resolve(directory),report=JSON.parse(await readFile(path.join(root,'report.json'),'utf8'));
  if(report.schema!=='kobo.pm-render-report/v1'||!Object.keys(report.fileSHA256||{}).length)throw new Error('输出目录缺少有效的生成报告。');
  for(const [name,expected]of Object.entries(report.fileSHA256)){
    const file=path.resolve(root,name);
    if(!file.startsWith(root+path.sep)||sha(await readFile(file))!==expected)throw new Error('输出校验失败：'+name);
  }
  return {directory:root,checkedFiles:Object.keys(report.fileSHA256).length,mode:report.mode};
}

async function main(){
  const args=argumentsFor(process.argv.slice(2));
  if(args.help){console.log(usage);return;}
  requireNode();const {manifest,manifestSHA256}=await verifyRuntime();
  if(args.verify){const output=args.out?await verifyOutput(args.out):undefined;console.log(JSON.stringify({verified:true,message:'runtime 完整性校验通过。',coreVersion:manifest.coreVersion,mermaidVersion:manifest.mermaidVersion,checkedFiles:Object.keys(manifest.fileSHA256).length,output},null,2));return;}
  const browser=await findBrowser(args.browser);
  if(args.doctor){console.log(JSON.stringify({ready:true,message:'Node.js、图表 runtime 与本机浏览器路径检查通过。',nodeVersion:process.version,browser,coreVersion:manifest.coreVersion,mermaidVersion:manifest.mermaidVersion,note:'运行出图会实际启动浏览器；不下载依赖、不调用额外 AI API。'},null,2));return;}
  if(!args.project||!args.out)throw new Error('请提供 --project 和 --out。使用 --help 查看用法。');
  const input=path.resolve(args.project),out=path.resolve(args.out);
  if(existsSync(out))throw new Error('输出路径已经存在。请为 --out 选择一个全新目录；不会覆盖现有文件。');
  if(input===out)throw new Error('输出路径不能覆盖项目输入。');
  const projectBytes=await readFile(input),original=validateProject(JSON.parse(projectBytes.toString('utf8').replace(/^\uFEFF/,'')));
  let project=original,review=null,reviewBytes=null;
  if(args.review){
    reviewBytes=await readFile(path.resolve(args.review));review=JSON.parse(reviewBytes.toString('utf8').replace(/^\uFEFF/,''));
    if(review.schema!=='kobo.pm-review/v1'||review.projectId!==original.id||!Array.isArray(review.changes)||!review.candidateProject)throw new Error('审阅文件格式不兼容，或与输入项目不匹配。');
    project=validateProject(review.candidateProject);
    if(project.id!==original.id)throw new Error('候选版本不能替换项目身份。');
  }
  const sources=projectViews(project),packet=await render(sources,project.statusDate,browser);
  const files={};
  for(const [id,source]of Object.entries(sources))files['sources/'+id+(id==='raci'?'.json':'.mmd')]=Buffer.from(source);
  const charts={};
  for(const id of ['wbs','raci','schedule']){
    const chart=packet.charts[id];if(!chart)throw new Error('缺少图表：'+id);
    const png=Buffer.from(chart.pngBase64,'base64');
    if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('PNG 文件校验失败：'+id);
    files[id+'.svg']=Buffer.from(chart.svg);files[id+'.png']=png;
    charts[id]={width:chart.width,height:chart.height,type:chart.type,notes:chart.notes};
  }
  files['project.snapshot.json']=Buffer.from(JSON.stringify(project,null,2)+'\n');
  if(review)files['review.snapshot.json']=Buffer.from(JSON.stringify(review,null,2)+'\n');
  files['profile.json']=Buffer.from(JSON.stringify(packet.profile,null,2)+'\n');
  files['review.html']=Buffer.from(reviewPage(project,{candidate:!!review,review}));
  const report={schema:'kobo.pm-render-report/v1',mode:review?'candidate-preview':'project-snapshot',projectId:project.id,statusDate:project.statusDate,updateId:review?.updateId||null,inputSHA256:sha(projectBytes),reviewInputSHA256:reviewBytes?sha(reviewBytes):null,coreVersion:packet.coreVersion,mermaidVersion:packet.mermaidVersion,runtimeManifestSHA256:manifestSHA256,summary:projectSummary(project),charts,browserVersion:packet.browserVersion,nodeVersion:process.version,fontNote:'字体由本机字体栈解析；跨系统像素可能不同。',fileSHA256:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,sha(bytes)]))};
  // Claim the directory atomically, after all validation and rendering succeed.
  await mkdir(path.dirname(out),{recursive:true});await mkdir(out);
  try{
    for(const [name,bytes]of Object.entries(files)){const file=path.join(out,name);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes,{flag:'wx'});}
    await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  }catch(error){throw new Error('输出写入未完成：'+error.message+'；请检查目录并选择全新输出路径重试。');}
  console.log(JSON.stringify({output:out,page:path.join(out,'review.html'),mode:report.mode,projectId:project.id,statusDate:project.statusDate,charts,files:Object.keys(files).length+1},null,2));
}
main().catch(error=>{console.error('Kobo PM：'+error.message);process.exitCode=1;});
