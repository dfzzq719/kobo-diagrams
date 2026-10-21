#!/usr/bin/env node
/** Exercise an installed copy: sources -> review -> selection -> browser output. */
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planViews} from '../skills/taskobo-diagrams/scripts/view-plan.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=await mkdtemp(path.join(os.tmpdir(),'kobo-pm-check-'));
const installed=path.join(temp,'installed');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=async file=>JSON.parse(await readFile(file,'utf8'));
function run(script,args=[],success=true){
  const result=spawnSync(process.execPath,[path.join(installed,'scripts',script),...args],{cwd:temp,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024,windowsHide:true});
  if(result.error)throw result.error;
  assert.equal(result.status===0,success,`${script}: ${result.stdout}\n${result.stderr}`);
  return result;
}
try{
  await cp(path.join(root,'skills/taskobo-diagrams'),installed,{recursive:true});
  const demo=path.join(installed,'assets/demo');
  const project=path.join(demo,'project.json'),original=await readFile(project);
  const packagedSnapshot=await read(path.join(demo,'project.snapshot.json'));
  for(const job of planViews(packagedSnapshot).jobs)assert.equal(await readFile(path.join(demo,'sources',job.id+(job.kind==='raci'?'.json':'.mmd')),'utf8'),job.source,'Rebuild the embedded preview: '+job.id);
  run('render.mjs',['--verify']);
  run('pm.mjs',['check','--project',project]);
  const draft=path.join(temp,'draft');
  run('pm.mjs',['init','--from',path.join(demo,'project-brief.md'),'--out',draft]);
  assert.equal((await read(path.join(draft,'draft.json'))).baselineApproved,false);
  assert.match(run('pm.mjs',['check','--project',path.join(draft,'draft.json')],false).stderr,/初始化草稿/);
  const one=await read(path.join(demo,'update-01.json'));
  const first=path.join(temp,'first.json');
  run('pm.mjs',['accept','--project',project,'--update',path.join(demo,'update-01.json'),'--select',one.changes.map(item=>item.id).join(','),'--out',first]);
  const review=path.join(temp,'review');
  run('pm.mjs',['review','--project',first,'--update',path.join(demo,'update-02.json'),'--out',review]);
  const reviewFile=path.join(review,'review.json');
  const candidate=await read(path.join(review,'candidate.json'));
  assert.equal(candidate.tasks.length,18);assert.equal(candidate.roles.length,8);
  assert.deepEqual(candidate.tasks.map(task=>task.baseline),(await read(project)).tasks.map(task=>task.baseline));
  const preview=path.join(temp,'preview');
  run('render.mjs',['--project',path.join(review,'candidate.json'),'--review',reviewFile,'--out',preview]);
  run('render.mjs',['--verify','--out',preview]);
  const report=await read(path.join(preview,'report.json'));
  assert.equal(report.mode,'candidate-preview');
  assert.equal(report.statusDate,'2026-10-21');
  assert.equal(report.coreVersion,'0.1.3');assert.equal(report.mermaidVersion,'12.2.0');
  assert(report.summary.dependencyConflicts.some(item=>item.taskId==='WP141'&&item.predecessorId==='WP131'));
  for(const id of Object.keys(report.charts)){
    assert(report.charts[id].width>300&&report.charts[id].height>100,`Missing real ${id} output`);
    const png=await readFile(path.join(preview,id+'.png'));
    assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
    assert((await readFile(path.join(preview,id+'.svg'),'utf8')).includes('<svg'));
  }
  const html=await readFile(path.join(preview,'review.html'),'utf8');
  assert(html.includes('拟更新预览')&&html.includes('WP131')&&html.includes('2026-10-28'));
  assert.equal(hash(await readFile(project)),hash(original),'Installed demo input changed');
  run('render.mjs',['--project',project,'--out',preview],false);
  // Inject faults only into this disposable installed copy, never production code.
  const runtimePage=path.join(installed,'assets/runtime-page.mjs'),runtimeSource=await readFile(runtimePage,'utf8');
  assert(runtimeSource.includes('const png=await svgToPng(localized,1);'));
  await writeFile(runtimePage,runtimeSource.replace('const png=await svgToPng(localized,1);',"throw new Error('Injected PNG export failure');"));
  const partial=path.join(temp,'partial-png');
  const pngFailure=run('render.mjs',['--project',project,'--out',partial],false);assert.equal(pngFailure.status,2);
  assert.equal((await read(path.join(partial,'report.json'))).status,'partial');
  assert((await read(path.join(partial,'diagnostics.json'))).errors.every(error=>error.code==='PNG_EXPORT_FAILED'));
  assert(existsSync(path.join(partial,'wbs.svg'))&&!existsSync(path.join(partial,'wbs.png')));
  assert((await readFile(path.join(partial,'review.html'),'utf8')).includes('src="wbs.svg"'));run('render.mjs',['--verify','--out',partial]);
  await writeFile(runtimePage,runtimeSource.replace('let packet=await renderDocument', 'await new Promise(()=>{});let packet=await renderDocument'));
  const timed=path.join(temp,'timeout');
  const timedFailure=run('render.mjs',['--project',project,'--out',timed,'--timeout','1000'],false);assert.equal(timedFailure.status,2);
  assert((await read(path.join(timed,'diagnostics.json'))).errors.some(error=>error.code==='BROWSER_CALL_TIMEOUT'));
  assert(existsSync(path.join(timed,'sources/wbs.mmd'))&&!existsSync(path.join(timed,'wbs.svg')));
  await writeFile(runtimePage,runtimeSource);
  await writeFile(path.join(preview,'wbs.svg'),'tampered output');
  run('render.mjs',['--verify','--out',preview],false);
  console.log(JSON.stringify({passed:true,standalone:true,roles:8,tasks:18,updates:2,charts:Object.keys(report.charts).length,originalPreserved:true,overwriteRejected:true,tamperingDetected:true,pngFailurePreservesSVG:true,timeoutDiagnosed:true,initDraft:true}));
}finally{
  const resolved=path.resolve(temp),prefix=path.resolve(os.tmpdir())+path.sep+'kobo-pm-check-';
  if(resolved.startsWith(prefix))await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
