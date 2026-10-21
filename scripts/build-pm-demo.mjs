#!/usr/bin/env node
/** Recreate the fictional, Chinese PM teaching inputs; no model or service calls. */
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'examples/pm-update-zh-CN');
const oldWbs = await readFile(path.join(root, 'examples/project-case/zh-CN/wbs.mmd'), 'utf8');
const oldRaci = JSON.parse(await readFile(path.join(root, 'examples/project-case/zh-CN/raci.json'), 'utf8'));
const roleIds = oldRaci.columns.slice(1).map(column => column.key);
const roleNames = ['项目发起人','项目经理','业务负责人','开发负责人','运维负责人','信息管理负责人','质量负责人','CRM供应商'];
const groups = [...oldWbs.matchAll(/subgraph (G\d)\["([^"\n]+)"\]/g)].map(match => ({id:match[1],name:match[2]}));
const plan = [
  ['WP111','2026-10-01','2026-10-08','2026-10-10','done','2026-10-10',1,[]],
  ['WP112','2026-10-03','2026-10-11','2026-10-11','done','2026-10-11',1,[]],
  ['WP113','2026-10-07','2026-10-16','2026-10-16','active',null,1,[]],
  ['WP121','2026-10-11','2026-10-22','2026-10-22','active',null,3,['WP111']],
  ['WP122','2026-10-11','2026-10-23','2026-10-23','active',null,3,['WP111']],
  ['WP123','2026-10-14','2026-10-27','2026-10-27','active',null,3,['WP112']],
  ['WP131','2026-10-11','2026-10-20','2026-10-23','active',null,5,['WP111']],
  ['WP132','2026-10-06','2026-10-12','2026-10-18','active',null,3,[]],
  ['WP133','2026-10-09','2026-10-16','2026-10-16','active',null,4,[]],
  ['WP141','2026-10-26','2026-11-04','2026-11-04','planned',null,7,['WP113','WP121','WP122','WP131','WP132','WP133']],
  ['WP142','2026-10-15','2026-10-26','2026-10-26','planned',null,6,['WP112']],
  ['WP143','2026-11-05','2026-11-10','2026-11-10','planned',null,9,['WP141']],
  ['WP151','2026-10-19','2026-11-04','2026-11-04','planned',null,9,['WP112','WP132']],
  ['WP152','2026-10-19','2026-11-06','2026-11-06','planned',null,9,['WP132']],
  ['WP153','2026-11-11','2026-11-16','2026-11-16','planned',null,8,['WP141','WP143','WP151','WP152']],
  ['WP161','2026-10-01','2026-10-05','2026-10-05','done','2026-10-05',0,[]],
  ['WP162','2026-10-06','2026-11-18','2026-11-18','active',null,2,['WP161']],
  ['WP163','2026-10-06','2026-11-18','2026-11-18','active',null,2,['WP161']],
];
const nodes = new Map([...oldWbs.matchAll(/(WP\d+)\["([^"\n]+)"\]/g)].map(match => [match[1],match[2]]));
const tasks = plan.map(([id,start,finish,forecastFinish,status,actualFinish,row,dependsOn]) => {
  const [title,acceptance] = nodes.get(id).replaceAll('<br/>','').split('验收证据：');
  return {id,title,groupId:`G${id[3]}`,acceptance,responsibilities:Object.fromEntries(roleIds.map(role=>[role,oldRaci.rows[row][role]])),baseline:{start,finish},forecast:{start,finish:forecastFinish},actualFinish,status,dependsOn};
});
const project = {schema:'kobo.pm-project/v1',id:'crm-pm-teaching',name:'客户服务系统首版实施｜独立虚构教学分支',statusDate:'2026-10-14',roles:roleIds.map((id,index)=>({id,name:roleNames[index]})),groups,tasks,actions:[],decisions:[{id:'DEC-01',title:'短信是否纳入首版：尚待范围、资源与授权决定',status:'pending'}],appliedUpdates:[]};
const quote = (sourceId,text)=>[{sourceId,quote:text}];
const set = (id,targetId,field,expected,value,text)=>({id,kind:'task.set',targetId,field,expected,value,evidence:quote('week-01',text)});
const week1 = `# 第一次周会纪要｜2026-10-16

这是独立的虚构教学分支。仅用来演示 PM Skill；不覆盖原 CRM 画册的事实。

1. CRM供应商表示，WP132的接口恢复预计完成日从2026-10-18调整为2026-10-21，开始日仍为2026-10-06。这是预测，不是实际完成或批准后的基准。
2. 开发与业务核对后，WP131的数据映射预计完成日从2026-10-23调整为2026-10-26，开始日仍为2026-10-11。原批准基准完成日2026-10-20不变。
3. 质量负责人确认，WP113的30个验收场景及判定标准已在2026-10-16完成核对。本项完成不表示后续30个验收测试已经通过。
4. 开发负责人应在2026-10-19前取得供应商对认证、重试和并发验证的明确答复。
5. 项目经理应在2026-10-19前协调测试阶段的3人日资源缺口；本次会议没有确认已经补足人员。
6. 短信增加8人日只是初步估计，费用和纳入首版的决定仍待评估。短信范围、预算和批准基准均不变。
`;
const one = {schema:'kobo.pm-update/v1',id:'WEEK-01',asOf:'2026-10-16',sources:[{id:'week-01',file:'week-01.md'}],changes:[
  set('C01','WP132','forecast',{start:'2026-10-06',finish:'2026-10-18'},{start:'2026-10-06',finish:'2026-10-21'},'WP132的接口恢复预计完成日从2026-10-18调整为2026-10-21，开始日仍为2026-10-06。'),
  set('C02','WP131','forecast',{start:'2026-10-11',finish:'2026-10-23'},{start:'2026-10-11',finish:'2026-10-26'},'WP131的数据映射预计完成日从2026-10-23调整为2026-10-26，开始日仍为2026-10-11。'),
  set('C03','WP113','actualFinish',null,'2026-10-16','WP113的30个验收场景及判定标准已在2026-10-16完成核对。'),
  set('C04','WP113','status','active','done','WP113的30个验收场景及判定标准已在2026-10-16完成核对。'),
  {id:'C05',kind:'action.add',value:{id:'ACT-01',title:'取得CRM供应商认证、重试和并发验证答复',ownerRoleId:'dev',dueDate:'2026-10-19',status:'open'},evidence:quote('week-01','开发负责人应在2026-10-19前取得供应商对认证、重试和并发验证的明确答复。')},
  {id:'C06',kind:'action.add',value:{id:'ACT-02',title:'协调测试阶段3人日资源缺口',ownerRoleId:'pm',dueDate:'2026-10-19',status:'open'},evidence:quote('week-01','项目经理应在2026-10-19前协调测试阶段的3人日资源缺口；本次会议没有确认已经补足人员。')},
  {id:'C07',kind:'decision.set',targetId:'DEC-01',field:'title',expected:'短信是否纳入首版：尚待范围、资源与授权决定',value:'短信初步估计增加8人日，是否纳入首版尚待评估与授权',evidence:quote('week-01','短信增加8人日只是初步估计，费用和纳入首版的决定仍待评估。')},
]};
const week2 = `# 第二次周会纪要｜2026-10-21

这是独立的虚构教学分支，续接第一次周会后保存的项目状态。

1. 质量负责人确认，WP132的认证、重试和并发验证已经在2026-10-20完成，并有测试记录。该工作包可记为完成；这不代表WP141集成与业务验收已经完成。
2. 开发负责人已取得CRM供应商验证答复，ACT-01在本次会议确认为已完成。
3. WP131仍在核对数据映射，预计完成日从2026-10-26调整为2026-10-28，开始日仍为2026-10-11；原批准基准完成日2026-10-20不变。
4. WP133的重复数据判定由质量负责人增加执行复核职责，业务负责人仍为最终责任人，其他角色分工不变。WP133处理记录预计完成日从2026-10-16调整为2026-10-23，开始日仍为2026-10-09。
5. 质量负责人应在2026-10-23前复核80条重复键候选的样本及处理记录。这些候选不代表80条已经确认的数据丢失。
6. 80条重复键候选的处理规则仍待业务负责人最终确认。短信范围变更和ACT-02的资源缺口仍未获解决，不得记录为已批准或已关闭。
`;
const expectedRaci=project.tasks.find(task=>task.id==='WP133').responsibilities;
const set2=(id,targetId,field,expected,value,text)=>({id,kind:'task.set',targetId,field,expected,value,evidence:quote('week-02',text)});
const two={schema:'kobo.pm-update/v1',id:'WEEK-02',asOf:'2026-10-21',sources:[{id:'week-02',file:'week-02.md'}],changes:[
  set2('C08','WP132','actualFinish',null,'2026-10-20','WP132的认证、重试和并发验证已经在2026-10-20完成，并有测试记录。'),
  set2('C09','WP132','status','active','done','该工作包可记为完成；这不代表WP141集成与业务验收已经完成。'),
  {id:'C10',kind:'action.set',targetId:'ACT-01',field:'status',expected:'open',value:'done',evidence:quote('week-02','ACT-01在本次会议确认为已完成。')},
  set2('C11','WP131','forecast',{start:'2026-10-11',finish:'2026-10-26'},{start:'2026-10-11',finish:'2026-10-28'},'预计完成日从2026-10-26调整为2026-10-28，开始日仍为2026-10-11；原批准基准完成日2026-10-20不变。'),
  set2('C12','WP133','responsibilities',expectedRaci,{...expectedRaci,quality:'R'},'WP133的重复数据判定由质量负责人增加执行复核职责，业务负责人仍为最终责任人，其他角色分工不变。'),
  {id:'C13',kind:'action.add',value:{id:'ACT-03',title:'复核80条重复键候选样本和处理记录',ownerRoleId:'quality',dueDate:'2026-10-23',status:'open'},evidence:quote('week-02','质量负责人应在2026-10-23前复核80条重复键候选的样本及处理记录。')},
  {id:'C14',kind:'decision.add',value:{id:'DEC-02',title:'80条重复键候选的处理规则待业务负责人最终确认',status:'pending'},evidence:quote('week-02','80条重复键候选的处理规则仍待业务负责人最终确认。')},
  set2('C15','WP133','forecast',{start:'2026-10-09',finish:'2026-10-16'},{start:'2026-10-09',finish:'2026-10-23'},'WP133处理记录预计完成日从2026-10-16调整为2026-10-23，开始日仍为2026-10-09。'),
]};
const brief=`# 项目说明｜独立虚构教学分支

本例为客户服务系统首版实施的独立教学分支：3个业务窗口、40名用户、20,000条迁移记录。复用现有画册的工作包名称与角色词汇，但采用本分支自己的日程与职责设定；不改写画册中未批准的正式实施草案。

本分支的18个工作包、6组成果物和8个角色已经在project.json中登记，状态日为2026-10-14。baseline是本分支约定的批准基准，forecast是当前预测，两者分开保存。每项工作包都有验收条件；完成状态不替代其他工作包的验收。

两份纪要保留了预测延期、完成证据、资源缺口和待批准范围。update-01.json和update-02.json是AI应生成的结构化更新的人工审阅示例，已经逐条对应纪要原文。它们是测试输入，不是现场调用模型产生的记录。

演示脚本模拟PM选择合并这些有证据的记录变化；接受一条“待决事项”表示登记待决事项，不表示批准范围。Skill在实际项目中应按用户的明确要求和确认执行。

| 工作包 | 成果物 | 批准基准完成日 | 当前预测完成日 |
| --- | --- | --- | --- |
${tasks.map(task=>`| ${task.id} | ${task.title} | ${task.baseline.finish} | ${task.forecast.finish} |`).join('\n')}
`;
await mkdir(directory,{recursive:true});
for(const [name,value]of Object.entries({'project.json':project,'update-01.json':one,'update-02.json':two}))await writeFile(path.join(directory,name),JSON.stringify(value,null,2)+'\n');
await writeFile(path.join(directory,'project-brief.md'),brief);
await writeFile(path.join(directory,'week-01.md'),week1);
await writeFile(path.join(directory,'week-02.md'),week2);
console.log(JSON.stringify({directory,roles:project.roles.length,groups:groups.length,tasks:tasks.length,changes:one.changes.length+two.changes.length}));
