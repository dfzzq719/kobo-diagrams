#!/usr/bin/env node
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,stat} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {validateProject} from './project.mjs';
import {projectSummary,reviewPage} from './view-model.mjs';
import {planViews} from './view-plan.mjs';
import {sha,verifyOutput,beginOutput} from './output.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const textBytes=bytes=>Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const usage=`Taskobo Diagrams 中文项目更新包
Node.js 22.12+；图形渲染需要已安装的 Chrome/Edge，不下载浏览器。

node scripts/render.mjs --doctor [--browser <路径>]
node scripts/render.mjs --verify [--out <已有更新包>]
node scripts/render.mjs --project <项目.json> --out <目录> [--review <审阅.json>]
  [--force] [--format all|svg|sources] [--page-size 1..20]
  [--group <分组ID>] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
  [--browser <路径>] [--timeout <每图毫秒，1000..300000>]

默认每组每页 12 项；责任矩阵每页最多 8 个角色，完整责任仍合并校验。
--force 仅刷新本工具生成且无手工修改或额外文件的目录；失败不替换已有结果。
--format sources 只导出源文件和审阅页，无需浏览器；未验证图形渲染。
退出码：0 完整成功；2 部分失败（保留源文件、有效 SVG 与诊断）；1 输入或环境错误。
`;
function argumentsFor(argv){
  const args={};
  for(let i=0;i<argv.length;i++){
    const key=argv[i],name=key.slice(2);
    if(Object.hasOwn(args,name))throw new Error('重复参数：'+key);
    if(['--verify','--doctor','--help','--force'].includes(key)){args[name]=true;continue;}
    if(!['--project','--review','--out','--browser','--format','--page-size','--group','--from','--to','--timeout'].includes(key)||!argv[i+1]||argv[i+1].startsWith('--'))throw new Error('未知或缺少值的参数：'+key+'；运行 --help 查看用法。');
    args[name]=argv[++i];
  }
  if(args.format&&!['all','svg','sources'].includes(args.format))throw new Error('--format 必须是 all、svg 或 sources。');
  args.timeout=Number(args.timeout||180000);
  if(!Number.isInteger(args.timeout)||args.timeout<1000||args.timeout>300000)throw new Error('--timeout 必须是 1000–300000 毫秒。');
  return args;
}
function requireNode(){
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major<22||(major===22&&minor<12)||typeof WebSocket!=='function')throw new Error('需要 Node.js 22.12 或更新版本，含原生 WebSocket；请使用已安装的兼容 Node.js。');
}

async function verifyRuntime(){
  const runtime=path.join(ROOT,'assets/runtime'),bytes=textBytes(await readFile(path.join(runtime,'manifest.json'))),manifest=JSON.parse(bytes);
  if(manifest.schema!=='kobo.pm-runtime/v1'||manifest.coreVersion!=='0.1.3'||manifest.mermaidVersion!=='12.2.0')throw new Error('随包图表 runtime 版本不兼容。请重新安装完整 Skill。');
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


export async function connectCDP(url){
  const socket=new WebSocket(url),pending=new Map(),listeners=new Set(),waits=new Set();let serial=0;
  const disconnected=()=>Object.assign(new Error('浏览器连接中断；请查看 diagnostics.json 的退出状态与日志，或缩小 --page-size 并重试。'),{code:'BROWSER_DISCONNECTED'});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.close();reject(Object.assign(new Error('连接浏览器调试端口超时。'),{code:'BROWSER_CONNECT_TIMEOUT'}));},10000);
    socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
    socket.addEventListener('error',()=>{clearTimeout(timer);reject(disconnected());},{once:true});
  });
  const fail=()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(disconnected());}pending.clear();for(const item of [...waits])item.fail(disconnected());};
  socket.addEventListener('close',fail);socket.addEventListener('error',fail);
  socket.addEventListener('message',event=>{
    let message;try{message=JSON.parse(String(event.data));}catch{return;}
    if(message.id){const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);}
    else for(const listener of [...listeners])listener(message);
  });
  return {
    get open(){return socket.readyState===WebSocket.OPEN;},
    on(listener){listeners.add(listener);},
    send(method,params={},sessionId,timeout=180000){
      if(socket.readyState!==WebSocket.OPEN)return Promise.reject(disconnected());
      return new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(Object.assign(new Error('浏览器调用超时：'+method+'；可缩小 --page-size 或用 --format svg 重试。'),{code:'BROWSER_CALL_TIMEOUT'}));},timeout);pending.set(id,{resolve,reject,timer});try{socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));}catch(error){clearTimeout(timer);pending.delete(id);reject(error);}});
    },
    wait(method,sessionId){if(socket.readyState!==WebSocket.OPEN)return Promise.reject(disconnected());return new Promise((resolve,reject)=>{
      const item={fail(error){clearTimeout(timer);listeners.delete(listener);waits.delete(item);reject(error);}};
      const listener=message=>{if(message.method===method&&message.sessionId===sessionId){clearTimeout(timer);listeners.delete(listener);waits.delete(item);resolve(message.params);}};
      const timer=setTimeout(()=>item.fail(Object.assign(new Error('本机页面加载超时。'),{code:'BROWSER_PAGE_TIMEOUT'})),45000);listeners.add(listener);waits.add(item);
    });},
    close(){socket.close();}
  };
}
async function render(jobs,statusDate,browser,format,timeout,onChart,diagnostics){
  const tempRoot=await mkdtemp(path.join(os.tmpdir(),'kobo-pm-render-'));
  let child,cdp,server,active=null;
  const results={};
  try{
    const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8'};
    server=createServer(async(request,response)=>{
      try{
        if(request.method!=='GET'){response.writeHead(405);response.end();return;}
        const relative=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname).replace(/^\//,'');
        const target=path.resolve(ROOT,relative);
        if(!relative.startsWith('assets/')||!target.startsWith(path.join(ROOT,'assets')+path.sep)||!mime[path.extname(target)]){response.writeHead(404);response.end();return;}
        const bytes=await readFile(target);
        response.writeHead(200,{'Content-Type':mime[path.extname(target)],'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'none'"});response.end(bytes);
      }catch{response.writeHead(404);response.end();}
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-extensions','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+tempRoot,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    diagnostics.browser=browser;diagnostics.stderr='';
    child.stderr.on('data',data=>{diagnostics.stderr=(diagnostics.stderr+data.toString()).slice(-12000);});child.on('error',error=>{diagnostics.launchError=error.message;});
    child.on('exit',(code,signal)=>{diagnostics.exit={code,signal};});
    const devtools=path.join(tempRoot,'DevToolsActivePort');let endpoint='';
    for(let attempt=0;attempt<150;attempt++){
      if(child.exitCode!==null||diagnostics.launchError)throw Object.assign(new Error('浏览器启动失败；检查浏览器路径与本机运行权限。'),{code:'BROWSER_START_FAILED'});
      try{const [port,route]=(await readFile(devtools,'utf8')).trim().split(/\r?\n/);if(port&&route){endpoint=`ws://127.0.0.1:${port}${route}`;break;}}catch{}
      await delay(100);
    }
    if(!endpoint)throw Object.assign(new Error('浏览器启动超时；请确认允许无头模式运行。'),{code:'BROWSER_START_TIMEOUT'});
    cdp=await connectCDP(endpoint);
    diagnostics.browserVersion=await cdp.send('Browser.getVersion');
    const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'}),{sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
    cdp.on(message=>{if(message.method==='Runtime.consoleAPICalled'&&message.sessionId===sessionId){const value=message.params.args?.[0]?.value;if(typeof value==='string'&&value.startsWith('TASKOBO_STAGE ')){try{active={...active,...JSON.parse(value.slice(14))};}catch{}}}});
    await cdp.send('Runtime.enable',{},sessionId);await cdp.send('Page.enable',{},sessionId);
    const loaded=cdp.wait('Page.loadEventFired',sessionId);loaded.catch(()=>{});
    await cdp.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/assets/runner.html`},sessionId);await loaded;
    const ready=await cdp.send('Runtime.evaluate',{expression:'window.__koboCompletion',awaitPromise:true,returnByValue:true},sessionId);
    const metadata=ready.result?.value;if(!metadata?.ok)throw new Error('本机 runtime 未就绪：'+(metadata?.error||ready.exceptionDetails?.text||'未返回结果'));
    for(const job of jobs){
      active={id:job.id,title:job.title,taskIds:job.taskIds,characters:job.source.length,stage:'提交图表'};
      let packet;
      try{
        const response=await cdp.send('Runtime.evaluate',{expression:'window.__taskoboRender('+JSON.stringify({...job,statusDate,format})+')',awaitPromise:true,returnByValue:true},sessionId,timeout);
        if(response.exceptionDetails)throw new Error(response.exceptionDetails.text||'浏览器脚本异常。');
        packet=response.result?.value;if(!packet)throw new Error('图表没有返回结果。');
      }catch(error){packet={ok:false,error:{code:error.code||'BROWSER_CALL_FAILED',stage:active.stage,message:error.message,detail:error.stack}};}
      if(!packet.ok)diagnostics.errors.push({...active,...packet.error});
      if(packet.warning)diagnostics.errors.push({...active,...packet.warning});
      results[job.id]=await onChart(job,packet);
      if(!cdp.open||packet.error?.code==='BROWSER_CALL_TIMEOUT')break;
    }
    return {...metadata,charts:results};
  }catch(error){diagnostics.errors.push({...active,code:error.code||'BROWSER_FAILURE',stage:active?.stage||'浏览器准备',message:error.message,detail:error.stack});return {charts:results};}
  finally{
    if(cdp){if(cdp.open)await cdp.send('Browser.close',{},undefined,2000).catch(()=>{});cdp.close();}
    if(child&&child.exitCode===null){await delay(350);if(child.exitCode===null)child.kill();}
    if(/out of memory|allocation failed|oom-kill|fatal process out of memory/i.test(diagnostics.stderr||'')){
      for(const error of diagnostics.errors)if(error.code==='BROWSER_DISCONNECTED'||error.code==='BROWSER_START_FAILED'){
        error.code='BROWSER_MEMORY_FAILURE';error.message='浏览器日志明确报告内存不足；请关闭占用内存的应用，缩小 --page-size，或先导出 SVG。';
      }
    }
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    const resolved=path.resolve(tempRoot),prefix=path.resolve(os.tmpdir())+path.sep+'kobo-pm-render-';
    if(resolved.startsWith(prefix))await rm(resolved,{recursive:true,force:true,maxRetries:6,retryDelay:250}).catch(()=>{});
  }
}
async function main(){
  const args=argumentsFor(process.argv.slice(2));
  if(args.help){console.log(usage);return;}
  requireNode();const {manifest,manifestSHA256}=await verifyRuntime();
  if(args.verify){const output=args.out?await verifyOutput(args.out):undefined;console.log(JSON.stringify({verified:true,message:'完整性校验通过；部分出图状态请查看 output.status。',coreVersion:manifest.coreVersion,mermaidVersion:manifest.mermaidVersion,output},null,2));return;}
  if(args.doctor){const browser=await findBrowser(args.browser);console.log(JSON.stringify({ready:true,message:'Node、runtime 和浏览器路径检查通过；实际出图时才验证浏览器执行。',nodeVersion:process.version,browser,coreVersion:manifest.coreVersion,mermaidVersion:manifest.mermaidVersion},null,2));return;}
  if(!args.project||!args.out)throw new Error('请提供 --project 和 --out；运行 --help 查看用法。');
  const input=path.resolve(args.project),projectBytes=await readFile(input),original=validateProject(JSON.parse(projectBytes.toString('utf8').replace(/^\uFEFF/,'')));
  let project=original,review=null,reviewBytes=null;
  if(args.review){
    reviewBytes=await readFile(path.resolve(args.review));review=JSON.parse(reviewBytes.toString('utf8').replace(/^\uFEFF/,''));
    if(review.schema!=='kobo.pm-review/v1'||review.projectId!==original.id||!Array.isArray(review.changes)||!review.candidateProject)throw new Error('审阅文件格式不兼容，或与输入项目不匹配。');
    project=validateProject(review.candidateProject);if(project.id!==original.id)throw new Error('候选版本不能替换项目身份。');
  }
  const plan=planViews(project,{pageSize:args['page-size'],group:args.group,from:args.from,to:args.to}),format=args.format||'all';
  const output=await beginOutput(args.out,{force:args.force,inputs:[input,args.review]});
  const diagnostics={schema:'taskobo.pm-diagnostics/v1',errors:[],nodeVersion:process.version},charts={};let packet={};
  try{
    for(const job of plan.jobs)await output.write('sources/'+job.id+(job.kind==='raci'?'.json':'.mmd'),job.source);
    if(format!=='sources'){
      let browser;try{browser=await findBrowser(args.browser);}catch(error){diagnostics.errors.push({code:'BROWSER_NOT_FOUND',stage:'浏览器准备',message:error.message});}
      if(browser)packet=await render(plan.jobs,project.statusDate,browser,format,args.timeout,async(job,chart)=>{
        const result={kind:job.kind,title:job.title,taskIds:job.taskIds,...(job.roleIds?{roleIds:job.roleIds}:{}),...(job.edges?{edges:job.edges}:{})};
        if(!chart.ok){result.failed=true;return result;}
        await output.write(job.id+'.svg',chart.svg);
        Object.assign(result,{width:chart.width,height:chart.height,type:chart.type,notes:chart.notes,png:false});
        if(chart.pngBase64){
          const png=Buffer.from(chart.pngBase64,'base64');if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('PNG 文件无效：'+job.id);
          await output.write(job.id+'.png',png);result.png=true;result.pngSize=chart.pngSize;
        }
        return result;
      },diagnostics);
    }
    for(const job of plan.jobs)charts[job.id]=packet.charts?.[job.id]||{kind:job.kind,title:job.title,taskIds:job.taskIds,...(job.roleIds?{roleIds:job.roleIds}:{}),...(job.edges?{edges:job.edges}:{}),...(format==='sources'?{sourceOnly:true}:{failed:true})};
    const status=diagnostics.errors.length?'partial':'complete';
    const warnings=[...plan.notes,...diagnostics.errors.map(item=>(item.id||'环境')+'｜'+item.stage+'：'+item.message)];
    await output.write('project.snapshot.json',JSON.stringify(project,null,2)+'\n');
    if(review)await output.write('review.snapshot.json',JSON.stringify(review,null,2)+'\n');
    if(packet.profile)await output.write('profile.json',JSON.stringify(packet.profile,null,2)+'\n');
    await output.write('diagnostics.json',JSON.stringify(diagnostics,null,2)+'\n');
    await output.write('review.html',reviewPage(project,{candidate:!!review,review,format,warnings,jobs:plan.jobs.map(job=>({...job,...charts[job.id]}))}));
    const report={schema:'kobo.pm-render-report/v1',status,format,mode:review?'candidate-preview':'project-snapshot',projectId:project.id,statusDate:project.statusDate,updateId:review?.updateId||null,inputSHA256:sha(projectBytes),reviewInputSHA256:reviewBytes?sha(reviewBytes):null,coreVersion:manifest.coreVersion,mermaidVersion:manifest.mermaidVersion,runtimeManifestSHA256:manifestSHA256,summary:projectSummary(project),selection:plan.selection,charts,browserVersion:diagnostics.browserVersion,nodeVersion:process.version,fontNote:'字体由本机解析；跨系统像素可能不同。'};
    const destination=await output.commit(report);
    console.log(JSON.stringify({output:destination,page:path.join(destination,'review.html'),status,format,projectId:project.id,tasks:plan.selection.taskIds.length,pages:plan.jobs.length,errors:diagnostics.errors.map(({id,code,stage,message})=>({id,code,stage,message}))},null,2));
    if(status==='partial')process.exitCode=2;
  }catch(error){await output.abort();throw error;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error('Taskobo Diagrams：'+error.message);process.exitCode=1;});
