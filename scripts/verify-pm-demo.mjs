#!/usr/bin/env node
/** Check two successive PM updates against real source files, without an AI API. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateProject,prepareUpdate,applyUpdate,reviewUpdate} from '../skills/taskobo-diagrams/scripts/project.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(root,'examples/pm-update-zh-CN');
const writing=process.argv.includes('--write');
const read=async name=>JSON.parse(await readFile(path.join(directory,name),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const project=validateProject(await read('project.json'));
const inputs=['project.json','project-brief.md','week-01.md','week-02.md','update-01.json','update-02.json'];
const before=Object.fromEntries(await Promise.all(inputs.map(async file=>[file,sha(await readFile(path.join(directory,file)))])));
assert.equal(project.tasks.length,18);assert.equal(project.roles.length,8);assert.equal(project.groups.length,6);
assert(project.groups.every(group=>project.tasks.filter(task=>task.groupId===group.id).length===3));
const one=await read('update-01.json'),two=await read('update-02.json');
const prepared1=await prepareUpdate(project,one,{updatePath:path.join(directory,'update-01.json')});
const review1=reviewUpdate(project,prepared1);
const first=applyUpdate(project,prepared1,one.changes.map(change=>change.id));
const prepared2=await prepareUpdate(first,two,{updatePath:path.join(directory,'update-02.json')});
const review2=reviewUpdate(first,prepared2);
const final=applyUpdate(first,prepared2,two.changes.map(change=>change.id));
const repeated=applyUpdate(final,prepared2,two.changes.map(change=>change.id));
assert.deepEqual(repeated,final,'Repeated acceptance must not duplicate or mutate records');
assert.deepEqual(final.tasks.map(task=>task.baseline),project.tasks.map(task=>task.baseline),'Approved baseline changed');
assert.equal(project.statusDate,'2026-10-14','Input object mutated');
assert.equal(final.statusDate,'2026-10-21');assert.equal(final.tasks.length,18);
assert.equal(final.tasks.find(task=>task.id==='WP132').actualFinish,'2026-10-20');
assert.equal(final.tasks.find(task=>task.id==='WP132').status,'done');
assert.equal(final.tasks.find(task=>task.id==='WP131').forecast.finish,'2026-10-28');
assert.equal(final.tasks.find(task=>task.id==='WP133').responsibilities.quality,'R');
assert.equal(final.tasks.find(task=>task.id==='WP133').responsibilities.business,'A');
assert.equal(final.tasks.find(task=>task.id==='WP141').status,'planned','API completion must not close project acceptance');
assert.equal(final.actions.length,3);
assert.equal(final.actions.find(action=>action.id==='ACT-01').status,'done');
assert.equal(final.actions.find(action=>action.id==='ACT-02').status,'open');
assert.equal(final.decisions.length,2);assert(final.decisions.every(decision=>decision.status==='pending'));
assert.equal(final.appliedUpdates.length,2);
for(const [file,hash]of Object.entries(before))assert.equal(sha(await readFile(path.join(directory,file))),hash,`Input file mutated: ${file}`);
const verification={schema:'kobo.pm-demo-check/v1',fictional:true,roles:8,groups:6,workPackages:18,updates:2,acceptedChanges:one.changes.length+two.changes.length,actions:3,decisions:2,checks:['来源文件及原文引用通过','输入文件未改动','批准基准未改动','重复接受不增加任务','完成与验收区分','待决事项保持待决'],inputSHA256:before};
const files={'week-01.project.json':json(first),'final.project.json':json(final),'review-01.json':json(review1),'review-02.json':json(review2),'verification.json':json(verification)};
const generated=path.join(directory,'generated');
const embedded=path.join(root,'skills/taskobo-diagrams/assets/demo');
if(writing){
  await mkdir(generated,{recursive:true});await mkdir(embedded,{recursive:true});
  for(const [name,bytes]of Object.entries(files)){await writeFile(path.join(generated,name),bytes);await writeFile(path.join(embedded,name),bytes);}
  for(const name of inputs)await writeFile(path.join(embedded,name),await readFile(path.join(directory,name)));
}else{
  for(const [name,bytes]of Object.entries(files))assert.equal(await readFile(path.join(generated,name),'utf8'),bytes,`Rebuild PM demonstration: ${name}`);
  for(const name of [...inputs,...Object.keys(files)])assert.equal(await readFile(path.join(embedded,name),'utf8'),await readFile(path.join(Object.hasOwn(files,name)?generated:directory,name),'utf8'),`Skill demonstration drift: ${name}`);
}
console.log(JSON.stringify({passed:true,roles:8,groups:6,tasks:18,updates:2,changes:verification.acceptedChanges,repeatedUpdate:'no change',baseline:'preserved',writing}));
