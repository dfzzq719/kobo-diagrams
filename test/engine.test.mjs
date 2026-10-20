import test from 'node:test';
import assert from 'node:assert/strict';
import {createMermaidRenderer} from '../src/index.mjs';
import {enqueueMermaid} from '../src/mermaid-engine.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};

test('separate wrappers serialize initialize, parse, and render on one engine', async () => {
  const gate = deferred(), events = [];
  let theme;
  const engine = {
    initialize(config) { theme = config.theme; events.push(`init:${theme}`); },
    async parse(source) { events.push(`parse:${source}:${theme}`); if (source === 'A') await gate.promise; },
    async render(id, source) { events.push(`render:${source}:${theme}`); return {svg: `${id}:${theme}`}; },
  };
  const first = createMermaidRenderer(engine).render('A', {config: {theme: 'dark'}, id: 'one'});
  const second = createMermaidRenderer(engine).render('B', {config: {theme: 'neutral'}, id: 'two'});
  await tick();
  assert.deepEqual(events, ['init:dark', 'parse:A:dark']);
  gate.resolve();
  assert.deepEqual(await Promise.all([first, second]), [{svg: 'one:dark'}, {svg: 'two:neutral'}]);
  assert.deepEqual(events, ['init:dark', 'parse:A:dark', 'render:A:dark', 'init:neutral', 'parse:B:neutral', 'render:B:neutral']);
});

for (const failure of ['initialize', 'parse', 'render']) {
  test(`queue recovers after ${failure} failure`, async () => {
    let fail = true;
    const check = phase => {if (fail && phase === failure) {fail = false; throw new Error(phase);}};
    const engine = {
      initialize() {check('initialize');},
      async parse() {check('parse');},
      async render() {check('render'); return {svg: '<svg/>'};},
    };
    const renderer = createMermaidRenderer(engine);
    const bad = renderer.render('bad');
    const good = renderer.render('good');
    await assert.rejects(bad, new RegExp(failure));
    assert.deepEqual(await good, {svg: '<svg/>'});
  });
}

test('queues are independent per engine and preserve ordinary source/config', async () => {
  const gate = deferred();
  const engineA = {initialize() {}, parse: () => gate.promise, render: async () => ({svg: 'A'})};
  const seen = [];
  const engineB = {initialize(config) {seen.push(config);}, async parse(source) {seen.push(source);}, async render(id, source, container) {seen.push(container); return {svg: id};}};
  const pending = createMermaidRenderer(engineA).render('A');
  const source = '---\nconfig:\n  look: handDrawn\n---\nnewFutureDiagram\nstyle custom fill:red';
  const container = {};
  assert.deepEqual(await createMermaidRenderer(engineB).render(source, {id: 'B', container, config: {securityLevel: 'loose', htmlLabels: true}}), {svg: 'B'});
  assert.equal(seen[0].securityLevel, 'loose');
  assert.equal(seen[0].htmlLabels, true);
  assert.equal(seen[0].startOnLoad, false);
  assert.equal(seen[1], source);
  assert.equal(seen[2], container);
  gate.resolve();
  await pending;
});

test('configuration is captured before waiting and full enterprise work holds the queue', async () => {
  const gate = deferred(), events = [];
  const engine = {initialize(config) {events.push(config.themeVariables.primaryColor);}, async parse() {}, async render() {return {svg: '<svg/>'};}};
  const enterprise = enqueueMermaid(engine, async () => {events.push('measure'); await gate.promise; events.push('measured');});
  const config = {themeVariables: {primaryColor: '#123456'}};
  const plain = createMermaidRenderer(engine).render('graph TD; A-->B', {config});
  config.themeVariables.primaryColor = '#FFFFFF';
  await tick();
  assert.deepEqual(events, ['measure']);
  gate.resolve();
  await Promise.all([enterprise, plain]);
  assert.deepEqual(events, ['measure', 'measured', '#123456']);
});

test('invalid engines fail early', () => {
  assert.throws(() => createMermaidRenderer({render() {}}), /Mermaid instance/);
});

test('ordinary rendering defaults to strict while allowing an explicit caller policy', async () => {
  let config;
  const engine = {initialize(value) {config = value;}, async parse() {}, async render() {return {svg: '<svg/>'};}};
  await createMermaidRenderer(engine).render('graph TD; A-->B');
  assert.equal(config.securityLevel, 'strict');
  assert.equal(config.startOnLoad, false);
});
