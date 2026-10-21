import {derivePalette,deriveRaciPalette} from './color-engine.mjs';
import {renderDiagram as renderMermaid,getDiagramCapabilities as mermaidCapabilities,DEFAULT_SETTINGS} from './diagram-renderer.mjs';
const FONT='Noto Sans JP, Hiragino Kaku Gothic ProN, Yu Gothic, Meiryo, Microsoft YaHei, sans-serif';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
export const isTableSource=source=>String(source).trimStart().startsWith('{');
export function getDocumentCapabilities(source){
  if(!isTableSource(source))return mermaidCapabilities(source);
  return {type:'document-table',label:'プロジェクト管理表',status:'stable',controls:{palette:'full',fontSize:'full',radius:'partial',lineWidth:'full',curve:'none',density:'full',direction:'none',transparent:'full'},notes:['RACI・台帳は補助の表形式テンプレートです。Mermaid 標準記法ではありません。配色・文字・罫線は同じスタイル設定を使います。']};
}
export function parseTable(source){
  let doc;try{doc=JSON.parse(String(source).replace(/^\uFEFF/,''));}catch{throw new Error('表の JSON を確認してください。引用符・カンマ・括弧に誤りがあります。');}
  if(doc.schema!=='taskobo.table/v1'||!Array.isArray(doc.columns)||!Array.isArray(doc.rows))throw new Error('表には schema: taskobo.table/v1 と columns、rows が必要です。');
  if(doc.columns.length<2||doc.columns.length>10||doc.rows.length<1||doc.rows.length>80)throw new Error('表は 2〜10 列、1〜80 行にしてください。大きな表は分割すると読みやすくなります。');
  const keys=new Set();for(const col of doc.columns){if(!col||typeof col.key!=='string'||!col.key||keys.has(col.key))throw new Error('列の key は空欄や重複にできません。');keys.add(col.key);}
  for(const row of doc.rows)for(const key of keys)if(row[key]!=null&&!['string','number','boolean'].includes(typeof row[key]))throw new Error('セルには文字列または数値を指定してください。');
  if(doc.kind==='raci')for(let i=0;i<doc.rows.length;i++){
    const codes=doc.columns.slice(1).map(col=>String(doc.rows[i][col.key]??'').toUpperCase());
    if(codes.some(code=>!['','—','-','R','A','C','I','A/R','R/A'].includes(code)))throw new Error(`RACI の ${i+1} 行目は R・A・C・I（兼任は A/R）で指定してください。`);
    if(codes.filter(code=>code.includes('A')).length!==1)throw new Error(`RACI の ${i+1} 行目は最終責任者 A を 1 人にしてください。`);
    if(!codes.some(code=>code.includes('R')))throw new Error(`RACI の ${i+1} 行目に実行責任者 R を指定してください。`);
  }
  return doc;
}
function wrap(value,limit){
  const lines=[];
  for(const line of String(value??'—').split(/\r?\n/)){
    let text='',units=0;
    const flush=()=>{lines.push(text);text='';units=0;};
    // Latin words, dates and grouped numbers stay together when they fit a
    // column. CJK and other characters keep the original character wrapping.
    const tokens=line.match(/[\p{Script=Latin}\p{Number}]+(?:[’'.,:/-][\p{Script=Latin}\p{Number}]+)*[.,!?;:]*|[ \t]+|./gu)||[];
    for(const token of tokens){
      const size=textUnits(token);
      // A soft-break space must not create an indented or empty extra line.
      if(/^[ \t]+$/.test(token)&&units+size>limit)continue;
      if(size<=limit){
        if(units+size>limit&&text)flush();
        text+=token;units+=size;
      }else{
        // Only an overlong token falls back to bounded character chunks.
        for(const char of token){
          const width=textUnits(char);
          if(units+width>limit&&text)flush();
          text+=char;units+=width;
        }
      }
    }
    lines.push(text);
  }
  return lines;
}
const textUnits=value=>[...value].reduce((sum,char)=>sum+(/[\u0020-\u007E]/.test(char)?.55:1),0);
const RACI_LEGEND=[['A','最終責任'],['R','実行責任'],['C','相談先'],['I','報告先'],['A/R','最終・実行責任']];
function layoutRaciLegend(width,fontSize){
  const font=Math.max(12,fontSize-3),lineHeight=font*1.45,swatchWidth=Math.ceil(font*1.65)+16,swatchHeight=font+12,gap=10;
  const labelLimit=Math.max(1,(width-swatchWidth-gap)/font);
  let x=0,y=0,rowHeight=0;const items=[];
  for(const [code,label] of RACI_LEGEND){
    const lines=wrap(label,labelLimit),labelWidth=Math.max(...lines.map(textUnits))*font;
    const itemWidth=swatchWidth+gap+labelWidth,itemHeight=Math.max(swatchHeight,lines.length*lineHeight);
    if(x&&x+itemWidth>width){x=0;y+=rowHeight+12;rowHeight=0;}
    items.push({code,lines,x,y,width:swatchWidth,height:swatchHeight});
    x+=itemWidth+24;rowHeight=Math.max(rowHeight,itemHeight);
  }
  return {items,font,lineHeight,height:y+rowHeight};
}
export async function renderDocument(source,roles,settings,options={}){
  if(!isTableSource(source))return renderMermaid(source,roles,settings,options);
  const doc=parseTable(source),p=derivePalette(roles),s={...DEFAULT_SETTINGS,...settings};
  // Responsibility colours encode the code, never the alternating table row.
  const raci=doc.kind==='raci'?deriveRaciPalette(roles):null;
  const padding={compact:13,comfortable:19,spacious:26}[s.density]||19;
  const widths=doc.columns.map((col,index)=>Math.max(115,Math.min(330,Number(col.width)||(index===0?265:165))));
  const width=widths.reduce((sum,value)=>sum+value,0)+48;
  const top=80,lineHeight=s.fontSize*1.55;
  const prepared=[doc.columns.map(col=>String(col.label||col.key)),...doc.rows.map(row=>doc.columns.map(col=>String(row[col.key]??'—')))];
  const wrapped=prepared.map(row=>row.map((value,index)=>wrap(value,(widths[index]-padding*2)/s.fontSize)));
  const heights=wrapped.map(row=>Math.max(...row.map(lines=>lines.length))*lineHeight+padding*2);
  const tableHeight=heights.reduce((sum,value)=>sum+value,0),legend=raci?layoutRaciLegend(width-48,s.fontSize):null;
  const height=top+tableHeight+(legend?legend.height+48:46);
  const title=esc(doc.title||'プロジェクト管理表');let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><title>${title}</title><style>text{font-family:${esc(FONT)};font-size:${s.fontSize}px;fill:${p.ink}}.head{fill:${p.onAnchor};font-weight:600}.doc-title{font-size:${s.fontSize+5}px;font-weight:600}.legend{font-size:${Math.max(12,s.fontSize-3)}px;fill:${p.muted}}</style>`;
  if(!s.transparent)svg+=`<rect width="100%" height="100%" fill="${p.paper}"/>`;
  svg+=`<text x="24" y="43" class="doc-title">${title}</text><defs><clipPath id="table-shape"><rect x="24" y="${top}" width="${width-48}" height="${tableHeight}" rx="${s.radius}"/></clipPath></defs><g clip-path="url(#table-shape)">`;
  let y=top;
  for(let r=0;r<prepared.length;r++){let x=24;for(let c=0;c<widths.length;c++){
    const value=prepared[r][c].toUpperCase(),isCode=doc.kind==='raci'&&r>0&&c>0,code=value==='R/A'?'A/R':value,category=isCode?raci[code]:null;
    const fill=r===0?p.anchor:category?category.fill:r%2?p.surface:p.neutral;
    svg+=`<rect x="${x}" y="${y}" width="${widths[c]}" height="${heights[r]}" fill="${fill}" stroke="${p.grid}" stroke-width="${s.lineWidth*2/3}"${category?` data-raci-role="${code}"`:''}/>`;
    const center=isCode;const textX=center?x+widths[c]/2:x+padding;
    svg+=`<text x="${textX}" y="${y+padding+s.fontSize*1.05}"${r===0?' class="head"':''}${center?' text-anchor="middle" font-weight="600"':''}${category?` style="fill:${category.ink}"`:''}>`;
    wrapped[r][c].forEach((line,index)=>{svg+=`<tspan x="${textX}" dy="${index?lineHeight:0}">${esc(line)}</tspan>`;});svg+='</text>';x+=widths[c];
  }y+=heights[r];}
  svg+=`</g><rect x="24" y="${top}" width="${width-48}" height="${tableHeight}" rx="${s.radius}" fill="none" stroke="${p.border}" stroke-width="${s.lineWidth}"/>`;
  if(legend){
    svg+=`<g class="raci-legend" aria-label="RACI の役割と配色">`;
    for(const item of legend.items){
      const x=24+item.x,y=top+tableHeight+24+item.y,category=raci[item.code];
      svg+=`<rect x="${x}" y="${y}" width="${item.width}" height="${item.height}" rx="${Math.min(s.radius,4)}" fill="${category.fill}" stroke="${p.grid}" stroke-width="${s.lineWidth*2/3}" data-raci-role="${item.code}"/>`;
      svg+=`<text x="${x+item.width/2}" y="${y+item.height/2}" text-anchor="middle" dominant-baseline="central" font-weight="600" style="font-size:${legend.font}px;fill:${category.ink}">${item.code}</text>`;
      const labelX=x+item.width+10,labelY=y+(item.height-item.lines.length*legend.lineHeight)/2+legend.font*1.12;
      svg+=`<text x="${labelX}" y="${labelY}" class="legend" style="font-size:${legend.font}px">`;
      item.lines.forEach((line,index)=>{svg+=`<tspan x="${labelX}" dy="${index?legend.lineHeight:0}">${esc(line)}</tspan>`;});svg+='</text>';
    }
    svg+='</g>';
  }
  return {svg:svg+'</svg>',source:JSON.stringify(doc,null,2)+'\n',type:'document-table',palette:p,settings:s,width,height,capabilities:getDocumentCapabilities(source)};
}
