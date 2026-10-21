import {normalizeHex,onColor} from './color-engine.mjs';

const GEOMETRY = 'rect,circle,ellipse,path,polygon,polyline';
const C4_TYPES = new Set([
  'person','system','system_db','system_queue','container','container_db',
  'container_queue','component','component_db','component_queue',
].flatMap(type=>[type,`external_${type}`]));

function paint(element,property,value) {
  if(value)element.style.setProperty(property,value,'important');
}

function labelColor(label,color) {
  if(!label)return;
  paint(label,'color',color);
  for(const text of label.querySelectorAll('text,tspan'))paint(text,'fill',color);
  for(const text of label.querySelectorAll('foreignObject div,foreignObject span'))paint(text,'color',color);
}

function computed(element) {
  return element.ownerDocument.defaultView.getComputedStyle(element);
}

// SVG styles are commonly exposed as rgb()/rgba(), even when configured as HEX.
// Composite translucent fills against the packet's canvas before choosing ink.
function visibleHex(value,canvas) {
  const hex=normalizeHex(value);
  if(hex)return hex;
  if(value==='none'||value==='transparent')return canvas;
  const match=/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(value||'');
  if(!match)return null;
  const alpha=match[4]===undefined?1:Math.max(0,Math.min(1,Number(match[4])));
  const background=normalizeHex(canvas)||'#FFFFFF';
  return '#'+[1,2,3].map((index)=>{
    const channel=Number(match[index])*alpha+parseInt(background.slice(index*2-1,index*2+1),16)*(1-alpha);
    return Math.round(Math.max(0,Math.min(255,channel))).toString(16).padStart(2,'0');
  }).join('').toUpperCase();
}

function c4Theme(svg,{palette:p}) {
  for(const node of svg.querySelectorAll('.c4-shape')) {
    const type=[...node.classList].find(name=>name.startsWith('c4-')&&C4_TYPES.has(name.slice(3)))?.slice(3);
    if(!type)continue;
    const external=type.startsWith('external_');
    const person=type==='person';
    const fill=external?p.neutral:person?p.anchor:p.surface;
    const stroke=person?p.anchor:p.border;
    const color=person?p.onAnchor:p.ink;
    // Unified C4 shapes put their real geometry in this direct child. The
    // empty measurement rects inside .label must retain their native styles.
    for(const container of node.querySelectorAll(':scope > .basic.label-container')) {
      const shapes=container.matches(GEOMETRY)?[container]:[...container.querySelectorAll(GEOMETRY)];
      for(const shape of shapes) {
        paint(shape,'fill',fill);
        paint(shape,'stroke',stroke);
      }
    }
    labelColor(node.querySelector(':scope > .label'),color);
  }

  // The pinned C4 renderer has no classes for legacy boundaries or relations.
  // They are direct root groups; node shapes, labels, defs and other diagrams
  // never match these structural selectors.
  for(const group of svg.querySelectorAll(':scope > g')) {
    const texts=[...group.querySelectorAll(':scope > text')];
    const rectangle=group.querySelector(':scope > rect');
    if(rectangle&&texts.length) {
      paint(rectangle,'stroke',p.border);
      if(computed(rectangle).fill!=='none')paint(rectangle,'fill',p.paper);
      texts.forEach(text=>labelColorForText(text,p.ink));
      continue;
    }
    const connections=[...group.querySelectorAll(':scope > line,:scope > path')];
    if(!connections.length)continue;
    for(const connection of connections)paint(connection,'stroke',p.line);
    texts.forEach(text=>labelColorForText(text,p.ink));
  }
  for(const text of svg.querySelectorAll(':scope > text'))labelColorForText(text,p.ink);
  for(const marker of svg.querySelectorAll('defs > marker')) {
    if(!/-(?:arrowhead|arrowend|crosshead|filled-head)$/.test(marker.id))continue;
    for(const path of marker.querySelectorAll('path')) {
      if(path.getAttribute('fill')!=='none')paint(path,'fill',p.line);
      paint(path,'stroke',p.line);
    }
  }
}

function labelColorForText(text,color) {
  paint(text,'fill',color);
  for(const span of text.querySelectorAll('tspan'))paint(span,'fill',color);
}

function boxInParent(element,parent) {
  const parentMatrix=parent.getCTM(),elementMatrix=element.getCTM();
  if(!parentMatrix||!elementMatrix)return null;
  const box=element.getBBox(),matrix=parentMatrix.inverse().multiply(elementMatrix);
  const corners=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]]
    .map(([x,y])=>({x:matrix.a*x+matrix.c*y+matrix.e,y:matrix.b*x+matrix.d*y+matrix.f}));
  const x=Math.min(...corners.map(point=>point.x)),y=Math.min(...corners.map(point=>point.y));
  return {x,y,width:Math.max(...corners.map(point=>point.x))-x,height:Math.max(...corners.map(point=>point.y))-y};
}

function containMindmapLabel(node,label,shape,settings) {
  if(!label.textContent.trim())return;
  const bounds=boxInParent(label,node),shapeBounds=boxInParent(shape,node);
  if(!bounds||!shapeBounds||![bounds.x,bounds.y,bounds.width,bounds.height,shapeBounds.x,shapeBounds.y,shapeBounds.width,shapeBounds.height].every(Number.isFinite))return;
  const cx=shapeBounds.x+shapeBounds.width/2,cy=shapeBounds.y+shapeBounds.height/2;
  const dx=cx-(bounds.x+bounds.width/2),dy=cy-(bounds.y+bounds.height/2);
  // Keep the native label content/line breaks and move its complete measured
  // box. Mermaid 11.17.2 leaves circle and some explicit-shape labels starting
  // at x=0 rather than centering their real text width inside their shape.
  if(Math.abs(dx)>.0001||Math.abs(dy)>.0001) {
    const matrix=label.transform.baseVal.consolidate()?.matrix;
    if(matrix)label.setAttribute('transform',`matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e+dx} ${matrix.f+dy})`);
    else label.setAttribute('transform',`translate(${dx} ${dy})`);
  }
  if(shape.matches('circle.basic.label-container')) {
    const padding=Math.max(8,(settings?.fontSize||18)*.55);
    const radius=Math.hypot(bounds.width/2+padding,bounds.height/2+padding);
    if(radius>Number(shape.getAttribute('r')))shape.setAttribute('r',String(Math.ceil(radius)));
  }
}

function mindmapTheme(svg,{palette:p,settings}) {
  for(const node of svg.querySelectorAll('.mindmap-node')) {
    const shape=node.querySelector(':scope > .basic.label-container,:scope > .node-bkg,:scope > polygon,:scope > path,:scope > circle,:scope > rect');
    const label=node.querySelector(':scope > .label');
    if(!shape||!label)continue;
    const fill=visibleHex(computed(shape).fill,p.paper);
    if(fill)labelColor(label,onColor(fill,p.ink));
    containMindmapLabel(node,label,shape,settings);
  }
}

function sankeyTheme(svg,{palette:p,settings}) {
  // Mermaid 11.17.2 hardcodes a categorical bank, even with themeVariables.
  // Map its node/gradient colors together; retain flow widths and node order.
  const series=p.series,colors=new Map();
  for(const node of svg.querySelectorAll('.nodes > .node > rect')) {
    const original=visibleHex(computed(node).fill,p.paper);
    if(!colors.has(original))colors.set(original,series[colors.size%series.length]);
    paint(node,'fill',colors.get(original));
    paint(node,'stroke',p.border);
  }
  for(const stop of svg.querySelectorAll('.links linearGradient stop')) {
    const original=visibleHex(computed(stop).stopColor,p.paper);
    paint(stop,'stop-color',colors.get(original)||p.primary);
  }
  // Opaque normal blending keeps flows legible on both light and dark paper.
  // A canvas-colored text stroke separates labels from crossing gradients.
  for(const group of svg.querySelectorAll('.links,.link')) {
    paint(group,'stroke-opacity','1');paint(group,'mix-blend-mode','normal');
  }
  const labels=svg.querySelector(':scope > .node-labels');
  if(labels)svg.append(labels);
  for(const text of svg.querySelectorAll('.node-labels text')) {
    labelColorForText(text,p.ink);paint(text,'font-size',`${settings.fontSize}px`);
    paint(text,'stroke',p.paper);paint(text,'stroke-width','4px');
    paint(text,'stroke-linejoin','round');paint(text,'paint-order','stroke');
  }
}

function pieReferences(svg) {
  // Identical percentages or grayscale slices must still map to the legend.
  // Both arrays follow the pinned renderer's pie order, including its sorting.
  const slices=[...svg.querySelectorAll('text.slice')],legends=[...svg.querySelectorAll('.legend > text')];
  if(slices.length!==legends.length)return;
  slices.forEach((slice,index)=>{
    const ref=String(index+1);
    slice.textContent=`${ref}: ${slice.textContent}`;
    legends[index].textContent=`${ref}. ${legends[index].textContent}`;
    slice.dataset.taskoboCategory=ref;legends[index].dataset.taskoboCategory=ref;
  });
}

/** Adapt native SVG families with gaps in Mermaid 11.17.2's theme API. */
export function applyNativeTheme(svg,packet) {
  if(packet.type==='c4')c4Theme(svg,packet);
  else if(packet.type==='mindmap')mindmapTheme(svg,packet);
  else if(packet.type==='sankey')sankeyTheme(svg,packet);
  else if(packet.type==='pie')pieReferences(svg);
  return svg;
}
