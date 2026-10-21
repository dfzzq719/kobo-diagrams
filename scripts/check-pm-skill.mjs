#!/usr/bin/env node
/** Exercise an installed copy: sources -> review -> selection -> browser output. */
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

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
  await cp(path.join(root,'skills/kobo-pm-update'),installed,{recursive:true});
  const demo=path.join(installed,'assets/demo');
  const project=path.join(demo,'project.json'),original=await readFile(project);
  run('render.mjs',['--verify']);
  run('pm.mjs',['check','--project',project]);
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
  assert.equal(report.coreVersion,'0.1.2');assert.equal(report.mermaidVersion,'12.2.0');
  assert(report.summary.dependencyConflicts.some(item=>item.taskId==='WP141'&&item.predecessorId==='WP131'));
  for(const id of ['wbs','raci','schedule']){
    assert(report.charts[id].width>300&&report.charts[id].height>300,`Missing real ${id} output`);
    const png=await readFile(path.join(preview,id+'.png'));
    assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
    assert((await readFile(path.join(preview,id+'.svg'),'utf8')).includes('<svg'));
  }
  const html=await readFile(path.join(preview,'review.html'),'utf8');
  assert(html.includes('拟更新预览')&&html.includes('WP131')&&html.includes('2026-10-28'));
  assert.equal(hash(await readFile(project)),hash(original),'Installed demo input changed');
  run('render.mjs',['--project',project,'--out',preview],false);
  await writeFile(path.join(preview,'wbs.svg'),'tampered output');
  run('render.mjs',['--verify','--out',preview],false);
  console.log(JSON.stringify({passed:true,standalone:true,roles:8,tasks:18,updates:2,charts:3,originalPreserved:true,overwriteRejected:true,tamperingDetected:true}));
}finally{
  const resolved=path.resolve(temp),prefix=path.resolve(os.tmpdir())+path.sep+'kobo-pm-check-';
  if(resolved.startsWith(prefix))await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
