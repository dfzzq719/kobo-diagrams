import {contrastRatio,onColor} from './color-engine.mjs';

const DAY = 86_400_000;
const NS = 'http://www.w3.org/2000/svg';
const SPEC = /^\s*%%\s*taskobo-gantt-status\s+(\{[^\n]*\})\s*$/gm;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TAGS = new Set(['done','active','crit','milestone','vert']);

function day(value) {
  if (typeof value !== 'string' || !DATE.test(value)) throw new Error('工程差異の日付は YYYY-MM-DD で指定してください。');
  const time = Date.parse(value+'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0,10) !== value) throw new Error('工程差異の日付が正しくありません。');
  return time / DAY;
}

function declaredTasks(source) {
  const tasks = new Map();
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('%%') || !line.includes(':')) continue;
    const colon = line.indexOf(':'), label = line.slice(0,colon).trim();
    const parts = line.slice(colon+1).split(',').map(part=>part.trim());
    const tags=[];
    while (TAGS.has(parts[0])) tags.push(parts.shift());
    const [id,start,end]=parts;
    if (!id || !DATE.test(start||'')) continue;
    if (tasks.has(id)) throw new Error('工程差異で使用するタスク ID が重複しています。');
    tasks.set(id,{id,label,start,end,tags});
  }
  return tasks;
}

/** Optional Taskobo enhancement; all dates remain visible/editable Mermaid text.
 * It does not introduce a native Mermaid "delayed" state. An unenhanced renderer
 * still shows the baseline/current rows and the explicitly stated date variance.
 * Calendar-day differences use UTC midnight so DST cannot change the day count. */
export function parseGanttStatus(source) {
  source=String(source);
  const declarations=source.match(/^[\t ]*%%[\t ]*taskobo-gantt-status\b[^\n]*$/gm)||[];
  if (!declarations.length) return null;
  if (declarations.length !== 1) throw new Error('工程差異の設定は 1 件だけ指定してください。');
  const matches=[...source.matchAll(SPEC)];
  if (matches.length !== 1) throw new Error('工程差異の JSON 設定は、末尾の } まで 1 行で指定してください。');
  let data;
  try { data=JSON.parse(matches[0][1]); } catch { throw new Error('工程差異の JSON 設定を確認してください。'); }
  if (!data || typeof data!=='object' || Array.isArray(data) || Object.keys(data).some(key=>!['schema','calendar','asOf','statusMarker','items','plannedTasks'].includes(key))) throw new Error('工程差異の設定には日付・タスク ID・状態のみ指定できます。');
  if (data.schema !== 'taskobo.gantt-status/v1' || data.calendar !== 'calendar-days') throw new Error('工程差異は taskobo.gantt-status/v1・暦日単位に対応しています。');
  if (/^\s*excludes\s+\S/im.test(source)) throw new Error('工程差異のサンプルは暦日単位です。excludes は併用できません。');
  if (!/^\s*todayMarker\s+off\s*$/im.test(source)) throw new Error('工程差異では todayMarker off と固定の集計基準日を指定してください。');
  const asOf=day(data.asOf), tasks=declaredTasks(source), marker=tasks.get(data.statusMarker);
  if (!marker || !marker.tags.includes('milestone') || marker.start!==data.asOf || marker.end!=='0d') throw new Error('集計基準日のマイルストーンと設定日を一致させてください。');
  if (!Array.isArray(data.items) || !data.items.length || data.items.length>100) throw new Error('工程差異は 1〜100 件の作業を指定してください。');
  const ids=new Set();
  const items=data.items.map(item=>{
    if (!item || typeof item!=='object' || Array.isArray(item) || Object.keys(item).some(key=>!['baseline','current','baselineEnd','finish','stage','risk'].includes(key))) throw new Error('工程差異の作業には ID・日付・状態のみ指定できます。');
    const baseline=tasks.get(item.baseline),current=tasks.get(item.current);
    if (!baseline || !current || item.baseline===item.current || ids.has(item.baseline) || ids.has(item.current)) throw new Error('工程差異の基準・現在タスク ID を一意に指定してください。');
    ids.add(item.baseline);ids.add(item.current);
    if (!['done','forecast'].includes(item.stage)) throw new Error('工程差異の stage は done または forecast を指定してください。');
    if (item.risk!==undefined && typeof item.risk!=='boolean') throw new Error('工程差異の risk は true または false を指定してください。');
    const baselineEnd=day(baseline.end),finish=day(current.end);
    if (baselineEnd<day(baseline.start) || finish<day(current.start)) throw new Error('工程の終了日は開始日以降に指定してください。');
    if (baseline.end!==item.baselineEnd || current.end!==item.finish) throw new Error('工程差異の終了日と Mermaid 本文の終了日が一致していません。');
    if (item.stage==='done' && (!current.tags.includes('done') || finish>asOf)) throw new Error('完了実績には done を付け、集計基準日以前の終了日を指定してください。');
    if (item.stage==='forecast' && current.tags.includes('done')) throw new Error('未完了作業の予測に done は指定できません。');
    const varianceDays=finish-baselineEnd;
    const status=item.stage==='done' ? (varianceDays>0?'completed-late':'completed-on-time')
      : finish<asOf?'stale-forecast':baselineEnd<asOf?'overdue':varianceDays>0?'forecast-late':item.risk?'at-risk':'on-track';
    const wording={
      'completed-late':'完了・遅延確定','completed-on-time':'完了・期限内',
      overdue:'未完了・期限超過','stale-forecast':'予測期限切れ・要更新','forecast-late':'将来の遅延見込み','at-risk':'期限内予測・要注意','on-track':'期限内予測',
    }[status];
    return {...item,status,varianceDays,wording,baselineTask:baseline,currentTask:current};
  });
  const plannedTasks=data.plannedTasks===undefined?[]:data.plannedTasks;
  if (!Array.isArray(plannedTasks) || plannedTasks.length>200) throw new Error('計画案のタスク ID は 200 件以内の配列で指定してください。');
  const plans=plannedTasks.map(id=>{
    const task=typeof id==='string'?tasks.get(id):null;
    if (!task || ids.has(id) || id===data.statusMarker) throw new Error('計画案のタスク ID は一意にし、基準・実績・予測・集計基準日と分けてください。');
    ids.add(id);
    if (task.tags.includes('done') || task.tags.includes('active')) throw new Error('計画案に done・active は指定できません。実績・予測行とは区別してください。');
    const start=day(task.start);
    if (start<asOf) throw new Error('計画案の開始日は集計基準日以降を指定してください。');
    if (task.tags.includes('milestone')) {
      if (task.end!=='0d') throw new Error('計画案のマイルストーンは 0d を指定してください。');
    } else if (day(task.end)<start) throw new Error('計画案は開始日・終了日を明示し、終了日を開始日以降にしてください。');
    return task;
  });
  return {...data,items,plans};
}

function setStyle(node,values) { if(node)for(const [key,value]of Object.entries(values))node.style.setProperty(key,String(value),'important'); }
function nativeId(svg,id) { return svg.id+'-'+id; }
function labelFor(svg,id) { return [...svg.querySelectorAll('text[id]')].find(node=>node.id===id+'-text'||node.id===nativeId(svg,id)+'-text'); }
function rectFor(svg,id) { return [...svg.querySelectorAll('rect.task')].find(node=>node.id===id||node.id===nativeId(svg,id)); }

function rootBounds(svg,node) {
  const box=node.getBoundingClientRect(),inverse=svg.getScreenCTM()?.inverse();
  if(!inverse)return null;
  const points=[[box.left,box.top],[box.right,box.top],[box.left,box.bottom],[box.right,box.bottom]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(inverse));
  const x=Math.min(...points.map(point=>point.x)),y=Math.min(...points.map(point=>point.y));
  return {x,y,width:Math.max(...points.map(point=>point.x))-x,height:Math.max(...points.map(point=>point.y))-y};
}

function addTopDateAxis(svg,packet,bars) {
  const grid=svg.querySelector('g.grid');
  if(!grid?.querySelector('.tick text') || svg.querySelector('.taskobo-gantt-top-axis'))return;
  const axis=grid.cloneNode(true),matrix=grid.transform.baseVal.consolidate()?.matrix;
  axis.classList.remove('grid');axis.classList.add('taskobo-gantt-top-axis');
  axis.removeAttribute('id');
  for(const node of axis.querySelectorAll('[id]'))node.removeAttribute('id');
  for(const node of axis.querySelectorAll('line,path'))node.remove();
  for(const text of axis.querySelectorAll('text'))setStyle(text,{fill:packet.palette.muted,'font-size':Math.max(12,packet.settings.fontSize-4)+'px'});
  // Preserve the native tick X coordinates, but place their text above row one.
  const a=matrix?.a??1,b=matrix?.b??0,c=matrix?.c??0,d=matrix?.d??1,e=matrix?.e??0;
  axis.setAttribute('transform',`matrix(${a} ${b} ${c} ${d} ${e} 0)`);
  axis.setAttribute('aria-label','日付目盛・下部の時間軸と同じ');svg.append(axis);
  const firstBarTop=Math.min(...bars.map(bar=>rootBounds(svg,bar)?.y??Infinity)),box=rootBounds(svg,axis);
  if(!box || !Number.isFinite(firstBarTop)){axis.remove();return;}
  axis.setAttribute('transform',`matrix(${a} ${b} ${c} ${d} ${e} ${firstBarTop-8-box.y-box.height})`);
  // Reserve a real gap without shifting task dates or extending grid lines.
  // The renderer's final content-bounds pass includes a raised title naturally.
  const title=svg.querySelector('text.titleText'),top=rootBounds(svg,axis),titleBox=title&&rootBounds(svg,title);
  if(titleBox && top && titleBox.y+titleBox.height>top.y-8){
    const y=Number(title.getAttribute('y'));
    if(Number.isFinite(y))title.setAttribute('y',String(y+top.y-8-titleBox.y-titleBox.height));
  }
}

/** Call before the renderer's task-label overflow pass and final SVG bounds. */
export function enhanceGanttStatus(svg,packet) {
  if (packet.type!=='gantt') return null;
  const model=parseGanttStatus(packet.source);
  if (!model) return null;
  const p=packet.palette,s=packet.settings;
  for(const item of model.items){
    const baseline=rectFor(svg,item.baseline),current=rectFor(svg,item.current);
    if(!baseline || !current)throw new Error('工程差異のタスクバーが見つかりません。ID を確認してください。');
    baseline.dataset.taskoboGanttState='baseline';
    setStyle(baseline,{fill:'none',stroke:p.muted,'stroke-dasharray':'5 3','stroke-width':Math.max(1.5,s.lineWidth)});
    setStyle(labelFor(svg,item.baseline),{fill:p.ink});
    const late=['completed-late','overdue','stale-forecast'].includes(item.status);
    const caution=['forecast-late','at-risk'].includes(item.status);
    const fill=late?p.danger:caution?p.warning:item.stage==='done'?p.success:p.primary;
    current.dataset.taskoboGanttState=item.status;
    current.dataset.varianceDays=String(item.varianceDays);
    current.setAttribute('aria-label',`${item.currentTask.label}：${item.wording}、基準終了 ${item.baselineEnd}、${item.stage==='done'?'実績':'予測'}終了 ${item.finish}、差 ${item.varianceDays>0?'+':''}${item.varianceDays} 暦日`);
    setStyle(current,{fill,stroke:fill,'stroke-width':Math.max(1.5,s.lineWidth),'stroke-dasharray':item.stage==='forecast'?'6 3':'none'});
    setStyle(labelFor(svg,item.current),{fill:onColor(fill,p.ink)});
  }
  // A future plan is neither an approved paired baseline nor an actual result.
  // Keep it pale and dotted, including its hollow decision milestones, so the
  // solid actual / filled dashed forecast encoding remains unambiguous.
  const planStroke=[p.border,p.ink,'#000000','#FFFFFF'].find(color=>contrastRatio(color,p.neutral)>=3&&contrastRatio(color,p.paper)>=3)||p.border;
  for(const task of model.plans){
    const bar=rectFor(svg,task.id);
    if(!bar)throw new Error('計画案のタスクバーが見つかりません。ID を確認してください。');
    const milestone=task.tags.includes('milestone');
    bar.dataset.taskoboGanttState=milestone?'planned-milestone':'planned';
    bar.setAttribute('aria-label',`${task.label}：未承認の計画・判断予定、${task.start}${milestone?'':` から ${task.end}`}`);
    setStyle(bar,{fill:milestone?p.paper:p.neutral,stroke:planStroke,'stroke-width':Math.max(1.5,s.lineWidth),'stroke-dasharray':milestone?'none':'2 4'});
    setStyle(labelFor(svg,task.id),{fill:p.ink});
  }
  const marker=rectFor(svg,model.statusMarker);
  if(!marker)throw new Error('集計基準日のマイルストーンが見つかりません。');
  const x=Number(marker.getAttribute('x'))+Number(marker.getAttribute('width'))/2;
  const bars=[...svg.querySelectorAll('rect.task')];
  const y1=Math.min(...bars.map(bar=>Number(bar.getAttribute('y'))))-8;
  const y2=Math.max(...bars.map(bar=>Number(bar.getAttribute('y'))+Number(bar.getAttribute('height'))))+8;
  if(model.plans.length)addTopDateAxis(svg,packet,bars);
  const line=document.createElementNS(NS,'line');
  for(const [key,value]of Object.entries({x1:x,x2:x,y1,y2,stroke:p.primary,'stroke-width':Math.max(1.5,s.lineWidth),'stroke-dasharray':'3 5','pointer-events':'none'}))line.setAttribute(key,value);
  line.classList.add('taskobo-gantt-status-date');
  line.setAttribute('aria-label',`集計基準日 ${model.asOf}`);
  marker.parentElement.insertBefore(line,marker);
  const legend=document.createElementNS(NS,'g');
  legend.classList.add('taskobo-gantt-status-legend');
  const view=svg.viewBox.baseVal,fontSize=Math.max(12,s.fontSize-4),legendY=view.y+view.height+fontSize+10;
  const legendLines=[
    '基準＝空心破線　完了実績＝塗り実線　完了予測＝塗り破線（作業全体の期間）',
    '危険色＝完了遅延・期限超過　注意色＝将来遅延見込み・リスク　強調色＝期限内予測　成功色＝期限内完了',
    `差＝実績・予測終了日 − 基準終了日（土日祝を含む暦日）　集計基準日 ${model.asOf}`,
  ];
  if(model.plans.length)legendLines.push('計画案＝淡色・点線バー　白抜きの菱形＝判断予定・計画の節目（未承認／実績ではない）');
  legendLines.forEach((content,index)=>{
    const text=document.createElementNS(NS,'text');
    for(const [key,value]of Object.entries({x:view.x+16,y:legendY+index*(fontSize+9),fill:p.ink,'font-size':fontSize,'text-anchor':'start'}))text.setAttribute(key,value);
    text.textContent=content;legend.append(text);
  });
  svg.append(legend);
  svg.dataset.taskoboGanttAsOf=model.asOf;
  return model;
}
