#!/usr/bin/env node
/** Browser regressions: real business labels and edge/role coverage, not just exit 0. */
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=await mkdtemp(path.join(os.tmpdir(),'taskobo-scale-'));
const template=JSON.parse(await readFile(path.join(root,'examples/pm-update-zh-CN/project.json'),'utf8'));
const results=[];
function run(args,status=0){
  const result=spawnSync(process.execPath,[path.join(root,'skills/taskobo-diagrams/scripts/render.mjs'),...args],{encoding:'utf8',timeout:240000,maxBuffer:2e6,windowsHide:true});
  assert.equal(result.status,status,result.stderr+'\n'+result.stdout);return JSON.parse(result.stdout);
}
try{
  for(const count of [12,50,60,120,300]){
    const p=structuredClone(template),roleCount=count===300?32:8;p.groups=[p.groups[0]];
    p.roles=Array.from({length:roleCount},(_,i)=>({id:'R'+i,name:'角色 '+i}));
    p.tasks=Array.from({length:count},(_,i)=>({...structuredClone(template.tasks[0]),id:'WP'+String(i+1).padStart(3,'0'),title:'可验证交付项 '+(i+1),groupId:p.groups[0].id,acceptance:count===12?'完整验收条件'.repeat(750):'证据通过审核并归档',status:'active',actualFinish:null,forecast:{start:'2026-10-01',finish:'2026-10-02'},responsibilities:Object.fromEntries(p.roles.map((role,index)=>[role.id,index===0?'A':index===roleCount-1?'R':'I'])),dependsOn:i?['WP'+String(i).padStart(3,'0')]:[]}));
    const input=path.join(temp,'project-'+count+'.json'),out=path.join(temp,'preview-'+count),before=JSON.stringify(p,null,2)+'\n';await writeFile(input,before);
    const started=Date.now();run(['--project',input,'--out',out,'--format',count<=60?'all':'svg']);
    const report=JSON.parse(await readFile(path.join(out,'report.json'),'utf8'));assert.equal(report.status,'complete');assert.equal(report.summary.staleForecastTaskIds.length,count);
    const wbs=Object.entries(report.charts).filter(([,chart])=>chart.kind==='wbs');assert.deepEqual(wbs.flatMap(([,chart])=>chart.taskIds),p.tasks.map(task=>task.id));
    for(const [id,chart]of Object.entries(report.charts)){
      const svg=await readFile(path.join(out,id+'.svg'),'utf8');assert(svg.includes('<svg'));if(report.format==='all'){assert(chart.png);const png=await readFile(path.join(out,id+'.png'));assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));}assert(!svg.includes('Maximum text size in diagram exceeded'));assert(!/<(?:g|text|path)[^>]*class="[^"]*error-(?:icon|text)/.test(svg));
      if(chart.kind==='wbs'){assert(chart.width<5000);for(const taskId of chart.taskIds)assert(svg.includes(taskId),id+' lost '+taskId);}
      if(chart.kind==='schedule'){assert(chart.height<2500);assert(svg.includes('预测期限已过，需更新'));}
      if(chart.kind==='raci'){assert(chart.width<=1618);for(const roleId of chart.roleIds)assert(p.roles.some(role=>role.id===roleId));}
    }
    assert.equal(Object.values(report.charts).filter(chart=>chart.kind==='dependencies').flatMap(chart=>chart.edges).length,count-1);
    const coverage=new Map(p.tasks.map(task=>[task.id,[]]));for(const chart of Object.values(report.charts).filter(chart=>chart.kind==='raci'))for(const id of chart.taskIds)coverage.get(id).push(...chart.roleIds);for(const ids of coverage.values())assert.deepEqual(ids,p.roles.map(role=>role.id));
    assert.equal(await readFile(input,'utf8'),before);assert((await readFile(path.join(out,'review.html'),'utf8')).includes(p.tasks[0].acceptance));
    run(['--verify','--out',out]);
    if(count===12){
      run(['--project',input,'--out',out,'--force','--format','sources']);
      const failed=run(['--project',input,'--out',out,'--force','--browser',path.join(temp,'missing-browser.exe')],2);
      assert.notEqual(failed.output,out);assert.equal(failed.errors[0].code,'BROWSER_NOT_FOUND');assert.equal(JSON.parse(await readFile(path.join(out,'report.json'),'utf8')).format,'sources');
      await writeFile(path.join(out,'personal-notes.md'),'keep');
      const refusal=spawnSync(process.execPath,[path.join(root,'skills/taskobo-diagrams/scripts/render.mjs'),'--project',input,'--out',out,'--force','--format','sources'],{encoding:'utf8',windowsHide:true});assert.equal(refusal.status,1);assert.match(refusal.stderr,/报告外/);
    }
    results.push({tasks:count,roles:roleCount,pages:Object.keys(report.charts).length,format:report.format,milliseconds:Date.now()-started});
    console.log(JSON.stringify({casePassed:count,roles:roleCount,pages:Object.keys(report.charts).length}));
  }
  console.log(JSON.stringify({passed:true,cases:results}));
}finally{const resolved=path.resolve(temp);if(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'taskobo-scale-'))await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:250});}
