import {validateProject} from './project.mjs';
import {projectViews} from './view-model.mjs';

const short=(value,length)=>{const chars=Array.from(String(value));return chars.length>length?chars.slice(0,length-1).join('')+'…':String(value);};
const label=value=>chunks(Array.from(String(value).replace(/[\r\n\t]/g,' ')),24).map(chars=>chars.join('').replace(/[&<>"'\[\]{}:;`%#\\]/g,c=>'#'+c.codePointAt(0)+';')).join('<br/>');
const chunks=(items,size)=>Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size));
const day=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;

/** Pages are views of the complete validated project, never new project states. */
export function planViews(project,{pageSize=12,group,from,to}={}){
  validateProject(project);
  pageSize=Number(pageSize);
  if(!Number.isInteger(pageSize)||pageSize<1||pageSize>20)throw new Error('--page-size 必须是 1–20 的整数。');
  if(group&&!project.groups.some(item=>item.id===group))throw new Error('找不到分组：'+group);
  for(const [key,value]of Object.entries({from,to}))if(value&&!day(value))throw new Error('--'+key+' 必须是有效的 YYYY-MM-DD 日期。');
  if(from&&to&&from>to)throw new Error('--from 不能晚于 --to。');
  const tasks=project.tasks.filter(task=>!task.archived&&(!group||task.groupId===group)&&
    (!from||[task.baseline.finish,task.forecast.finish,task.actualFinish||''].some(date=>date>=from))&&
    (!to||[task.baseline.start,task.forecast.start].some(date=>date<=to)));
  if(!tasks.length)throw new Error('筛选后没有未归档工作包；请检查分组、时间范围或归档状态。');
  const jobs=[],counts={};
  const add=(kind,source,title,pageTasks,extra={})=>{
    const number=counts[kind]=(counts[kind]||0)+1,id=kind+(number===1?'':'-'+String(number).padStart(2,'0'));
    jobs.push({id,kind,source,title,taskIds:pageTasks.map(task=>task.id),...extra});
  };
  const compact=task=>({...task,title:short(task.title,64),acceptance:short(task.acceptance,100)});
  for(const item of project.groups){
    const pages=chunks(tasks.filter(task=>task.groupId===item.id),pageSize);
    pages.forEach((page,index)=>{
      const title=item.name+'｜'+(index+1)+' / '+pages.length;
      const copy={...project,name:short(project.name,24)+'｜'+short(title,20),groups:[item],roles:project.roles.map(role=>({...role,name:short(role.name,32)})),tasks:page.map(compact)};
      const views=projectViews(copy,{validate:false,vertical:true});
      for(const [part,work]of chunks(page,4).entries()){
        const wbs=projectViews({...copy,tasks:work.map(compact)},{validate:false,vertical:true}).wbs;
        add('wbs',wbs,'工作分解｜'+title+(page.length>4?'｜部分 '+(part+1):''),work,{groupId:item.id});
      }
      for(let roleStart=0;roleStart<project.roles.length;roleStart+=8){
        add('raci',views.raci,'责任分配｜'+title+'｜角色 '+(roleStart+1)+'–'+Math.min(roleStart+8,project.roles.length),page,
          {roleIds:project.roles.slice(roleStart,roleStart+8).map(role=>role.id),...(project.roles.length>8?{rolePanel:{from:roleStart,count:Math.min(8,project.roles.length-roleStart)}}:{})});
      }
      add('schedule',views.schedule,'项目日程｜'+title,page,{groupId:item.id});
    });
  }
  const byId=new Map(project.tasks.map(task=>[task.id,task]));
  const edges=tasks.flatMap(task=>task.dependsOn.map(id=>({from:id,to:task.id})));
  chunks(edges,Math.min(pageSize,16)).forEach((page,index)=>{
    const ids=[...new Set(page.flatMap(edge=>[edge.from,edge.to]))],selected=new Set(tasks.map(task=>task.id));
    const degree=new Map();for(const edge of page)for(const key of ['from','to'])degree.set(key+edge[key],(degree.get(key+edge[key])||0)+1);
    const source=['flowchart '+(Math.max(...degree.values())>2?'LR':'TB'),'  %% 箭头由前置工作包指向后续工作包；跨页任务重复显示，ID 不变。',
      ...ids.map((id,i)=>`  N${i}["${label(id+' '+short(byId.get(id).title,64))}${!selected.has(id)?'<br/>外部分组／筛选外前置':''}${byId.get(id).archived?'<br/>已归档':''}"]`),
      ...page.map(edge=>`  N${ids.indexOf(edge.from)} --> N${ids.indexOf(edge.to)}`)].join('\n')+'\n';
    add('dependencies',source,'依赖关系｜'+(index+1),ids.map(id=>byId.get(id)),{edges:page});
  });
  return {jobs,selection:{taskIds:tasks.map(task=>task.id),pageSize,group:group||null,from:from||null,to:to||null},
    notes:['图内名称与验收条件采用短标签；完整原文见工作包明细与项目快照。','时间筛选仅选择相交工作包，不改写基准、预测或依赖。']};
}
