import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validDate} from './project.mjs';

export function parseCSV(text){
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  text=text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
  const push=()=>{row.push(cell);cell='';closed=false;};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
    else if(c===','){push();}
    else if(c==='\n'){push();if(row.some(value=>value.trim()))rows.push(row);row=[];}
    else if(c==='"'&&!cell&&!closed)quoted=true;
    else{if(closed)throw new Error('CSV 引号结束后只能紧接逗号或换行。');if(c==='"')throw new Error('CSV 字段中的双引号必须使用引号包围并写成两个双引号。');cell+=c;}
  }
  if(quoted)throw new Error('CSV 有未闭合的双引号。');
  if(cell||row.length||closed){push();if(row.some(value=>value.trim()))rows.push(row);}
  return rows;
}
const splitMD=line=>line.trim().replace(/^\|/,'').replace(/(?<!\\)\|$/,'').split(/(?<!\\)\|/).map(value=>value.trim().replace(/\\\|/g,'|'));
export function parseMarkdown(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/),tables=[];
  for(let i=0;i<lines.length-1;i++){
    if(!lines[i].includes('|')||!/^\s*\|?\s*:?-{3,}/.test(lines[i+1]))continue;
    const header=splitMD(lines[i]),separator=splitMD(lines[i+1]);
    if(separator.length!==header.length||!separator.every(cell=>/^:?-{3,}:?$/.test(cell)))continue;
    const rows=[header];i+=2;
    while(i<lines.length&&lines[i].includes('|')&&lines[i].trim()){rows.push(splitMD(lines[i]));i++;}
    tables.push(rows);
  }
  if(tables.length>1)throw new Error('Markdown 包含多个表格；请将要导入的任务表另存为一个文件，避免误把风险或会议表当作任务。');
  return tables[0]||[];
}
export function draftFrom(text,{extension,name=null,asOf=null,sourceName='plan.md',sourceSHA256=null}={}){
  if(asOf)validDate(asOf,'--as-of');
  const rows=extension==='.csv'?parseCSV(text):parseMarkdown(text),records=[];
  if(rows.length){
    const headers=rows[0];if(headers.some(value=>!value.trim())||new Set(headers).size!==headers.length)throw new Error('导入表头不能为空或重复。');
    if(rows.length>301)throw new Error('一次导入最多 300 个工作包，请按项目范围拆分。');
    for(const [index,cells]of rows.slice(1).entries()){
      if(cells.length!==headers.length)throw new Error('导入第 '+(index+2)+' 行的列数与表头不一致。');
      records.push({sourceRow:index+2,fields:Object.fromEntries(headers.map((key,i)=>[key,cells[i]]))});
    }
  }
  return {schema:'taskobo.pm-draft/v1',name,statusDate:asOf,baselineApproved:false,
    source:{file:sourceName,sha256:sourceSHA256,text},records,
    questions:['请核实项目名称、状态日与工作包编号。','请逐项确认验收条件、分组及 A／R；普通负责人列不能自动等同最终责任人或执行者。','请区分已批准基准与当前预测；材料中的计划日期尚未视为批准基准。','请确认任务状态、实际完成日与前置依赖。'],
    note:records.length?'表格原值已保留，尚未建立批准项目。':'未发现单一任务表，原文已保留；请让 AI 提取事实并列出缺口。'};
}
export async function initialize({from,out,name,'as-of':asOf}){
  if(!out)throw new Error('init 缺少 --out 输出目录。');
  let bytes=Buffer.alloc(0),extension='.md';
  if(from){extension=path.extname(from).toLowerCase();if(!['.md','.markdown','.csv'].includes(extension))throw new Error('init 支持 UTF-8 Markdown 或 CSV；Excel 请另存 CSV UTF-8，Word 请先提取 Markdown 文本。');bytes=await readFile(from);}
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const draft=draftFrom(text,{extension,name,asOf,sourceName:from?path.basename(from):'未提供材料',sourceSHA256:from?createHash('sha256').update(bytes).digest('hex'):null});
  await mkdir(path.dirname(path.resolve(out)),{recursive:true});
  try{await mkdir(out);}catch(error){if(error.code==='EEXIST')throw new Error('初始化目录已存在，拒绝覆盖：'+out);throw error;}
  await writeFile(path.join(out,'draft.json'),JSON.stringify(draft,null,2)+'\n',{flag:'wx'});
  await writeFile(path.join(out,'questions.md'),'# 初始化草稿，尚未确认\n\n'+draft.questions.map(question=>'- '+question).join('\n')+'\n\n让 AI 根据 draft.json 整理 project.json，缺少事实时向 PM 集中核实。完成后运行 pm.mjs check，再渲染。\n',{flag:'wx'});
  await writeFile(path.join(out,'plan-template.csv'),'id,title,group,acceptance,accountable,responsible,baselineStart,baselineFinish,forecastStart,forecastFinish,status,actualFinish,dependsOn\n',{flag:'wx'});
  return {output:path.resolve(out),draft:path.join(path.resolve(out),'draft.json'),records:draft.records.length,status:'draft',message:'原文与表格已保留；尚未确认的日期、责任和基准没有自动补值。'};
}
