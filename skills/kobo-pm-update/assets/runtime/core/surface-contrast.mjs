import {contrastRatio,onColor} from './color-engine.mjs';

// These grammars derive categorical or status surfaces which cannot be paired
// with one document-wide text color. Inspect their painted geometry instead.
const TYPES=new Set(['journey','git','pie','timeline','kanban','treemap','gantt']);
const NOT_PAINTED='defs,clipPath,mask,marker,pattern,symbol';

function rgba(value){
  const match=String(value).match(/^rgba?\(([^)]+)\)$/);
  if(!match)return null;
  const values=match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return values.length>=3&&values.every(Number.isFinite)?[...values.slice(0,3),values[3]??1]:null;
}
function hex(rgb){return '#'+rgb.slice(0,3).map(value=>Math.max(0,Math.min(255,Math.round(value))).toString(16).padStart(2,'0')).join('');}
function fromHex(value){return [1,3,5].map(index=>parseInt(value.slice(index,index+2),16));}
function composite(foreground,background,alpha){return foreground.map((value,index)=>value*alpha+background[index]*(1-alpha));}
function ancestorOpacity(element,root){let value=1;for(let node=element;node&&node!==root.parentElement;node=node.parentElement){value*=Number(getComputedStyle(node).opacity)||0;if(node===root)break;}return value;}
function visible(element,root){
  if(element.closest(NOT_PAINTED))return false;
  for(let node=element;node;node=node.parentElement){const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden')return false;if(node===root)break;}
  return true;
}

/** Correct foreground only when an actual rendered surface fails contrast.
 * User role colors, node shapes, chart values and status meanings are unchanged.
 * This is deterministic SVG postprocessing shared by previews and installed Skills.
 */
export function ensureSurfaceContrast(svg,packet){
  if(!TYPES.has(packet.type))return {adjusted:0,halos:0};
  const elements=[...svg.querySelectorAll('*')],order=new Map(elements.map((node,index)=>[node,index]));
  const paper=fromHex(packet.palette.paper),shapes=[];
  for(const node of svg.querySelectorAll('rect,circle,ellipse,polygon,path')){
    if(!visible(node,svg)||typeof node.isPointInFill!=='function')continue;
    const style=getComputedStyle(node),fill=rgba(style.fill);
    if(!fill)continue;
    const alpha=fill[3]*(Number(style.fillOpacity)||0)*ancestorOpacity(node,svg);
    if(alpha<=0)continue;
    const matrix=node.getScreenCTM();if(!matrix)continue;
    let inverse;try{inverse=matrix.inverse();}catch{continue;}
    const bounds=node.getBoundingClientRect();
    shapes.push({node,index:order.get(node),fill:fill.slice(0,3),alpha,inverse,bounds});
  }
  const backgroundAt=(point,before)=>{
    let color=[...paper];
    for(const shape of shapes){
      if(shape.index>=before)continue;
      const b=shape.bounds;if(point.x<b.left||point.x>b.right||point.y<b.top||point.y>b.bottom)continue;
      const local=point.matrixTransform(shape.inverse);
      try{if(shape.node.isPointInFill(local))color=composite(shape.fill,color,shape.alpha);}catch{}
    }
    return hex(color);
  };
  const leaves=[...svg.querySelectorAll('text')].flatMap(text=>{
    const spans=[...text.querySelectorAll('tspan')].filter(node=>!node.querySelector('tspan')&&node.textContent.trim());
    return spans.length?spans:[text];
  });
  let adjusted=0,halos=0;
  for(const text of leaves){
    if(!text.textContent.trim()||!visible(text,svg))continue;
    const style=getComputedStyle(text),foreground=rgba(style.fill);if(!foreground||foreground[3]===0)continue;
    const bounds=text.getBBox(),matrix=text.getScreenCTM();if(!matrix||bounds.width<=0||bounds.height<=0)continue;
    const before=order.get(text),backgrounds=[];
    for(const x of [.25,.5,.75])for(const y of [.35,.65])backgrounds.push(backgroundAt(new DOMPoint(bounds.x+bounds.width*x,bounds.y+bounds.height*y).matrixTransform(matrix),before));
    const distinct=[...new Set(backgrounds)],size=parseFloat(style.fontSize),bold=Number(style.fontWeight)>=700;
    const minimum=size>=24||(bold&&size>=18.6667)?3:4.5;
    const current=hex(foreground);
    if(distinct.every(background=>contrastRatio(current,background)>=minimum))continue;
    const candidates=[current,...distinct.map(background=>onColor(background,packet.palette.ink)),'#FFFFFF',packet.palette.ink,'#000000'];
    let best=current,bestScore=0;
    for(const candidate of [...new Set(candidates)]){const score=Math.min(...distinct.map(background=>contrastRatio(candidate,background)));if(score>bestScore){best=candidate;bestScore=score;}}
    if(bestScore>=minimum){text.style.setProperty('fill',best,'important');text.dataset.taskoboContrast='surface';adjusted++;}
    else{
      // Rotated commit labels can cross both a dark branch and the canvas.
      // An opaque canvas-colored under-stroke gives their letters one background.
      const foregroundOnPaper=onColor(packet.palette.paper,packet.palette.ink);
      text.style.setProperty('fill',foregroundOnPaper,'important');
      text.style.setProperty('stroke',packet.palette.paper,'important');
      text.style.setProperty('stroke-width',String(Math.max(3,size/6))+'px','important');
      text.style.setProperty('stroke-linejoin','round','important');
      text.style.setProperty('paint-order','stroke','important');
      text.dataset.taskoboContrast='halo';adjusted++;halos++;
    }
  }
  return {adjusted,halos};
}
