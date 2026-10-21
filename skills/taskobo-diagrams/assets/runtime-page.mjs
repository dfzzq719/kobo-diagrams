import {createDiagramProfile,renderDocument,svgToPng,pngDimensions,CORE_VERSION,MERMAID_VERSION} from './runtime/core/index.mjs';

function localize(svg,id,date){
  const replaceText=(element,value)=>{const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);if(!nodes.length)throw new Error('中文图例缺少文本节点。');nodes[0].data=value;for(const node of nodes.slice(1))node.data='';};
  if(id==='raci'){
    const names={A:'最终责任',R:'执行',C:'咨询',I:'告知','A/R':'最终与执行'};
    const legend=svg.querySelector('.raci-legend');
    if(!legend)throw new Error('责任矩阵缺少图例。');
    legend.setAttribute('aria-label','责任编码与配色');
    for(const cell of legend.querySelectorAll('rect[data-raci-role]')){
      const label=cell.nextElementSibling?.nextElementSibling;
      if(!label?.matches('text.legend'))throw new Error('责任矩阵图例结构不兼容。');
      replaceText(label,names[cell.getAttribute('data-raci-role')]);
    }
  }
  if(id==='schedule'){
    const lines=['基准＝空心虚线　已完成实际＝完成日菱形（实际开始日未知）　预测＝填色虚线期间','风险色＝完成延误或已逾期　警示色＝未来预计延误　强调色＝期限内预测　成功色＝按期完成',`差异＝实际／预测结束日 − 基准结束日（日历天）　状态日 ${date}`,'计划草案＝浅色点线条　空心菱形＝待决事项或计划节点（未批准）'];
    const labels=[...svg.querySelectorAll('.taskobo-gantt-status-legend text')];
    if(labels.length!==3&&labels.length!==4)throw new Error('日程图例结构不兼容。');
    labels.forEach((text,i)=>{replaceText(text,lines[i]);});
    const replacements=[['完了・遅延確定','已完成且确认延期'],['完了・期限内','已完成且按期'],['未完了・期限超過','未完成且已逾期'],['予測期限切れ・要更新','预测期限已过，需更新'],['将来の遅延見込み','未来预计延期'],['期限内予測・要注意','预计按期但需关注'],['期限内予測','预计按期'],['基準終了','基准结束'],['実績終了','实际结束'],['予測終了','预测结束'],['暦日','日历天'],['未承認の計画・判断予定','未批准的计划或待决事项'],[' から ',' 至 '],['集計基準日 ','状态日 '],['日付目盛・下部の時間軸と同じ','日期刻度，与下方时间轴一致'],['、差 ','，差异 '],['、','，']];
    for(const el of svg.querySelectorAll('[aria-label]')){let text=el.getAttribute('aria-label');for(const [from,to]of replacements)text=text.replaceAll(from,to);el.setAttribute('aria-label',text);}
  }
}
function rolePanel(svg,panel){
  const ns='http://www.w3.org/2000/svg',height=Number(svg.getAttribute('height')),width=1618;
  const title=svg.querySelector('.doc-title');if(title)title.textContent='责任分配｜角色 '+(panel.from+1)+'–'+(panel.from+panel.count);
  const legend=svg.querySelector('.raci-legend')?.cloneNode(true);
  const root=document.createElementNS(ns,'svg');
  for(const [key,value]of Object.entries({xmlns:ns,width,height,viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':title?.textContent||'责任分配'}))root.setAttribute(key,value);
  const style=svg.querySelector('style');if(style)root.append(style.cloneNode(true));
  const background=document.createElementNS(ns,'rect');background.setAttribute('width','100%');background.setAttribute('height','100%');background.setAttribute('fill','#FFFEFA');root.append(background);
  for(const [x,viewX,w]of [[0,0,354],[354,354+panel.from*155,panel.count*155+24]]){
    const copy=svg.cloneNode(true);copy.querySelector('.raci-legend')?.remove();copy.querySelector('.doc-title')?.remove();
    copy.setAttribute('x',x);copy.setAttribute('width',w);copy.setAttribute('viewBox',`${viewX} 0 ${w} ${height}`);copy.setAttribute('overflow','hidden');root.append(copy);
  }
  if(title)root.append(title.cloneNode(true));if(legend)root.append(legend);
  return {svg:root,width,height};
}
const profile=createDiagramProfile({settings:{fontSize:22,density:'compact',curve:'linear'},standard:{name:'Taskobo Diagrams 中文项目材料',version:'1'}});
window.__taskoboRender=async job=>{
  let stage='SVG 渲染',holder;
  const progress=()=>console.info('TASKOBO_STAGE '+JSON.stringify({id:job.id,stage}));
  try{
    progress();
    let packet=await renderDocument(job.source,profile.roles,profile.settings,{mermaid:window.mermaid});
    holder=document.createElement('div');holder.style.cssText='position:absolute;left:0;top:0;visibility:hidden';holder.innerHTML=packet.svg;document.body.append(holder);
    await document.fonts.ready;
    let svg=holder.querySelector('svg');
    if(!svg||!Number.isFinite(packet.width)||packet.width<=0||!Number.isFinite(packet.height)||packet.height<=0)throw new Error('图表没有有效尺寸。');
    stage='中文图例与分页';progress();localize(svg,job.kind,job.statusDate);
    if(job.rolePanel){const panel=rolePanel(svg,job.rolePanel);svg=panel.svg;packet={...packet,width:panel.width,height:panel.height};}
    const localized={...packet,svg:svg.outerHTML};
    const result={ok:true,svg:localized.svg,width:packet.width,height:packet.height,type:packet.type,notes:packet.notes||[]};
    if(job.format==='all'){
      stage='PNG 导出';progress();
      try{
        const png=await svgToPng(localized,1);
        result.pngBase64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('无法读取 PNG。'));reader.readAsDataURL(png);});
        result.pngSize=pngDimensions(localized,1);
      }catch(error){result.warning={code:'PNG_EXPORT_FAILED',stage,message:'PNG 导出失败，已保留 SVG；可用 --format svg 重试。',detail:error.message};}
    }
    return result;
  }catch(error){return {ok:false,error:{code:error.code||'DIAGRAM_RENDER_FAILED',stage,message:error.message,detail:error.stack}};}
  finally{holder?.remove();}
};
window.__koboFinish({ok:true,profile,coreVersion:CORE_VERSION,mermaidVersion:MERMAID_VERSION});
