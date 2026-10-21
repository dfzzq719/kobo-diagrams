import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createMermaidRenderer,pngDimensions} from '../src/index.mjs';
import {parseGanttStatus} from '../src/gantt-status.mjs';
import {planViews} from '../skills/taskobo-diagrams/scripts/view-plan.mjs';
import {reviewPage,projectSummary} from '../skills/taskobo-diagrams/scripts/view-model.mjs';
import {draftFrom,parseCSV,initialize} from '../skills/taskobo-diagrams/scripts/init.mjs';
import {beginOutput,verifyOutput} from '../skills/taskobo-diagrams/scripts/output.mjs';
import {validateProject,prepareUpdate,applyUpdate} from '../skills/taskobo-diagrams/scripts/project.mjs';

const demo=JSON.parse(await readFile(new URL('../examples/pm-update-zh-CN/project.json',import.meta.url),'utf8'));
function project(count=60,roles=8){
  const copy=structuredClone(demo);copy.groups=[copy.groups[0]];
  copy.roles=Array.from({length:roles},(_,i)=>({id:'R'+i,name:'角色 '+i}));
  copy.tasks=Array.from({length:count},(_,i)=>({...structuredClone(demo.tasks[0]),id:'WP'+String(i+1).padStart(3,'0'),groupId:copy.groups[0].id,title:'交付项 '+(i+1),acceptance:'原始验收条件'.repeat(700),responsibilities:Object.fromEntries(copy.roles.map((role,index)=>[role.id,index===0?'A':index===1?'R':'I'])),dependsOn:i?['WP'+String(i).padStart(3,'0')]:[]}));
  return validateProject(copy);
}
async function temp(t){const root=await mkdtemp(path.join(os.tmpdir(),'taskobo-robust-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}

test('Mermaid rejects oversized source and returned error graphics, while ordinary error CSS is harmless',async()=>{
  let renders=0;
  const engine={initialize(){},async parse(){},async render(){renders++;return {svg:'<svg><style>.error-icon{fill:red}</style><text>Valid</text></svg>'};}};
  const renderer=createMermaidRenderer(engine);
  await assert.rejects(renderer.render('x'.repeat(50001)),{code:'DIAGRAM_TEXT_LIMIT'});assert.equal(renders,0);
  await renderer.render('flowchart TB\nA-->B');
  engine.render=async()=>({svg:'<svg><text>Maximum text size in diagram exceeded</text></svg>'});
  await assert.rejects(renderer.render('flowchart TB\nA-->B'),{code:'DIAGRAM_ERROR_GRAPHIC'});
  engine.render=async()=>({svg:'<svg><g class="error-icon"/></svg>'});
  await assert.rejects(renderer.render('flowchart TB\nA-->B'),{code:'DIAGRAM_ERROR_GRAPHIC'});
});

test('PNG budget downscales native oversized diagrams and respects both pixel and side limits',()=>{
  for(const [width,height,scale]of [[22000,4000,1],[100000,100000,2],[1e12,1,1],[100,100,2],[200,70000,1]]){
    const size=pngDimensions({width,height},scale);
    assert(size.width<=16384&&size.height<=16384);assert(size.width*size.height<=32000000);assert(size.scale>0&&size.scale<=scale);
  }
  assert(pngDimensions({width:22000,height:4000},1).scale<1);
  assert.deepEqual(pngDimensions({width:100,height:100},2),{width:200,height:200,scale:2});
  assert.throws(()=>pngDimensions({width:Infinity,height:20}));
});

test('300 tasks and 32 roles paginate without losing task, responsibility or dependency coverage',()=>{
  const original=project(300,32),before=structuredClone(original),plan=planViews(original);
  assert.equal(plan.selection.taskIds.length,300);
  const wbs=plan.jobs.filter(job=>job.kind==='wbs');assert.equal(wbs.length,75);
  assert.deepEqual(wbs.flatMap(job=>job.taskIds),original.tasks.map(task=>task.id));
  for(const job of plan.jobs){assert(job.source.length<50000);if(job.kind!=='dependencies')assert(job.taskIds.length<=12);}
  const roles=new Map(original.tasks.map(task=>[task.id,[]]));
  for(const job of plan.jobs.filter(job=>job.kind==='raci'))for(const id of job.taskIds)roles.get(id).push(...job.roleIds);
  for(const ids of roles.values())assert.deepEqual(ids,original.roles.map(role=>role.id));
  assert.equal(plan.jobs.filter(job=>job.kind==='dependencies').flatMap(job=>job.edges).length,299);
  assert.deepEqual(original,before);
  const html=reviewPage(original,{jobs:plan.jobs,format:'sources'});assert(html.includes(original.tasks[0].acceptance));
  assert.throws(()=>planViews(original,{from:'2026-02-30'}),/有效/);
  assert.throws(()=>planViews(original,{pageSize:21}),/1–20/);
  original.tasks.push({...original.tasks[0],id:'WP301'});assert.throws(()=>validateProject(original),/1–300/);
});

test('stale forecasts render as a separate warning without moving dates or rewriting the baseline',()=>{
  const p=project(2);p.tasks.forEach(task=>{task.status='active';task.actualFinish=null;task.forecast={start:'2026-10-01',finish:'2026-10-02'};});
  const before=structuredClone(p),source=planViews(p).jobs.find(job=>job.kind==='schedule').source;
  const result=parseGanttStatus(source);assert(result.items.every(item=>item.status==='stale-forecast'&&item.finish==='2026-10-02'));
  assert.equal(projectSummary(p).staleForecastTaskIds.length,2);assert.deepEqual(p,before);
});

test('filtered pages retain external and archived predecessor nodes',()=>{
  const p=project(3);p.tasks[0].archived=true;p.groups.push({id:'other',name:'其他分组'});p.tasks[1].groupId='other';
  const plan=planViews(p,{group:'other'});assert.deepEqual(plan.selection.taskIds,['WP002']);
  const dependency=plan.jobs.find(job=>job.kind==='dependencies');assert.deepEqual(dependency.edges,[{from:'WP001',to:'WP002'}]);assert.match(dependency.source,/外部分组／筛选外前置/);assert.match(dependency.source,/已归档/);
});

test('init preserves UTF-8 CSV/Markdown facts, quoted multiline cells and unknown fields without inventing approvals',async t=>{
  const csv='\uFEFFid,title,owner,notes\r\nWP1,"接口,验收",张三,"第一行\r\n第二行"\r\n';
  const draft=draftFrom(csv,{extension:'.csv'});assert.equal(draft.baselineApproved,false);assert.equal(draft.statusDate,null);assert.equal(draft.records[0].fields.owner,'张三');assert.equal(draft.records[0].fields.notes,'第一行\n第二行');assert.equal(draft.records[0].fields.title,'接口,验收');
  assert(!Object.hasOwn(draft.records[0],'baseline'));assert(!Object.hasOwn(draft.records[0],'responsibilities'));
  const md=draftFrom('| 编号 | 名称 |\n| --- | --- |\n| WP1 | 接口\\|验收 |\n',{extension:'.md'});assert.equal(md.records[0].fields.名称,'接口|验收');
  assert.equal(draftFrom('只有一份会议说明',{extension:'.md'}).source.text,'只有一份会议说明');
  assert.throws(()=>parseCSV('a,b\n"not closed'),/未闭合/);
  assert.throws(()=>draftFrom('a,a\n1,2',{extension:'.csv'}),/表头/);
  assert.throws(()=>draftFrom('a,b\n1,2,3',{extension:'.csv'}),/列数/);
  const root=await temp(t),input=path.join(root,'plan.csv'),out=path.join(root,'init');await writeFile(input,csv);
  await initialize({from:input,out});assert.equal((JSON.parse(await readFile(path.join(out,'draft.json')))).records.length,1);
  await assert.rejects(initialize({from:input,out}),/拒绝覆盖/);
  await assert.rejects(initialize({from:'plan.xlsx',out:path.join(root,'bad')}),/CSV UTF-8/);
});

test('task.add and archive retain evidence, dependencies and immutable historical baselines across replay',async t=>{
  const root=await temp(t),p=project(2);await writeFile(path.join(root,'minutes.txt'),'新增交付项，归档原工作包。');
  const value={...structuredClone(p.tasks[1]),id:'WP003',dependsOn:['WP002']};
  const update={schema:'kobo.pm-update/v1',id:'scope-change',asOf:p.statusDate,sources:[{id:'minutes',file:'minutes.txt'}],changes:[{id:'add',kind:'task.add',value,evidence:[{sourceId:'minutes',quote:'新增交付项'}]},{id:'archive',kind:'task.set',targetId:'WP001',field:'archived',expected:false,value:true,evidence:[{sourceId:'minutes',quote:'归档原工作包'}]}]};
  const prepared=await prepareUpdate(p,update,{updatePath:path.join(root,'update.json')}),next=applyUpdate(p,prepared,['add','archive']);
  assert.equal(next.tasks.length,3);assert.equal(next.tasks[0].archived,true);assert.deepEqual(next.tasks[0].baseline,p.tasks[0].baseline);assert.deepEqual(next.tasks[1].dependsOn,['WP001']);
  assert.deepEqual(applyUpdate(next,prepared,['add','archive']),next);assert.equal(p.tasks.length,2);assert.equal(p.tasks[0].archived,undefined);
});

test('managed refresh replaces complete results, preserves previous success on partial failure, and rejects hand edits or extra files',async t=>{
  const root=await temp(t),out=path.join(root,'preview'),report={schema:'kobo.pm-render-report/v1',status:'complete',mode:'test'};
  let writer=await beginOutput(out);await writer.write('wbs.svg','original');await writer.commit(report);
  await assert.rejects(beginOutput(out),/--force/);
  writer=await beginOutput(out,{force:true});await writer.write('wbs.svg','partial');const failed=await writer.commit({...report,status:'partial'});
  assert.notEqual(failed,out);assert.equal(await readFile(path.join(out,'wbs.svg'),'utf8'),'original');assert.equal((await verifyOutput(failed)).status,'partial');
  writer=await beginOutput(out,{force:true});await writer.write('wbs.svg','updated');await writer.commit(report);assert.equal(await readFile(path.join(out,'wbs.svg'),'utf8'),'updated');
  await writeFile(path.join(out,'notes.txt'),'manual');await assert.rejects(beginOutput(out,{force:true}),/报告外/);await rm(path.join(out,'notes.txt'));
  await writeFile(path.join(out,'wbs.svg'),'edited');await assert.rejects(beginOutput(out,{force:true}),/校验失败/);
  await assert.rejects(beginOutput(out,{force:true,inputs:[path.join(out,'project.json')]}),/包含项目/);
  await mkdir(path.join(root,'unknown'));await assert.rejects(beginOutput(path.join(root,'unknown'),{force:true}));
});

test('managed refresh rejects a directory symlink before deleting or replacing any files',async t=>{
  const root=await temp(t),target=path.join(root,'original'),link=path.join(root,'link');await mkdir(target);await writeFile(path.join(target,'mine.txt'),'keep');
  await symlink(target,link,process.platform==='win32'?'junction':'dir');
  await assert.rejects(beginOutput(link,{force:true}),/符号链接/);assert.equal(await readFile(path.join(target,'mine.txt'),'utf8'),'keep');
});
