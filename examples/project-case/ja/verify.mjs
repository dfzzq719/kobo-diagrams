#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseTable} from '../../../src/document-renderer.mjs';
import {parseGanttStatus} from '../../../src/gantt-status.mjs';
import {validateFrozenSource} from '../../../src/source-policy.mjs';
const names=['wbs.mmd','raci.json','change-control.mmd','schedule.mmd'];
const read=async prefix=>Object.fromEntries(await Promise.all(names.map(async n=>[n,await readFile(new URL(prefix+n,import.meta.url),'utf8')])));
const ja=await read(''),en=await read('../');
for(const name of names.filter(n=>n.endsWith('.mmd')))validateFrozenSource(ja[name]);
const leaves=s=>[...s.matchAll(/^\s*(WP\d{3})\["([^\n]+)"\]/gm)];
assert.equal(leaves(ja['wbs.mmd']).length,18);
assert.deepEqual(leaves(ja['wbs.mmd']).map(m=>m[1]),leaves(en['wbs.mmd']).map(m=>m[1]));
for(const [,id,label]of leaves(ja['wbs.mmd']))assert.ok(label.includes('受入証跡：'),id);
assert.deepEqual(ja['wbs.mmd'].match(/^\s*P --- G\d$/gm),en['wbs.mmd'].match(/^\s*P --- G\d$/gm));
for(const fact of ['3業務窓口','40ユーザー','20,000件','重複キー候補80件','必須30ケース'])assert.ok(ja['wbs.mmd'].includes(fact),fact);
const table=parseTable(ja['raci.json']),original=parseTable(en['raci.json']);
assert.equal(table.rows.length,14);
assert.deepEqual(table.columns.map(({key,width})=>({key,width})),original.columns.map(({key,width})=>({key,width})));
table.rows.forEach((row,i)=>{
  assert.deepEqual(Object.fromEntries(Object.entries(row).filter(([k])=>k!=='work')),Object.fromEntries(Object.entries(original.rows[i]).filter(([k])=>k!=='work')));
  assert.ok(row.work.startsWith(`責任${String(i+1).padStart(2,'0')}｜`));
});
const tasks=s=>[...s.matchAll(/^\s*.+?\s+:\s*((?:(?:done|active|crit|milestone),\s*)*)([A-Za-z_][\w-]*),\s*(2026-\d\d-\d\d),\s*(2026-\d\d-\d\d|0d)\s*$/gm)].map(m=>m.slice(1));
assert.equal(tasks(ja['schedule.mmd']).length,47);assert.deepEqual(tasks(ja['schedule.mmd']),tasks(en['schedule.mmd']));
const directive=s=>s.match(/^\s*%% taskobo-gantt-status (\{[^\n]+\})/m)[1];
assert.equal(directive(ja['schedule.mmd']),directive(en['schedule.mmd']));
assert.equal(parseGanttStatus(ja['schedule.mmd']).items.length,6);
const events=s=>s.split(/\r?\n/).map(l=>l.trim()).map(l=>{
  let m;if(m=l.match(/^participant (\w+) as /))return ['participant',m[1]];
  if(m=l.match(/^(\w+)(--?>>)(\w+):/))return m.slice(1);
  if(m=l.match(/^Note over ([\w,]+):/))return ['note',m[1]];
  if(m=l.match(/^(alt|par|opt|loop|else|and|end)\b/))return [m[1]];
}).filter(Boolean);
assert.deepEqual(events(ja['change-control.mmd']),events(en['change-control.mmd']));
assert.equal(events(ja['change-control.mmd']).filter(e=>e[1]?.includes('>')).length,20);
for(const fact of ['8人日／60万円','2026-10-16','安全上の阻止条件を免除できない','条件付き承認だけでは新しい基準は有効にならない','業務受入れに合格','証跡に基づき変更01を終結'])assert.ok(ja['change-control.mmd'].includes(fact),fact);
for(const source of Object.values(ja))assert.doesNotMatch(source,/项目|客户|预测|负责人|验收|变更|实际|运维|です[。\n]|ます[。\n]/);
console.log(JSON.stringify({ok:true,locale:'ja',workPackages:18,groups:6,raciRows:14,assignments:112,scheduleEntries:47,workflowMessages:20}));
