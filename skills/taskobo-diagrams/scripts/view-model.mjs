import {validateProject} from './project.mjs';

export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Business text is data. Generated IDs and syntax never come from user input.
const mermaidText=value=>String(value??'').replace(/[\r\n\t]/g,' ').replace(/[&<>"'\[\]{}:;`%#\\]/g,c=>'#'+c.codePointAt(0)+';');
const wrap=value=>{
  const lines=[];let line='',width=0;
  for(const char of String(value)){const units=/[\x20-\x7e]/.test(char)?.55:1;if(width+units>15&&!/[，。、；：！？）》】]/u.test(char)){lines.push(line);line='';width=0;}line+=char;width+=units;}
  if(line.length<4&&lines.length){const tail=lines.pop(),split=Math.max(1,tail.length-5);lines.push(tail.slice(0,split));line=tail.slice(split)+line;}
  lines.push(line);return lines.map(mermaidText).join('<br/>');
};
const single=value=>String(value??'').replace(/[\r\n\t]/g,' ').replace(/[<>:;"`%#\\]/g,c=>({'<':'＜','>':'＞',':':'：',';':'；','"':'＂','`':'＇','%':'％','#':'＃','\\':'／'}[c]));
const days=(a,b)=>Math.round((Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000);

export function projectViews(project){
  validateProject(project);
  const taskIndex=new Map(project.tasks.map((task,index)=>[task.id,index+1]));
  const wbs=['flowchart LR',`  P["${wrap(project.name)}<br/>状态日 ${project.statusDate}"]:::anchor`,'  %% 包含关系，不表示依赖；验收条件不代表已完成。'];
  [...project.groups].reverse().forEach((group,index)=>{
    const tasks=project.tasks.filter(task=>task.groupId===group.id);
    if(!tasks.length)return;
    wbs.push(`  subgraph G${index+1}["${mermaidText(group.name)}"]`);
    tasks.forEach(task=>wbs.push(`    T${taskIndex.get(task.id)}["${wrap(task.id+' '+task.title)}<br/>${wrap('验收条件：'+task.acceptance)}"]:::normal`));
    wbs.push('  end',`  P --> T${taskIndex.get(tasks[0].id)}`);
    for(let i=1;i<tasks.length;i++)wbs.push(`  T${taskIndex.get(tasks[i-1].id)} ~~~ T${taskIndex.get(tasks[i].id)}`);
  });
  const raci={schema:'taskobo.table/v1',kind:'raci',title:project.name+'｜责任分配｜'+project.statusDate,columns:[{key:'work',label:'工作包与交付物',width:330},...project.roles.map((role,index)=>({key:'role'+index,label:role.name.length>5?role.name.replace(/(负责人|供应商)$/u,'\n$1'):role.name,width:155}))],rows:project.tasks.map(task=>({work:task.id+' '+task.title,...Object.fromEntries(project.roles.map((role,index)=>['role'+index,task.responsibilities[role.id]||'']))}))};
  const items=project.tasks.map((task,index)=>({baseline:'b'+index,current:'c'+index,baselineEnd:task.baseline.finish,finish:task.actualFinish||task.forecast.finish,stage:task.status==='done'?'done':'forecast'}));
  const schedule=['gantt',`  title ${single(project.name)}｜基准与实际／预测`, '  dateFormat YYYY-MM-DD','  axisFormat %m/%d','  tickInterval 1week','  todayMarker off',`  %% taskobo-gantt-status ${JSON.stringify({schema:'taskobo.gantt-status/v1',calendar:'calendar-days',asOf:project.statusDate,statusMarker:'status_date',items,plannedTasks:[]})}`,'  section 固定状态日',`  状态日 ${project.statusDate} :milestone, status_date, ${project.statusDate}, 0d`];
  project.tasks.forEach((task,index)=>{
    const finish=task.actualFinish||task.forecast.finish,delta=days(finish,task.baseline.finish);
    const stage=task.status==='done'?'实际':'预测',deltaText=delta>0?'较基准晚'+delta+'天':delta<0?'较基准早'+(-delta)+'天':'与基准一致';
    schedule.push(`  section ${single(task.id+' '+task.title)}`,`  基准 :b${index}, ${task.baseline.start}, ${task.baseline.finish}`,task.status==='done'?`  实际完成 ${finish}／${deltaText} :done, milestone, c${index}, ${finish}, ${finish}`:`  ${stage}／${deltaText} :active, c${index}, ${task.forecast.start}, ${finish}`);
  });
  return {wbs:wbs.join('\n')+'\n',raci:JSON.stringify(raci,null,2)+'\n',schedule:schedule.join('\n')+'\n'};
}

export function projectSummary(project){
  const complete=project.tasks.filter(task=>task.status==='done').length;
  const delayed=project.tasks.filter(task=>(task.actualFinish||task.forecast.finish)>task.baseline.finish);
  const overdue=project.tasks.filter(task=>task.status!=='done'&&task.baseline.finish<project.statusDate);
  const byId=new Map(project.tasks.map(task=>[task.id,task]));
  const dependencyConflicts=project.tasks.flatMap(task=>task.dependsOn.flatMap(id=>{
    const predecessor=byId.get(id),finish=predecessor.actualFinish||predecessor.forecast.finish;
    return task.forecast.start<finish?[{taskId:task.id,predecessorId:id,predecessorFinish:finish,taskForecastStart:task.forecast.start}]:[];
  }));
  return {statusDate:project.statusDate,taskCount:project.tasks.length,completed:complete,delayedTaskIds:delayed.map(task=>task.id),overdueTaskIds:overdue.map(task=>task.id),dependencyConflicts,openActions:project.actions.filter(item=>item.status!=='done'),pendingDecisions:project.decisions.filter(item=>item.status==='pending')};
}

export function reviewPage(project,{candidate=false,review=null}={}){
  const s=projectSummary(project),esc=escapeHTML;
  const list=(items,fn)=>items.length?'<ul>'+items.map(item=>'<li>'+fn(item)+'</li>').join('')+'</ul>':'<p class="quiet">暂无记录。</p>';
  const changes=review?.changes||review?.proposals||[];
  const fieldNames={forecast:'完成预测',status:'状态',actualFinish:'实际完成日',responsibilities:'责任分配',title:'名称',acceptance:'验收条件',dependsOn:'前置依赖',ownerRoleId:'负责人',dueDate:'期限'};
  const kindNames={'task.set':'工作包调整','action.add':'新增行动项','action.set':'行动项调整','decision.add':'新增待决事项','decision.set':'决定调整'};
  const statuses={planned:'计划中',active:'进行中',done:'已完成',open:'待完成',pending:'待决策',approved:'已批准',rejected:'已拒绝',deferred:'已暂缓'};
  const roleName=id=>project.roles.find(role=>role.id===id)?.name||id;
  const responsibilityNames={A:'最终责任',R:'执行',C:'咨询',I:'告知','A/R':'最终责任与执行','':'未分配'};
  const valueText=(value,item)=>{
    if(value===null||value===undefined)return '尚未记录';
    if(item.field==='responsibilities')return Object.entries(value).map(([id,code])=>roleName(id)+'：'+responsibilityNames[code]).join('；');
    if(item.field==='ownerRoleId')return roleName(value);
    if(Array.isArray(value))return value.length?value.map(id=>{const task=project.tasks.find(task=>task.id===id);return task?id+' '+task.title:id;}).join('；'):'无';
    if(typeof value==='object'){
      if(value.start&&value.finish)return value.start+' 至 '+value.finish;
      const parts=[];
      if(value.title)parts.push(value.title);
      if(value.ownerRoleId)parts.push('负责人：'+roleName(value.ownerRoleId));
      if(value.dueDate)parts.push('期限：'+value.dueDate);
      if(value.status)parts.push('状态：'+(statuses[value.status]||value.status));
      return parts.length?parts.join('；'):'详见原始审阅材料';
    }
    return statuses[value]||String(value);
  };
  const changeList=list(changes,item=>'<strong>'+esc(item.id)+' '+esc(item.targetId||item.value?.id||'')+'</strong> '+esc(fieldNames[item.field]||kindNames[item.kind]||'材料调整')+(Object.hasOwn(item,'expected')?'<br/>原值：'+esc(valueText(item.expected,item)):'')+'<br/>建议：'+esc(valueText(item.value,item))+(item.alreadyApplied?' <span class="quiet">（已应用）</span>':'')+(item.evidence||[]).map(evidence=>'<blockquote>依据 '+esc(evidence.sourceId)+'：'+esc(evidence.quote)+'</blockquote>').join(''));
  const dependencies=list(s.dependencyConflicts,item=>esc(item.taskId)+' 预测开始于 '+esc(item.taskForecastStart)+'，早于前置工作包 '+esc(item.predecessorId)+' 的结束日 '+esc(item.predecessorFinish)+'。请 PM 评估并确认调整；未自动重排。');
  const figs=[['wbs','工作分解与验收','每个工作包均带验收条件。包含关系不表示执行顺序。'],['raci','责任分配','A 最终责任 · R 执行 · C 咨询 · I 告知 · A/R 最终与执行'],['schedule','项目日程','基准、实际完成日和预测分别显示。实际开始日未知，完成项仅显示完成日菱形。预测变化不会改写批准基准。']];
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${esc(project.name)}｜项目更新包</title><style>body{margin:0;background:#FFFEFA;color:#0D2046;font:16px/1.7 system-ui,'Microsoft YaHei',sans-serif}main{max-width:1120px;margin:auto;padding:40px 24px 72px}header{border-top:5px solid #1456D9;padding:24px 0}h1{font-size:clamp(26px,5vw,40px);line-height:1.25;margin:8px 0 16px;overflow-wrap:anywhere}h2{font-size:24px}h3{font-size:18px}.eyebrow,.quiet{color:#52637A}.notice{padding:16px 20px;border:1px solid #bb883a;background:#fff4dc;border-radius:0}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}.metric{padding:16px;background:#fff;border:1px solid #D9DEE8;border-radius:0}.metric strong{display:block;font-size:30px;line-height:1.3}.metric span{font-size:14px}section{margin:36px 0}figure{margin:12px 0 0;padding:16px;background:#fff;border:1px solid #D9DEE8;border-radius:0}img{width:100%;height:auto;display:block}a{color:#1456D9;text-underline-offset:3px}li{margin:6px 0;overflow-wrap:anywhere}blockquote{margin:8px 0;padding-left:14px;border-left:3px solid #bbb;color:#52637A}nav{display:flex;flex-wrap:wrap;gap:18px}.meta{font-size:14px}footer{border-top:1px solid #D9DEE8;margin-top:36px;padding-top:18px}@media(max-width:600px){main{padding:20px 14px 40px}.metrics{grid-template-columns:repeat(2,1fr)}figure{padding:6px}h2{font-size:22px}}</style></head><body><main><header><div class="eyebrow">Taskobo Diagrams · 项目材料更新包</div><h1>${esc(project.name)}</h1><p>状态日：${esc(project.statusDate)}。让项目经理专注判断、沟通与交付。</p>${candidate?'<p class="notice"><strong>拟更新预览，尚未确认。</strong>本页基于建议候选版本生成，未覆盖原项目。请逐项审阅后再应用。</p>':'<p class="notice">本页是所提供项目事实的静态视图；验收条件、预测日期和待决事项均不代表已获批准。</p>'}<nav><a href="#summary">周报摘要</a><a href="#wbs">工作分解</a><a href="#raci">责任分配</a><a href="#schedule">项目日程</a></nav></header><div class="metrics"><div class="metric"><strong>${s.taskCount}</strong><span>工作包</span></div><div class="metric"><strong>${s.completed}</strong><span>已记录完成</span></div><div class="metric"><strong>${s.delayedTaskIds.length}</strong><span>结束日期较基准晚</span></div><div class="metric"><strong>${s.pendingDecisions.length}</strong><span>待决事项</span></div></div><section id="summary"><h2>周报摘要</h2><p>截至 ${esc(project.statusDate)}，${s.completed} / ${s.taskCount} 个工作包记录为完成。${s.overdueTaskIds.length} 个未完成工作包已超过基准结束日。</p><h3>行动项</h3>${list(s.openActions,item=>esc(item.id+' '+item.title)+'；负责人：'+esc(project.roles.find(role=>role.id===item.ownerRoleId)?.name||item.ownerRoleId)+'；期限：'+esc(item.dueDate))}<h3>需要 PM 推进的决定</h3>${list(s.pendingDecisions,item=>esc(item.id+' '+item.title))}<h3>依赖时间冲突</h3>${dependencies}${review?'<h3>本次修改建议</h3>'+changeList:''}</section>${figs.map(([id,title,description])=>'<section id="'+id+'"><h2>'+title+'</h2><p>'+description+'</p><p class="meta"><a href="'+id+'.svg">打开矢量图</a> · <a href="'+id+'.png">打开图片</a> · <a href="sources/'+id+(id==='raci'?'.json':'.mmd')+'">可编辑源文件</a></p><figure><img src="'+id+'.png" alt="'+title+'，状态日 '+esc(project.statusDate)+'"></figure></section>').join('')}<footer><p>三类视图来自同一份项目事实。图表不改变原始责任、基准和依赖数据。完整依赖关系保存在 <a href="project.snapshot.json">项目快照</a>，出图过程见 <a href="report.json">生成报告</a>。${review?'<a href="review.snapshot.json">原始审阅材料</a>保留本次证据与修改记录。':''}</p></footer></main></body></html>`;
}
