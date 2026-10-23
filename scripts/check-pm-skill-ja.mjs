#!/usr/bin/env node
/** Verify an actual extracted JA archive, outside the checkout. */
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import os from 'node:os';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=await mkdtemp(path.join(os.tmpdir(),'taskobo-ja-check-'));
const python=process.env.PYTHON||'python';
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const checks=[];
try{
  const unzip=spawnSync(python,['-B','-X','utf8','-m','zipfile','-e',path.join(root,'docs/downloads/taskobo-diagrams-ja.zip'),temp],{encoding:'utf8',windowsHide:true});
  assert.equal(unzip.status,0,unzip.stderr);
  const installed=path.join(temp,'taskobo-diagrams'),demo=path.join(installed,'assets/demo');
  const manifest=await read(path.join(root,'docs/downloads/taskobo-diagrams-ja.manifest.json'));
  for(const [name,expected]of Object.entries(manifest.fileSHA256))assert.equal(hash(await readFile(path.join(temp,name))),expected,name);
  assert.equal((await read(path.join(installed,'edition.json'))).language,'ja');
  const initial=await read(path.join(demo,'project.json')),originalBytes=await readFile(path.join(demo,'project.json'));
  const {validateProject,prepareUpdate,applyUpdate}=await import(pathToFileURL(path.join(installed,'scripts/project.mjs')));
  validateProject(initial);
  checks.push('Extracted archive hashes, Japanese edition and valid initial state');
  let state=initial;
  for(const week of ['01','02']){
    const updatePath=path.join(demo,'update-'+week+'.json'),update=await read(updatePath);
    const prepared=await prepareUpdate(state,update,{updatePath});
    for(const source of prepared.sources)assert.equal(source.sha256,hash(await readFile(path.join(demo,source.file))));
    const selected=update.changes.map(c=>c.id);
    state=applyUpdate(state,prepared,selected);
    assert.deepEqual(applyUpdate(state,prepared,selected),state,'Repeated update must be idempotent');
    assert.deepEqual(state.tasks.map(t=>t.baseline),initial.tasks.map(t=>t.baseline));
  }
  assert.deepEqual(state,await read(path.join(demo,'final.project.json')));
  assert.equal(state.tasks.length,18);assert.equal(state.roles.length,8);
  assert.equal(state.tasks.find(t=>t.id==='WP131').forecast.finish,'2026-10-28');
  assert.equal(state.tasks.find(t=>t.id==='WP133').responsibilities.quality,'R');
  assert.equal(state.tasks.find(t=>t.id==='WP132').status,'done');
  assert.equal(state.actions.find(a=>a.id==='ACT-01').status,'done');
  assert(state.decisions.every(d=>d.status==='pending'));
  assert.equal(hash(await readFile(path.join(demo,'project.json'))),hash(originalBytes));
  checks.push('Both JA meetings replay, actual UTF-8 evidence hashes, stable IDs, idempotency, unchanged baseline/input and pending decisions');
  const bad=await read(path.join(demo,'update-01.json'));
  bad.changes[0].evidence[0].quote+='存在しない引用';
  await assert.rejects(()=>prepareUpdate(initial,bad,{updatePath:path.join(demo,'update-01.json')}));
  const forbidden=await read(path.join(demo,'update-01.json'));forbidden.changes[0].field='baseline';
  await assert.rejects(()=>prepareUpdate(initial,forbidden,{updatePath:path.join(demo,'update-01.json')}));
  checks.push('False quotes and ordinary changes to approved baseline rejected');
  const run=(script,args)=>{const r=spawnSync(process.execPath,[path.join(installed,'scripts',script),...args],{cwd:temp,encoding:'utf8',timeout:180000,windowsHide:true});assert.equal(r.status,0,r.stdout+r.stderr);return r;};
  const draft=path.join(temp,'draft');run('pm.mjs',['init','--from',path.join(demo,'project-brief.md'),'--out',draft]);
  assert.equal((await read(path.join(draft,'draft.json'))).records.length,18);
  const preview=path.join(temp,'preview');
  const args=['--project',path.join(demo,'project.snapshot.json'),'--review',path.join(demo,'review.snapshot.json'),'--out',preview];
  if(process.env.TASKOBO_CHROME_PATH)args.push('--browser',process.env.TASKOBO_CHROME_PATH);
  run('render.mjs',args);run('render.mjs',['--verify','--out',preview]);
  const report=await read(path.join(preview,'report.json'));
  assert.equal(report.status,'complete');assert.equal(Object.keys(report.charts).length,20);
  for(const id of Object.keys(report.charts)){
    const png=await readFile(path.join(preview,id+'.png'));
    assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
    const svg=await readFile(path.join(preview,id+'.svg'),'utf8');
    assert(!/工作包|责任分配|预测|状态日|验收条件|基准/.test(svg),id);
  }
  const html=await readFile(path.join(preview,'review.html'),'utf8');
  assert(html.includes('lang="ja"')&&html.includes('更新案のプレビュー')&&html.includes('変更前：'));
  assert(!/项目|责任|预计|请|工作包|状态|中文|渲染|审阅|验收|供应商/.test(html));
  checks.push('Installed Japanese CLI imports 18 rows and regenerates all 20 SVG/PNG charts plus Japanese review');
  const result={passed:true,language:'ja',checks};
  if(process.env.TASKOBO_CHECK_RECORD)await writeFile(process.env.TASKOBO_CHECK_RECORD,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}finally{
  const resolved=path.resolve(temp),prefix=path.resolve(os.tmpdir())+path.sep+'taskobo-ja-check-';
  if(resolved.startsWith(prefix))await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
