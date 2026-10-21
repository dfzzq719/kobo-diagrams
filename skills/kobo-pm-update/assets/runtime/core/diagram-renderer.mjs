import {derivePalette,contrastRatio,onColor} from './color-engine.mjs';
import {diagramCapabilitiesFor} from './diagram-catalog.mjs';
import {enhanceGanttStatus} from './gantt-status.mjs';
import {ensureSurfaceContrast} from './surface-contrast.mjs';
import {applyNativeTheme} from './native-theme-adapters.mjs';
import {enqueueMermaid,renderWithMermaid} from './mermaid-engine.mjs';
import {MERMAID_VERSION} from './version.mjs';

export const DEFAULT_SETTINGS = Object.freeze({radius:6,lineWidth:1.5,fontSize:18,curve:'basis',density:'comfortable',direction:'auto',transparent:false});
const FONT = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, "Microsoft YaHei", sans-serif';
let svgSequence = 0;

export function diagramKind(source) {
  const first = cleanSource(source).replace(/^(?:[ \t]*%%[^\n]*\n|\s)+/, '').trimStart();
  const kinds = [
    [/^(?:flowchart(?:-elk)?|graph)\b/i,'flowchart'],[/^stateDiagram(?:-v2)?\b/i,'state'],[/^sequenceDiagram\b/i,'sequence'],[/^gantt\b/i,'gantt'],
    [/^classDiagram(?:-v2)?\b/i,'class'],[/^erDiagram\b/i,'er'],[/^gitGraph\b/i,'git'],[/^journey\b/i,'journey'],[/^pie\b/i,'pie'],
    [/^quadrantChart\b/i,'quadrant'],[/^xychart(?:-beta)?\b/i,'xychart'],[/^requirement(?:Diagram)?\b/i,'requirement'],[/^timeline\b/i,'timeline'],
    [/^mindmap\b/i,'mindmap'],[/^kanban\b/i,'kanban'],[/^sankey(?:-beta)?\b/i,'sankey'],[/^packet(?:-beta)?\b/i,'packet'],[/^radar-beta\b/i,'radar'],
    [/^block(?:-beta)?\b/i,'block'],[/^architecture(?:-beta)?\b/i,'architecture'],[/^C4(?:Context|Container|Component|Dynamic|Deployment)\b/,'c4'],
    [/^treemap(?:-beta)?\b/i,'treemap'],[/^treeView-beta\b/i,'treeview'],[/^swimlane-beta\b/i,'swimlane'],[/^eventmodeling\b/i,'eventmodeling'],
    [/^ishikawa(?:-beta)?\b/i,'ishikawa'],[/^venn-beta\b/i,'venn'],[/^wardley-beta\b/i,'wardley'],[/^cynefin-beta(?=[\s:]|$)/i,'cynefin'],
    [/^railroad-ebnf-beta\b/i,'railroad-ebnf'],[/^railroad-abnf-beta\b/i,'railroad-abnf'],[/^railroad-peg-beta\b/i,'railroad-peg'],[/^railroad-beta\b/i,'railroad'],[/^info\b/i,'info']
  ];
  const found=kinds.find(([pattern])=>pattern.test(first));
  if(found){diagramCapabilitiesFor(found[1]);return found[1];}
  throw new Error(`Mermaid の図の種類を認識できません。先頭の宣言と、同梱の ${MERMAID_VERSION} で使える記法をご確認ください。`);
}

export function cleanSource(source) {
  return String(source).replace(/^\uFEFF/, '').replace(/^\s*---\r?\n[\s\S]*?\r?\n---(?:\s*\r?\n|\s*$)/, '').replace(/^[ \t]*%%\{[\s\S]*?\}%%[ \t]*(?:\r?\n)?/gm, '').trim();
}

export function getDiagramCapabilities(source) {return diagramCapabilitiesFor(diagramKind(source));}

// Keep harmless document metadata while replacing per-source rendering config.
// YAML config deliberately comes from this workbench so an imported theme cannot
// silently change the engine, security settings, or deterministic visual rules.
function sourceMetadata(source) {
  const match=String(source).replace(/^\uFEFF/,'').match(/^\s*---\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|\s*$)/);
  if(!match)return {};
  const result={};
  for(const key of ['title','accTitle','accDescr']){
    const value=match[1].match(new RegExp('^'+key+':[ \\t]*(.*)$','m'))?.[1]?.trim();
    if(!value || /^[|>]/.test(value))continue;
    if(value.startsWith('"')){try{result[key]=JSON.parse(value);}catch{result[key]=value;}}
    else result[key]=value.startsWith("'")&&value.endsWith("'")?value.slice(1,-1).replace(/''/g,"'"):value;
  }
  return result;
}

function ganttSectionPadding(source,fontSize){
  let widest=0;
  for(const [,label]of String(source).matchAll(/^\s*section\s+([^\r\n]+)/gm)){
    for(const line of label.split(/<br\s*\/?>/i)){
      const units=[...line.replace(/<[^>]*>/g,'')].reduce((sum,char)=>sum+(/\s/.test(char)?.35:/[\u0020-\u007E]/.test(char)?.6:1),0);
      widest=Math.max(widest,units*fontSize);
    }
  }
  return Math.max(260,Math.min(720,Math.ceil(widest+36)));
}

function themeFor(roles, input, body, type) {
  const p = derivePalette(roles), s = {...DEFAULT_SETTINGS,...input};
  const spacing = {compact:[24,36,16],comfortable:[32,50,22],spacious:[48,72,28]}[s.density] || [32,50,22];
  const aux = Math.max(.7, s.lineWidth * 2 / 3);
  // Categories describe peers; reserve success/warning/danger for explicit states.
  const series=p.series;
  const seriesVariables=Object.fromEntries(series.flatMap((color,i)=>[[`pie${i+1}`,color],[`cScale${i}`,color],[`cScaleLabel${i}`,onColor(color,p.ink)],[`fillType${i}`,color],[`git${i}`,color],[`gitBranchLabel${i}`,onColor(color,p.ink)],[`venn${i+1}`,color]]));
  const css = `
.node rect.basic,.node rect.label-container,.statediagram-state rect.basic,rect.actor,rect.task:not(.milestone),rect.note,rect.activation0,rect.activation1{rx:${s.radius}px!important;ry:${s.radius}px!important;stroke-width:${s.lineWidth}px!important;}
.node polygon,.node path,.statediagram-state polygon,rect.milestone{stroke-width:${s.lineWidth}px!important;stroke-linejoin:round!important;}
rect.milestone{rx:0!important;ry:0!important;transform:rotate(45deg) scale(.65);}
.flowchart-link,.edgePaths path,path.transition,.messageLine0,.messageLine1{stroke-width:${s.lineWidth}px!important;stroke-linecap:round!important;stroke-linejoin:round!important;}
.actor-line,.loopLine{stroke:${p.line}!important;stroke-width:${aux}px!important;stroke-linecap:round!important;stroke-linejoin:round!important;}
.loopLine,.messageLine1{stroke-dasharray:4 4!important;}
.edgeLabel text,.edgeLabel tspan{font-size:${Math.max(12,s.fontSize-4)}px!important;font-weight:400!important;fill:${p.muted}!important;}
.edgeLabel rect,.edgeLabel .labelBkg{fill:${p.paper}!important;opacity:1!important;}
.nodeLabel,.nodeLabel tspan{font-weight:500;}
.messageText,.loopText,.loopText tspan,.labelText{font-size:${Math.max(14,s.fontSize-2)}px!important;}
.actor{font-size:${s.fontSize-1}px!important;font-weight:500!important;}
.taskText{font-weight:500!important;}
.taskTextOutsideRight,.taskTextOutsideLeft{fill:${p.ink}!important;}
.grid .tick,.grid .tick line{stroke:${p.grid}!important;stroke-width:.75px!important;opacity:1!important;}
.classGroup rect,.classGroup .divider,.er.entityBox,.er.relationshipLine,.relationshipLine,.requirement,.requirement-relationship{stroke-width:${s.lineWidth}px!important;stroke-linejoin:round!important;}
.classGroup rect,.er.entityBox,.requirement{rx:${s.radius}px!important;ry:${s.radius}px!important;}
.em-box foreignObject span{color:${p.ink}!important;}
.eventWrapper{filter:none!important;}
.packetBlock{fill:${p.surface}!important;stroke:${p.border}!important;stroke-width:${s.lineWidth}px!important;}
.packetLabel,.packetTitle{fill:${p.ink}!important;}
.packetByte.start,.packetByte.end{fill:${p.muted}!important;}
${series.slice(0,8).map((color,index)=>`text.journey-section.section-type-${index}{fill:${onColor(color,p.ink)}!important;}`).join('\n')}
${series.slice(0,8).map((color,index)=>`circle.actor-${index}{fill:${color}!important;stroke:${onColor(color,p.ink)}!important;}`).join('\n')}
circle.face{fill:${p.surface}!important;stroke:${p.border}!important;}
circle.face~circle[r="1.5"]{fill:${p.ink}!important;stroke:${p.ink}!important;}
.mouth{fill:${p.ink}!important;stroke:${p.ink}!important;}
.task-line{stroke:${p.line}!important;}
`;
  return {
    startOnLoad:false,securityLevel:'strict',theme:'base',look:'classic',layout:'dagre',htmlLabels:false,fontFamily:FONT,deterministicIds:true,deterministicIDSeed:'taskobo-profile-v1',themeCSS:css,
    themeVariables:{
      ...seriesVariables,
      darkMode:contrastRatio(p.paper,'#000000')<contrastRatio(p.paper,'#FFFFFF'),background:p.paper,fontFamily:FONT,fontSize:`${s.fontSize}px`,radius:s.radius,strokeWidth:s.lineWidth,
      primaryColor:p.surface,primaryTextColor:p.ink,primaryBorderColor:p.border,
      secondaryColor:p.neutral,secondaryTextColor:p.ink,secondaryBorderColor:p.border,
      tertiaryColor:p.paper,tertiaryTextColor:p.ink,tertiaryBorderColor:p.border,
      lineColor:p.line,textColor:p.ink,mainBkg:p.surface,nodeBorder:p.border,
      clusterBkg:p.neutral,clusterBorder:p.border,edgeLabelBackground:p.paper,titleColor:p.ink,
      actorBkg:p.anchor,actorBorder:p.anchor,actorTextColor:p.onAnchor,actorLineColor:p.line,
      signalColor:p.border,signalTextColor:p.ink,labelBoxBkgColor:p.paper,labelBoxBorderColor:p.line,labelTextColor:p.ink,
      loopTextColor:p.ink,noteBkgColor:p.neutral,noteBorderColor:p.border,noteTextColor:p.ink,
      activationBkgColor:p.primarySoft,activationBorderColor:p.primary,sequenceNumberColor:onColor(p.border,p.ink),
      sectionBkgColor:p.neutral,sectionBkgColor2:p.neutral,altSectionBkgColor:p.paper,excludeBkgColor:p.grid,
      taskBkgColor:p.primary,taskBorderColor:p.primary,taskTextColor:p.onPrimary,taskTextLightColor:p.onPrimary,taskTextDarkColor:p.ink,
      taskTextOutsideColor:p.ink,activeTaskBkgColor:p.primarySoft,activeTaskBorderColor:p.primary,
      critBkgColor:p.danger,critBorderColor:p.danger,
      doneTaskBkgColor:p.successSoft,doneTaskBorderColor:p.success,gridColor:p.grid,
      stateBkg:p.surface,stateBorder:p.border,stateLabelColor:p.ink,transitionColor:p.line,transitionLabelColor:p.muted,
      labelBackgroundColor:p.paper,compositeBackground:p.paper,compositeTitleBackground:p.neutral,compositeBorder:p.border,
      classText:p.ink,relationColor:p.line,relationLabelColor:p.ink,relationLabelBackground:p.paper,
      requirementBackground:p.surface,requirementBorderColor:p.border,requirementBorderSize:String(s.lineWidth),requirementTextColor:p.ink,
      rowOdd:p.surface,rowEven:p.neutral,
      pieTitleTextColor:p.ink,pieTitleTextSize:`${s.fontSize+4}px`,pieLegendTextColor:p.ink,pieLegendTextSize:`${s.fontSize}px`,pieSectionTextColor:p.ink,pieSectionTextSize:`${s.fontSize}px`,pieStrokeColor:p.paper,pieStrokeWidth:`${s.lineWidth}px`,pieOuterStrokeColor:p.border,pieOuterStrokeWidth:`${s.lineWidth}px`,pieOpacity:'1',
      vennTitleTextColor:p.ink,vennSetTextColor:p.ink,
      archEdgeColor:p.line,archEdgeArrowColor:p.line,archEdgeWidth:String(s.lineWidth),archGroupBorderColor:p.border,archGroupBorderWidth:`${s.lineWidth}px`,
      quadrant1Fill:p.seriesSoft[0],quadrant2Fill:p.seriesSoft[1],quadrant3Fill:p.seriesSoft[2],quadrant4Fill:p.seriesSoft[3],
      quadrant1TextFill:p.ink,quadrant2TextFill:p.ink,quadrant3TextFill:p.ink,quadrant4TextFill:p.ink,quadrantPointFill:p.primary,quadrantPointTextFill:p.ink,quadrantXAxisTextFill:p.ink,quadrantYAxisTextFill:p.ink,quadrantInternalBorderStrokeFill:p.border,quadrantExternalBorderStrokeFill:p.border,quadrantTitleFill:p.ink,
      xyChart:{backgroundColor:p.paper,titleColor:p.ink,dataLabelColor:p.ink,legendTextColor:p.ink,xAxisTitleColor:p.ink,xAxisLabelColor:p.ink,xAxisTickColor:p.line,xAxisLineColor:p.line,yAxisTitleColor:p.ink,yAxisLabelColor:p.ink,yAxisTickColor:p.line,yAxisLineColor:p.line,plotColorPalette:series.slice(0,6).join(',')},
      radar:{axisColor:p.line,axisStrokeWidth:s.lineWidth,axisLabelFontSize:s.fontSize,curveStrokeWidth:s.lineWidth,graticuleColor:p.grid,graticuleStrokeWidth:aux,legendFontSize:s.fontSize},
      packet:{startByteColor:p.muted,endByteColor:p.muted,labelColor:p.ink,titleColor:p.ink,blockStrokeColor:p.border,blockFillColor:p.surface},
      treeView:{labelColor:p.ink,lineColor:p.line,iconColor:p.primary,descriptionColor:p.muted,highlightBg:p.primarySoft,highlightStroke:p.border},
      emSwimlaneBackgroundOdd:p.neutral,emSwimlaneBackgroundStroke:p.border,
      emUiFill:p.surface,emUiStroke:p.border,emProcessorFill:p.neutral,emProcessorStroke:p.border,
      emReadModelFill:p.successSoft,emReadModelStroke:p.success,emCommandFill:p.primarySoft,emCommandStroke:p.primary,emEventFill:p.warningSoft,emEventStroke:p.warning,
      cynefin:{domainFontSize:s.fontSize,itemFontSize:Math.max(12,s.fontSize-2),boundaryColor:p.line,boundaryWidth:s.lineWidth,cliffColor:p.danger,arrowColor:p.line,arrowWidth:s.lineWidth,complexBg:p.successSoft,complicatedBg:p.primarySoft,chaoticBg:p.dangerSoft,clearBg:p.warningSoft,confusionBg:p.neutral,textColor:p.ink,labelColor:p.ink},
      wardley:{backgroundColor:p.paper,axisColor:p.line,axisTextColor:p.ink,gridColor:p.grid,componentFill:p.surface,componentStroke:p.border,componentLabelColor:p.ink,linkStroke:p.line,evolutionStroke:p.primary,annotationStroke:p.border,annotationTextColor:p.ink,annotationFill:p.surface},
      useGradient:false,dropShadow:'none'
    },
    flowchart:{htmlLabels:false,curve:s.curve,nodeSpacing:spacing[0],rankSpacing:spacing[1],padding:spacing[2],useMaxWidth:true,...(type==='flowchart'?{wrappingWidth:Math.max(240,Math.min(420,s.fontSize*16))}:{})},
    sequence:{useMaxWidth:true,actorMargin:45,width:150,height:56,boxMargin:16,messageMargin:32,noteMargin:14,mirrorActors:false,wrap:true,actorFontSize:s.fontSize-1,messageFontSize:s.fontSize-2},
    gantt:{useMaxWidth:true,barHeight:30,barGap:14,topPadding:50,leftPadding:type==='gantt'?ganttSectionPadding(body,s.fontSize-2):260,rightPadding:130,fontSize:s.fontSize-2,sectionFontSize:s.fontSize-2,numberSectionStyles:2,topAxis:false},
    journey:{textPlacement:'tspan',sectionFills:series.slice(0,8),sectionColours:series.slice(0,8).map(color=>onColor(color,p.ink)),actorColours:series.slice(0,8),taskFontFamily:FONT,taskFontSize:s.fontSize,titleColor:p.ink,titleFontFamily:FONT,titleFontSize:s.fontSize+4},
    state:{useMaxWidth:true},architecture:{seed:1,randomize:false},cynefin:{seed:1},
    railroad:{fontFamily:FONT,fontSize:s.fontSize,strokeWidth:s.lineWidth,terminalFill:p.primarySoft,terminalStroke:p.primary,terminalTextColor:p.ink,nonTerminalFill:p.surface,nonTerminalStroke:p.border,nonTerminalTextColor:p.ink,lineColor:p.line,markerFill:p.line,commentFill:p.neutral,commentStroke:p.border,commentTextColor:p.muted,specialFill:p.warningSoft,specialStroke:p.warning,ruleNameColor:p.ink},
    c4:{fontFamily:FONT,personFontFamily:FONT,personFontSize:s.fontSize,personFontColor:p.onAnchor,personBgColor:p.anchor,personBorderColor:p.anchor,systemFontFamily:FONT,systemFontSize:s.fontSize,systemFontColor:p.ink,systemBgColor:p.primarySoft,systemBorderColor:p.primary,containerFontFamily:FONT,containerFontSize:s.fontSize,containerFontColor:p.ink,containerBgColor:p.surface,containerBorderColor:p.border,componentFontFamily:FONT,componentFontSize:s.fontSize,componentFontColor:p.ink,componentBgColor:p.surface,componentBorderColor:p.border,external_personFontColor:p.ink,external_personBgColor:p.neutral,external_personBorderColor:p.border,external_systemFontColor:p.ink,external_systemBgColor:p.neutral,external_systemBorderColor:p.border,relationshipFontFamily:FONT,relationshipFontSize:Math.max(12,s.fontSize-4),relationshipFontColor:p.muted,relationshipLineColor:p.line,boundaryFontColor:p.ink,boundaryBorderColor:p.border}
  };
}

function semanticClasses(p,s,type) {
  if (!['flowchart','state'].includes(type)) return '';
  const defs = {
    anchor:[p.anchor,p.border,p.onAnchor],section:[p.primarySoft,p.border,p.ink],
    normal:type==='state'?[p.primary,p.primary,p.onPrimary]:[p.surface,p.border,p.ink],
    neutral:[p.surface,p.border,p.ink],decision:[p.primarySoft,p.primary,p.ink],pending:[p.warningSoft,p.warning,p.ink],
    success:[p.successSoft,p.success,p.ink],danger:[p.dangerSoft,p.danger,p.ink],blocked:[p.dangerSoft,p.danger,p.ink]
  };
  return Object.entries(defs).map(([name,[fill,stroke,color]])=>`classDef ${name} fill:${fill},stroke:${stroke},color:${color},stroke-width:${s.lineWidth}px;`).join('\n') + (type==='flowchart'?`\nlinkStyle default stroke:${p.line},stroke-width:${s.lineWidth}px;`:'');
}

function yaml(value, depth=0) {
  return Object.entries(value).map(([key,entry])=>{
    const lead = ' '.repeat(depth)+key+':';
    return entry && typeof entry==='object'&&!Array.isArray(entry) ? lead+'\n'+yaml(entry,depth+2) : lead+' '+JSON.stringify(entry);
  }).join('\n');
}

// The pinned timeline renderer wraps only whitespace-delimited words or <br>.
// Its classic period/event nodes have a 150px text area inside a 190px shape.
// Add conservative, font-aware breaks before layout so Mermaid itself measures
// the taller node and positions subsequent events; no browser DOM is required.
function wrapTimelineLabels(source,fontSize) {
  const size=Number(fontSize)||DEFAULT_SETTINGS.fontSize,lines=source.split('\n');
  const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ja',{granularity:'grapheme'}):null;
  const graphemes=text=>segmenter?[...segmenter.segment(text)].map(item=>item.segment):Array.from(text);
  const sectionWidths=new Map();let section=-1,periods=0,descriptionBlock=false;
  const finishSection=()=>{if(section>=0)sectionWidths.set(section,200*Math.max(periods,1)-62);};
  for(const [index,line]of lines.entries()){
    if(descriptionBlock){if(/^\s*}/.test(line))descriptionBlock=false;continue;}
    if(/^\s*accDescr\s*{/.test(line)){descriptionBlock=!line.includes('}');continue;}
    if(/^\s*section\s+/i.test(line)){finishSection();section=index;periods=0;continue;}
    if(/^\s*(?:%%|timeline\b|title\b|accTitle\b|accDescr\b)/i.test(line)||!line.trim())continue;
    if(!/^\s*:/.test(line))periods++;
  }
  finishSection();
  const wrap=(text,width=138)=>text.split(/<br\s*\/?>/gi).map(part=>{
    const limit=Math.max(1,Math.floor(width/size)),chars=graphemes(part),wrapped=[];
    while(chars.length>limit){
      let cut=limit;
      // Prefer an existing space or phrase separator without removing it.
      for(let index=limit-1;index>=Math.ceil(limit/2)-1;index--)if(/[\s・／/、,;；]/u.test(chars[index])){cut=index+1;break;}
      wrapped.push(chars.splice(0,cut).join(''));
    }
    wrapped.push(chars.join(''));return wrapped.join('<br>');
  }).join('<br>');
  descriptionBlock=false;
  return lines.map((line,index)=>{
    if(descriptionBlock){if(/^\s*}/.test(line))descriptionBlock=false;return line;}
    if(/^\s*accDescr\s*{/.test(line)){descriptionBlock=!line.includes('}');return line;}
    const heading=line.match(/^(\s*section\s+)([^\r]*)(\r?)$/i);
    if(heading)return heading[1]+wrap(heading[2],sectionWidths.get(index))+heading[3];
    if(/^\s*(?:%%|timeline\b|title\b|accTitle\b|accDescr\b)/i.test(line)||!line.trim())return line;
    const carriage=line.endsWith('\r')?'\r':'',body=carriage?line.slice(0,-1):line;
    const indentation=body.match(/^\s*/)[0];
    return indentation+body.slice(indentation.length).split(':').map(part=>wrap(part)).join(':')+carriage;
  }).join('\n');
}

export function compileDiagram(body,roles,settings) {
  const s={...DEFAULT_SETTINGS,...settings},p=derivePalette(roles),type=diagramKind(body),theme=themeFor(p,s,body,type);
  let source=cleanSource(body);
  if(type==='timeline') source=wrapTimelineLabels(source,s.fontSize);
  if(s.direction!=='auto' && type==='flowchart') source=source.replace(/^(\s*(?:flowchart(?:-elk)?|graph))\s+(?:TD|TB|BT|LR|RL)\b/im,`$1 ${s.direction}`);
  if(s.direction!=='auto' && type==='state') {
    source=/^\s*direction\s+\w+/m.test(source)?source.replace(/^(\s*direction)\s+\w+/m,`$1 ${s.direction}`):source.replace(/^(stateDiagram(?:-v2)?[^\n]*)/im,`$1\n    direction ${s.direction}`);
  }
  const userStyles=[];
  if(['flowchart','state'].includes(type)) source=source.split('\n').filter(line=>{if(/^\s*(?:classDef|linkStyle|style)\s/.test(line)){userStyles.push(line);return false;}return true;}).join('\n');
  source+='\n'+semanticClasses(p,s,type)+'\n'+userStyles.join('\n');
  const {startOnLoad,...portable}=theme;
  return {source:`---\n${yaml({...sourceMetadata(body),config:portable})}\n---\n${source.trim()}\n`,theme,type,palette:p,settings:s,capabilities:diagramCapabilitiesFor(type)};
}

function localBounds(nodes) {
  const boxes=nodes.map(node=>node.getBBox()).filter(box=>Number.isFinite(box.x)&&Number.isFinite(box.y)&&box.width+box.height>0);
  if(!boxes.length)return null;
  const x=Math.min(...boxes.map(box=>box.x)),y=Math.min(...boxes.map(box=>box.y));
  return {x,y,width:Math.max(...boxes.map(box=>box.x+box.width))-x,height:Math.max(...boxes.map(box=>box.y+box.height))-y};
}

function arrangeRadar(element,packet) {
  const curves=[...element.querySelectorAll('path[class*="radarCurve-"]')];
  const chart=curves[0]?.parentElement;
  if(!chart)return;
  const legends=[...element.querySelectorAll('.radarLegendText')].map(text=>text.parentElement);
  const title=chart.querySelector('.radarTitle');
  const plot=localBounds([...chart.children].filter(node=>!legends.includes(node)&&node!==title));
  if(!plot)return;
  const {fontSize,lineWidth}=packet.settings;
  const patterns=['','7 4','2 4','10 3 2 3'];
  curves.forEach((curve,index)=>{
    curve.style.setProperty('fill-opacity','.055','important');
    curve.style.setProperty('stroke-width',String(Math.max(2,lineWidth)),'important');
    curve.style.setProperty('stroke-dasharray',patterns[index%patterns.length]||'none','important');
    curve.style.setProperty('stroke-linejoin','round','important');
  });
  if(title){title.setAttribute('x',plot.x+plot.width/2);title.setAttribute('y',plot.y-fontSize-16);}
  if(legends.length){
    const gap=26,cellWidth=Math.max(...legends.map(group=>group.querySelector('text').getBBox().width))+44;
    const columns=Math.max(1,Math.min(legends.length,Math.floor((plot.width+gap)/(cellWidth+gap))));
    const rowHeight=Math.max(30,fontSize+16),legendWidth=columns*cellWidth+(columns-1)*gap;
    const startX=plot.x+(plot.width-legendWidth)/2,startY=plot.y+plot.height+fontSize+24;
    legends.forEach((group,index)=>{
      const curve=curves[index],text=group.querySelector('text'),box=group.querySelector('rect');
      const line=document.createElementNS('http://www.w3.org/2000/svg','line');
      for(const [key,value]of Object.entries({x1:0,x2:24,y1:6,y2:6,stroke:curve?getComputedStyle(curve).stroke:packet.palette.primary,'stroke-width':Math.max(2,lineWidth),'stroke-linecap':'round','stroke-dasharray':patterns[index%patterns.length]||'none'}))line.setAttribute(key,value);
      line.classList.add('taskobo-radar-legend-line');
      box?.replaceWith(line);
      text.setAttribute('x',32);text.setAttribute('y',6);text.setAttribute('dominant-baseline','central');
      group.setAttribute('transform',`translate(${startX+(index%columns)*(cellWidth+gap)},${startY+Math.floor(index/columns)*rowHeight})`);
    });
  }
  // The pinned renderer provides equally spaced rings but no numeric labels.
  // Label only an explicit maximum, so no scale is invented for auto-scaled input.
  const maximum=Number(cleanSource(packet.source).match(/^\s*max\s+(\d+(?:\.\d+)?)\s*$/m)?.[1]);
  const rings=[...chart.querySelectorAll('circle.radarGraticule')];
  const outer=Math.max(...rings.map(ring=>Number(ring.getAttribute('r'))));
  if(maximum>0&&outer>0){
    for(const ring of rings){
      const r=Number(ring.getAttribute('r')),label=document.createElementNS('http://www.w3.org/2000/svg','text');
      label.textContent=String(Math.round(maximum*r/outer*100)/100);
      for(const [key,value]of Object.entries({x:8,y:-r+4,fill:packet.palette.muted,'font-size':Math.max(11,fontSize-5),'paint-order':'stroke',stroke:packet.palette.paper,'stroke-width':4,'stroke-linejoin':'round'}))label.setAttribute(key,value);
      label.classList.add('taskobo-radar-scale-label');chart.append(label);
    }
  }
}

function fitContentBounds(element,packet) {
  const view=element.viewBox.baseVal;
  if(!['radar','gantt'].includes(packet.type))return {x:view.x,y:view.y,width:view.width||1400,height:view.height||600};
  // Read the SVG's root coordinate space after labels/legend have been laid out.
  // This includes transformed groups and text that Mermaid's preset box omits.
  const content=localBounds([element]);
  if(!content)return {x:view.x,y:view.y,width:view.width||1400,height:view.height||600};
  const padding=Math.max(18,packet.settings.fontSize);
  const x=Math.min(view.x,content.x-padding),y=Math.min(view.y,content.y-padding);
  const width=Math.max(view.x+view.width,content.x+content.width+padding)-x;
  const height=Math.max(view.y+view.height,content.y+content.height+padding)-y;
  element.setAttribute('viewBox',`${x} ${y} ${width} ${height}`);
  return {x,y,width,height};
}

export function renderDiagram(body,roles,settings,{mermaid}={}) {
  const packet=compileDiagram(body,roles,settings);
  const engine=mermaid??globalThis.mermaid??globalThis.window?.mermaid;
  const run=async()=>{
    const mount=document.createElement('div');
    mount.className='render-sandbox';
    const renderWidth=1400+(packet.type==='gantt'?Math.max(0,packet.theme.gantt.leftPadding-260):0);
    mount.style.cssText=`position:fixed;left:-20000px;top:0;width:${renderWidth}px;pointer-events:none;`;
    mount.setAttribute('aria-hidden','true');document.body.append(mount);
    const id=`taskobo_workbench_${++svgSequence}`;
    try {
      const {svg}=await renderWithMermaid(engine,packet.source,{id,container:mount,config:{...packet.theme,suppressErrorRendering:true}});
      mount.innerHTML=svg;
      await document.fonts.ready;
      const element=mount.querySelector('svg');
      if(!element)throw new Error('描画できません。ソースを確認してください。');
      for(const bg of element.querySelectorAll('.edgeLabel rect.background')){
        const text=bg.parentElement.querySelector('text');if(!text?.textContent.trim())continue;
        const b=text.getBBox();bg.setAttribute('x',b.x-3);bg.setAttribute('y',b.y-2);bg.setAttribute('width',b.width+6);bg.setAttribute('height',b.height+4);
      }
      enhanceGanttStatus(element,packet);
      applyNativeTheme(element,packet);
      for(const task of element.querySelectorAll('rect.task:not(.milestone)')){
        const label=element.querySelector(`[id="${task.id}-text"]`);if(!label)continue;
        const bar=task.getBBox(),text=label.getBBox();
        if(text.width>bar.width-12||text.x<bar.x+4||text.x+text.width>bar.x+bar.width-4){
          label.setAttribute('x',bar.x+bar.width+10);label.setAttribute('text-anchor','start');
          label.style.setProperty('text-anchor','start','important');label.style.setProperty('fill',packet.palette.ink,'important');label.classList.add('taskTextOutsideRight');
        }
      }
      for(const rect of element.querySelectorAll('rect.basic.label-container,rect.actor,rect.task:not(.milestone),rect.note,rect.activation0,rect.activation1')){rect.setAttribute('rx',packet.settings.radius);rect.setAttribute('ry',packet.settings.radius);}
      if(packet.type==='radar')arrangeRadar(element,packet);
      ensureSurfaceContrast(element,packet);
      const {x,y,width,height}=fitContentBounds(element,packet);
      if(!packet.settings.transparent){
        const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');
        for(const [key,value]of Object.entries({x,y,width,height,fill:packet.palette.paper}))bg.setAttribute(key,value);
        bg.classList.add('taskobo-canvas-background');element.insertBefore(bg,element.firstChild);
      }
      element.setAttribute('xmlns','http://www.w3.org/2000/svg');element.setAttribute('width',width);element.setAttribute('height',height);
      element.style.removeProperty('max-width');element.style.removeProperty('background-color');
      return {...packet,svg:new XMLSerializer().serializeToString(element),width,height};
    } finally {mount.remove();document.getElementById('d'+id)?.remove();}
  };
  return enqueueMermaid(engine,run);
}

export async function svgToPng(packet,scale=2) {
  if(packet.width*packet.height*scale*scale>32_000_000) scale=Math.max(1,Math.sqrt(32_000_000/(packet.width*packet.height)));
  const url=URL.createObjectURL(new Blob([packet.svg],{type:'image/svg+xml;charset=utf-8'}));
  try{
    const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('PNG に変換できません。SVG で保存してお試しください。'));img.src=url;});
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(packet.width*scale);canvas.height=Math.ceil(packet.height*scale);
    const context=canvas.getContext('2d');
    if(!packet.settings.transparent){context.fillStyle=packet.palette.paper;context.fillRect(0,0,canvas.width,canvas.height);}
    context.scale(scale,scale);context.drawImage(image,0,0,packet.width,packet.height);
    return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG を保存できません。SVG をお試しください。')),'image/png'));
  }finally{URL.revokeObjectURL(url);}
}
