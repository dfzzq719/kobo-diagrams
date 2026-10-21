#!/usr/bin/env node
// 核对中文绘制源的业务事实与英文原案一致，不启动浏览器。
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseTable} from '../../../src/document-renderer.mjs';
import {parseGanttStatus} from '../../../src/gantt-status.mjs';
import {validateFrozenSource} from '../../../src/source-policy.mjs';

const read=file=>readFile(new URL(file,import.meta.url),'utf8');
const files=['wbs.mmd','raci.json','change-control.mmd','schedule.mmd'];
const cn=Object.fromEntries(await Promise.all(files.map(async file=>[file,await read(file)])));
const en=Object.fromEntries(await Promise.all(files.map(async file=>[file,await read('../'+file)])));
for(const file of ['wbs.mmd','change-control.mmd','schedule.mmd'])validateFrozenSource(cn[file]);

// 成果物编号、包含关系与18条验收条件不能在翻译中丢失。
const leaves=source=>[...source.matchAll(/^\s*(WP\d{3})\["([^\n]+)"\]/gm)];
assert.equal(leaves(cn['wbs.mmd']).length,18);
assert.deepEqual(leaves(cn['wbs.mmd']).map(item=>item[1]),leaves(en['wbs.mmd']).map(item=>item[1]));
for(const [,id,text]of leaves(cn['wbs.mmd']))assert.ok(text.includes('验收证据：'),`${id}缺少验收条件`);
assert.deepEqual([...cn['wbs.mmd'].matchAll(/^\s*subgraph (G\d)\[/gm)].map(item=>item[1]),['G1','G2','G3','G4','G5','G6']);
assert.deepEqual(cn['wbs.mmd'].match(/^\s*P --- G\d$/gm),en['wbs.mmd'].match(/^\s*P --- G\d$/gm));
for(const fact of ['3个业务窗口','40名用户','20,000条记录','80条重复键候选','30个必测用例'])assert.ok(cn['wbs.mmd'].includes(fact));

// 只翻译表头和工作名称，冻结原始角色顺序、尺寸与全部112项分配。
const raci=parseTable(cn['raci.json']),original=parseTable(en['raci.json']);
const roles=['sponsor','pm','business','dev','ops','info','quality','vendor'];
assert.equal(raci.rows.length,14);
assert.deepEqual(raci.columns.map(({key,width})=>({key,width})),original.columns.map(({key,width})=>({key,width})));
assert.deepEqual(raci.columns.slice(1).map(column=>column.key),roles);
for(const [index,row]of raci.rows.entries()){
  assert.deepEqual(Object.fromEntries(Object.entries(row).filter(([key])=>key!=='work')),Object.fromEntries(Object.entries(original.rows[index]).filter(([key])=>key!=='work')));
  assert.ok(row.work.startsWith(`责任${String(index+1).padStart(2,'0')}｜`));
  const codes=roles.map(role=>row[role].split('/'));
  assert.equal(codes.filter(code=>code.includes('A')).length,1);
  assert.ok(codes.some(code=>code.includes('R')));
}
const signature=createHash('sha256').update(JSON.stringify(raci.rows.map(row=>roles.map(role=>row[role])))).digest('hex');
assert.equal(signature,'20715bedfd4a9b01ead2f2def99d5e88ab99366a06bde6780672b83eb1589cbb');

// 47项日程的机器编号、日期、状态标签和完整扩展元数据逐项保持原样。
const tasks=source=>[...source.matchAll(/^\s*(.+?)\s+:\s*((?:(?:done|active|crit|milestone),\s*)*)([A-Za-z_][\w-]*),\s*(2026-\d\d-\d\d),\s*(2026-\d\d-\d\d|0d)\s*$/gm)].map(match=>({label:match[1],id:match[3],start:match[4],end:match[5],tags:match[2].split(',').map(value=>value.trim()).filter(Boolean)}));
const scheduled=tasks(cn['schedule.mmd']);
assert.equal(scheduled.length,47);
assert.deepEqual(scheduled.map(({label,...task})=>task),tasks(en['schedule.mmd']).map(({label,...task})=>task));
const directive=source=>source.match(/^\s*%% taskobo-gantt-status (\{[^\n]+\})/m)[1];
assert.equal(directive(cn['schedule.mmd']),directive(en['schedule.mmd']));
const model=parseGanttStatus(cn['schedule.mmd']);
assert.equal(model.asOf,'2026-10-14');
assert.equal(model.items.length,6);
assert.equal(model.items.find(item=>item.current==='f_api').varianceDays,6);
assert.equal(model.items.find(item=>item.current==='f_migration').varianceDays,3);
const proposals=scheduled.filter(task=>task.id.startsWith('p_'));
assert.equal(proposals.length,30);
assert.equal(proposals.filter(task=>task.tags.includes('milestone')).length,5);
for(const task of proposals)assert.ok(task.label.startsWith('草案／')&&!task.tags.includes('done')&&!task.tags.includes('active'));

// 对照原版控制流骨架，另核实中文关闭语义，防止翻译造成错误合流。
function sequence(source){
  const frames=[],events=[],messages=[];
  for(const raw of source.split(/\r?\n/)){
    const line=raw.trim(),actor=line.match(/^participant (\w+) as (.+)$/),frame=line.match(/^(alt|par|opt|loop|else|and) (.+)$/),message=line.match(/^(\w+)(--?>>)(\w+):\s*(.+)$/),note=line.match(/^Note over ([\w,]+):/);
    if(actor){events.push(['participant',actor[1]]);continue;}
    if(frame){events.push([frame[1]]);if(['else','and'].includes(frame[1]))frames.at(-1).label=frame[2];else frames.push({kind:frame[1],label:frame[2]});continue;}
    if(line==='end'){assert.ok(frames.length);frames.pop();events.push(['end']);continue;}
    if(note){events.push(['note',note[1]]);continue;}
    if(message){events.push(['message',message[1],message[2],message[3]]);messages.push({from:message[1],to:message[3],text:message[4],guards:frames.filter(item=>item.kind==='alt').map(item=>item.label),parallel:frames.some(item=>item.kind==='par')});}
  }
  assert.equal(frames.length,0);return {events,messages};
}
const workflow=sequence(cn['change-control.mmd']);
assert.deepEqual(workflow.events,sequence(en['change-control.mmd']).events);
assert.equal(workflow.messages.length,20);
assert.deepEqual([...cn['change-control.mmd'].matchAll(/^\s*participant \w+ as (.+)$/gm)].map(item=>item[1]),['业务负责人','项目经理','开发负责人','运维负责人','信息管理负责人','质量负责人','项目发起人']);
const closure=workflow.messages.filter(message=>message.text==='凭证据关闭变更01');
assert.equal(closure.length,1);
for(const guard of ['条件和资源均已确认','独立复验通过且阻断已解除','业务验收通过'])assert.ok(closure[0].guards.includes(guard));
for(const role of ['Dev','Info','Ops','QA'])assert.ok(workflow.messages.some(message=>message.from===role&&message.to==='PM'&&message.parallel));
for(const phrase of ['8人日／60万日元','2026-10-16','项目发起人不得豁免安全阻断条件','有条件批准本身不代表新基准已经生效','验证失败或业务退回时','升级决策不等于验收通过或获得发布授权'])assert.ok(cn['change-control.mmd'].includes(phrase));
assert.doesNotMatch(cn['change-control.mmd'],/;/);

// 检查实际可见文字，语法关键字和不可翻译的机器元数据不在此列。
const visible=[raci.title,...raci.columns.map(column=>column.label),...raci.rows.map(row=>row.work),
  ...[...cn['wbs.mmd'].matchAll(/\["([^"\n]+)"\]/g)].map(item=>item[1]),
  ...scheduled.map(task=>task.label),
  ...[...cn['schedule.mmd'].matchAll(/^\s*(?:title |accTitle: |accDescr: |section )(.+)$/gm)].map(item=>item[1]),
  ...cn['change-control.mmd'].split(/\r?\n/).map(line=>line.trim()).filter(line=>/^(?:participant |Note |alt |else |par |and |opt |\w+--?>>)/.test(line)).map(line=>line.startsWith('participant ')?line.split(' as ')[1]:line.includes(':')?line.slice(line.indexOf(':')+1):line.replace(/^\w+ /,''))];
for(const text of visible){
  const words=text.replace(/<br\s*\/?>/g,' ').replace(/\b(?:WBS|CRM|API|SLA)\b/g,'');
  assert.doesNotMatch(words,/[A-Za-z]{2,}|[\u3040-\u30FF]|本番|受入/,`可见文字需要中文：${text}`);
}
console.log(JSON.stringify({ok:true,locale:'zh-CN',workPackages:18,deliverableGroups:6,raciRows:14,roles:8,assignments:112,workflowMessages:20,scheduleEntries:47,trialComparisons:6,implementationProposalEntries:30,proposalMilestones:5},null,2));
