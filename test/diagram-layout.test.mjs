import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileDiagram} from '../src/index.mjs';

test('enterprise flowchart labels have a font-aware width without changing the business text',async()=>{
  const source=await readFile(new URL('../examples/project-case/wbs.mmd',import.meta.url),'utf8');
  const packet=compileDiagram(source,{}, {fontSize:22,density:'compact',curve:'linear'});
  assert.equal(packet.theme.flowchart.wrappingWidth,352);
  for(const text of ['real-endpoint authentication,','retry and concurrency cases verified'])assert.ok(packet.source.includes(text));
  assert.ok(compileDiagram(source,{}, {fontSize:14}).theme.flowchart.wrappingWidth>=240);
  assert.equal(compileDiagram('sequenceDiagram\nA->>B: Hello').theme.flowchart.wrappingWidth,undefined,'unrelated diagram families keep their engine width defaults');
});

test('Gantt section padding expands for long headings, stays bounded and preserves short Japanese layout',async()=>{
  const source=await readFile(new URL('../examples/project-case/schedule.mmd',import.meta.url),'utf8');
  const packet=compileDiagram(source,{}, {fontSize:22});
  assert.ok(packet.theme.gantt.leftPadding>600&&packet.theme.gantt.leftPadding<=720);
  assert.ok(packet.source.includes('Implementation proposal — independent testing and acceptance'));
  assert.equal(compileDiagram('gantt\nsection 企画\n確認 :a, 2026-10-14, 2026-10-15').theme.gantt.leftPadding,260);
  assert.equal(compileDiagram(`gantt\nsection ${'Very long heading '.repeat(100)}\nCheck :a, 2026-10-14, 2026-10-15`).theme.gantt.leftPadding,720);
});
