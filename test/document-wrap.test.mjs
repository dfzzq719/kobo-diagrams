import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderDocument,createDiagramProfile} from '../src/index.mjs';

const decode=value=>value.replace(/&(amp|lt|gt|quot|apos);/g,(_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[key]));
const units=value=>[...value].reduce((sum,char)=>sum+(/[\u0020-\u007E]/.test(char)?.55:1),0);
function cellTexts(svg){
  const group=svg.match(/<g clip-path="url\(#table-shape\)">([\s\S]*?)<\/g>/)[1];
  return [...group.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(([,body])=>({body,lines:[...body.matchAll(/<tspan\b[^>]*>([\s\S]*?)<\/tspan>/g)].map(([,line])=>decode(line))}));
}
async function renderCell(value,width=170){
  const source=JSON.stringify({schema:'taskobo.table/v1',kind:'register',columns:[{key:'text',label:'Text',width},{key:'other',label:'Other',width:115}],rows:[{text:value,other:'x'}]});
  const packet=await renderDocument(source,{}, {fontSize:22,density:'compact'});
  return {packet,...cellTexts(packet.svg)[2]};
}

test('actual SVG lines keep English words, dates and grouped numbers intact when they fit',async()=>{
  const value="Development Operations budget acceptance person-days owner's 20,000 2026-10-14";
  const {lines}=await renderCell(value);
  assert.deepEqual(lines.map(line=>line.trim()).join(' ').split(/\s+/),value.split(' '));
  const limit=(170-26)/22;
  for(const line of lines)assert.ok(units(line)<=limit+1e-10,`Line exceeds the content width: ${line}`);
});

test('an overlong token falls back to bounded chunks without losing its characters',async()=>{
  const token='SUPERCALIFRAGILISTICEXPIALIDOCIOUS20261014';
  const {lines}=await renderCell(token,115);
  assert.ok(lines.length>1);
  assert.equal(lines.join(''),token);
  const limit=(115-26)/22;
  for(const line of lines)assert.ok(units(line)<=limit+1e-10);
});

test('CJK keeps character wrapping while explicit newlines and blank lines remain visible',async()=>{
  assert.deepEqual((await renderCell('甲乙丙丁戊己庚辛壬癸',115)).lines,['甲乙丙丁','戊己庚辛','壬癸']);
  const value='Alpha\r\nBeta\n\nGamma — 20,000';
  const {lines,body,packet}=await renderCell(value,330);
  assert.deepEqual(lines,['Alpha','Beta','','Gamma — 20,000']);
  assert.match(body,/<tspan[^>]*dy="[1-9][^"]*"><\/tspan>/);
  assert.equal(JSON.parse(packet.source).rows[0].text,value);
});

test('HTML-like cell text remains escaped and configured column geometry stays bounded',async()=>{
  const value='<script>bad & "quoted"</script>';
  const {packet,body,lines}=await renderCell(value,999);
  assert.equal(packet.width,330+115+48,'column width still clamps to 330px');
  assert.doesNotMatch(packet.svg,/<script>/);
  assert.match(body,/&lt;script&gt;/);
  assert.match(body,/&amp;/);
  assert.match(body,/&quot;/);
  assert.equal(lines.join(''),value);
  assert.equal(JSON.parse(packet.source).rows[0].text,value);
});

test('the complete CRM RACI renders Development and Operations as whole header words',async()=>{
  const source=await readFile(new URL('../examples/project-case/raci.json',import.meta.url),'utf8');
  const manifest=JSON.parse(await readFile(new URL('../examples/project-case/case-manifest.json',import.meta.url),'utf8'));
  const profile=createDiagramProfile(manifest.profileOptions);
  const packet=await renderDocument(source,profile.roles,profile.settings);
  const cells=cellTexts(packet.svg);
  assert.deepEqual(cells[4].lines,['Development','Lead']);
  assert.deepEqual(cells[5].lines,['Operations','Lead']);
});
