import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, symlink, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validateProject, prepareUpdate, applyUpdate, reviewUpdate } from '../skills/kobo-pm-update/scripts/project.mjs';

const execute = promisify(execFile);
const cli = fileURLToPath(new URL('../skills/kobo-pm-update/scripts/pm.mjs', import.meta.url));
const clone = structuredClone;
const dateRange = { start: '2026-10-12', finish: '2026-10-18' };
const evidence = [{ sourceId: 'minutes', quote: '接口预计延期三天，增加核对行动，完成后复核。' }];

function project() {
  return {
    schema: 'kobo.pm-project/v1', id: 'demo', name: '教学项目', statusDate: '2026-10-14',
    roles: [{ id: 'pm', name: '项目经理' }, { id: 'dev', name: '开发负责人' }],
    groups: [{ id: 'delivery', name: '交付' }],
    tasks: ['WP1', 'WP2'].map((id, index) => ({
      id, title: `工作包${index + 1}`, groupId: 'delivery', acceptance: '按约定验证并留存证据',
      responsibilities: { pm: 'A', dev: 'R' }, baseline: clone(dateRange), forecast: clone(dateRange),
      actualFinish: null, status: 'active', dependsOn: index ? ['WP1'] : [],
    })),
    actions: [], decisions: [], appliedUpdates: [],
  };
}

function update() {
  return {
    schema: 'kobo.pm-update/v1', id: 'week-1', asOf: '2026-10-16',
    sources: [{ id: 'minutes', file: 'minutes.txt' }],
    changes: [
      { id: 'forecast', kind: 'task.set', targetId: 'WP1', field: 'forecast', expected: clone(dateRange), value: { start: dateRange.start, finish: '2026-10-21' }, evidence: clone(evidence) },
      { id: 'action', kind: 'action.add', value: { id: 'ACT1', title: '取得供应商明确答复', ownerRoleId: 'dev', dueDate: '2026-10-19', status: 'open' }, evidence: clone(evidence) },
      { id: 'decision', kind: 'decision.add', value: { id: 'DEC1', title: '是否纳入首版待决定', status: 'pending' }, evidence: clone(evidence) },
    ],
  };
}

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'kobo-pm-update-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = '周会纪要\n接口预计延期三天，增加核对行动，完成后复核。\n';
  await writeFile(path.join(directory, 'minutes.txt'), source);
  const updatePath = path.join(directory, 'update.json');
  const prepare = (p = project(), u = update()) => prepareUpdate(p, u, { updatePath });
  return { directory, source, updatePath, prepare };
}

test('PM 更新：部分接受保持批准基准，补充接受与重复执行不产生重复行动', async (t) => {
  const { prepare } = await fixture(t);
  const original = project();
  const originalSnapshot = clone(original);
  const prepared = await prepare(original);
  const first = applyUpdate(original, prepared, ['forecast']);
  assert.deepEqual(original, originalSnapshot, '不得修改输入对象');
  assert.deepEqual(first.tasks[0].baseline, dateRange, '预测延期不能改批准基准');
  assert.equal(first.tasks[0].forecast.finish, '2026-10-21');
  assert.equal(first.actions.length, 0);
  assert.equal(first.decisions.length, 0);
  assert.deepEqual(first.appliedUpdates[0].changeIds, ['forecast']);
  const second = applyUpdate(first, await prepare(first), ['forecast', 'action', 'decision']);
  assert.equal(second.actions.length, 1);
  assert.equal(second.decisions[0].status, 'pending');
  assert.deepEqual(applyUpdate(second, await prepare(second), ['forecast', 'action']), second);
  const review = reviewUpdate(first, await prepare(first));
  assert.deepEqual(review.appliedChangeIds, ['forecast']);
  assert.deepEqual(review.pendingChangeIds, ['action', 'decision']);
  assert.equal(review.changes[0].alreadyApplied, true);
  assert.equal(review.candidateProject.actions.length, 1);
  assert.match(review.sources[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(review.sources[0].file, 'minutes.txt', '公开报告仅保存相对路径');
});

test('PM 更新：旧值冲突整次失败，未选择项不被偷偷应用', async (t) => {
  const { prepare } = await fixture(t);
  const current = project();
  current.tasks[0].forecast.finish = '2026-10-20';
  const prepared = await prepare(current);
  assert.throws(() => applyUpdate(current, prepared, ['action', 'forecast']), /expected.*冲突/);
  assert.equal(current.actions.length, 0, '失败不得部分写入');
  const actionOnly = applyUpdate(current, prepared, ['action']);
  assert.equal(actionOnly.tasks[0].forecast.finish, '2026-10-20');
  assert.equal(actionOnly.actions.length, 1);
  assert.throws(() => applyUpdate(current, prepared, ['missing']), /不存在的修改 ID/);
  assert.throws(() => applyUpdate(current, prepared, ['action', 'action']), /重复/);
});

test('PM 更新：同 ID 内容或来源改变拒绝，重新排布 JSON 字段不改变哈希', async (t) => {
  const { prepare, directory } = await fixture(t);
  const firstPrepared = await prepare();
  const accepted = applyUpdate(project(), firstPrepared, ['action']);
  const changed = update();
  changed.changes[0].value.finish = '2026-10-22';
  await assert.rejects(prepare(accepted, changed), /更新 ID.*内容或来源改变/);
  const reordered = Object.fromEntries(Object.entries(update()).reverse());
  assert.equal((await prepare(project(), reordered)).updateHash, firstPrepared.updateHash);
  await writeFile(path.join(directory, 'minutes.txt'), '修订版纪要\n接口预计延期三天，增加核对行动，完成后复核。\n');
  await assert.rejects(prepare(accepted), /内容或来源改变/);
  const modifiedPrepared = clone(firstPrepared);
  modifiedPrepared.update.changes[0].value.finish = '2026-10-25';
  assert.throws(() => applyUpdate(project(), modifiedPrepared, ['forecast']), /内容被修改/);
});

test('PM 更新：引用、来源哈希、目录越界和二进制文件被拒绝', async (t) => {
  const { prepare, source, directory } = await fixture(t);
  const validHash = createHash('sha256').update(source).digest('hex');
  const hashed = update();
  hashed.sources[0].sha256 = validHash;
  await prepare(project(), hashed);
  hashed.sources[0].sha256 = '0'.repeat(64);
  await assert.rejects(prepare(project(), hashed), /SHA-256.*不符/);
  const quoted = update();
  quoted.changes[0].evidence[0].quote = '会议没有出现的承诺';
  await assert.rejects(prepare(project(), quoted), /引用不在来源/);
  const escaped = update();
  escaped.sources[0].file = '../outside.txt';
  await assert.rejects(prepare(project(), escaped), /越出更新目录树/);
  escaped.sources[0].file = path.join(directory, 'minutes.txt');
  await assert.rejects(prepare(project(), escaped), /相对路径/);
  await writeFile(path.join(directory, 'minutes.txt'), Buffer.from([0xff, 0xfe, 0]));
  await assert.rejects(prepare(), /UTF-8/);
});

test('PM 更新：符号链接的真实路径不能越出更新目录树', async (t) => {
  const { prepare, directory, source } = await fixture(t);
  const outside = path.join(directory, 'outside');
  const inside = path.join(directory, 'inside');
  await mkdir(outside);
  await mkdir(inside);
  await writeFile(path.join(outside, 'minutes.txt'), source);
  try { await symlink(outside, path.join(inside, 'link'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { t.skip('当前系统不允许创建符号链接'); return; } throw error; }
  const linked = update();
  linked.sources[0].file = 'link/minutes.txt';
  await assert.rejects(prepareUpdate(project(), linked, { updatePath: path.join(inside, 'update.json') }), /真实路径越出/);
  await prepare();
});

test('PM 项目：角色责任、日历日、完成状态及依赖引用与环均校验', () => {
  assert.equal(validateProject(project()).schema, 'kobo.pm-project/v1');
  const cases = [
    [(p) => { p.tasks[0].responsibilities.dev = 'A/R'; }, /恰有一位/],
    [(p) => { p.tasks[0].responsibilities.dev = 'C'; }, /执行者/],
    [(p) => { p.tasks[0].responsibilities.unknown = 'R'; }, /不存在的角色/],
    [(p) => { p.tasks[0].baseline.finish = '2026-02-30'; }, /有效日历日/],
    [(p) => { p.tasks[0].forecast.start = '2026-10-30'; }, /开始日晚于/],
    [(p) => { p.tasks[0].status = 'done'; }, /实际完成日/],
    [(p) => { p.tasks[0].status = 'done'; p.tasks[0].actualFinish = '2026-10-15'; }, /晚于项目状态日/],
    [(p) => { p.tasks[0].dependsOn = ['missing']; }, /前置任务不存在/],
    [(p) => { p.tasks[0].dependsOn = ['WP2']; }, /依赖存在环/],
    [(p) => { p.tasks[0].dependsOn = ['WP1']; }, /依赖自己/],
    [(p) => { p.roles.push(...Array.from({ length: 7 }, (_, i) => ({ id: `extra${i}`, name: '角色' }))); }, /1–8/],
  ];
  for (const [mutate, message] of cases) { const invalid = project(); mutate(invalid); assert.throws(() => validateProject(invalid), message); }
});

test('PM 更新：禁止基准变更；同一选择中的完成状态与日期共同校验', async (t) => {
  const { prepare } = await fixture(t);
  const baseline = update();
  baseline.changes[0].field = 'baseline';
  await assert.rejects(prepare(project(), baseline), /禁止修改批准基准/);
  const completion = update();
  completion.changes = [
    { id: 'status', kind: 'task.set', targetId: 'WP1', field: 'status', expected: 'active', value: 'done', evidence },
    { id: 'date', kind: 'task.set', targetId: 'WP1', field: 'actualFinish', expected: null, value: '2026-10-16', evidence },
  ];
  const prepared = await prepare(project(), completion);
  assert.throws(() => applyUpdate(project(), prepared, ['status']), /实际完成日/);
  assert.throws(() => applyUpdate(project(), prepared, ['date']), /必须为 null/);
  const done = applyUpdate(project(), prepared, ['status', 'date']);
  assert.equal(done.tasks[0].status, 'done');
  assert.equal(done.tasks[0].actualFinish, '2026-10-16');
  const backwards = clone(completion);
  backwards.id = 'older'; backwards.asOf = '2026-10-13';
  assert.throws(() => applyUpdate(project(), prepared, ['status', 'date', 'date']), /重复/);
  assert.throws(() => applyUpdate(project(), { ...prepared, update: backwards }, ['status', 'date']), /内容被修改/);
  const older = await prepare(project(), backwards);
  assert.throws(() => applyUpdate(project(), older, ['status', 'date']), /早于当前项目状态日/);
});

test('PM 更新：第二周关闭原行动和决策，不重复新增', async (t) => {
  const { prepare } = await fixture(t);
  const first = applyUpdate(project(), await prepare(), ['action', 'decision']);
  const secondUpdate = update();
  secondUpdate.id = 'week-2'; secondUpdate.asOf = '2026-10-21';
  secondUpdate.changes = [
    { id: 'close-action', kind: 'action.set', targetId: 'ACT1', field: 'status', expected: 'open', value: 'done', evidence },
    { id: 'decision-status', kind: 'decision.set', targetId: 'DEC1', field: 'status', expected: 'pending', value: 'deferred', evidence },
  ];
  const prepared = await prepare(first, secondUpdate);
  const second = applyUpdate(first, prepared, ['close-action', 'decision-status']);
  assert.equal(second.actions.length, 1);
  assert.equal(second.actions[0].status, 'done');
  assert.equal(second.decisions.length, 1);
  assert.equal(second.decisions[0].status, 'deferred');
  assert.deepEqual(applyUpdate(second, await prepare(second, secondUpdate), ['close-action']), second);
  assert.deepEqual(applyUpdate(second, await prepare(second, update()), ['action']), second, '旧周已接受项重放保持幂等');
  await assert.rejects(async () => applyUpdate(second, await prepare(second, update()), ['forecast']), /早于当前项目状态日/);
});

test('PM 命令：审阅和明确接受生成新文件，拒绝覆盖、缺少选择与无效候选', async (t) => {
  const { directory, updatePath } = await fixture(t);
  const projectPath = path.join(directory, 'project.json');
  const original = `${JSON.stringify(project(), null, 2)}\n`;
  await writeFile(projectPath, original);
  await writeFile(updatePath, JSON.stringify(update()));
  const reviewDir = path.join(directory, 'review');
  await execute(process.execPath, [cli, 'check', '--project', projectPath]);
  await execute(process.execPath, [cli, 'review', '--project', projectPath, '--update', updatePath, '--out', reviewDir]);
  const review = JSON.parse(await readFile(path.join(reviewDir, 'review.json'), 'utf8'));
  assert.equal(review.candidateProject.actions.length, 1);
  assert.match(await readFile(path.join(reviewDir, 'review.md'), 'utf8'), /拟更新预览，尚未确认/);
  await assert.rejects(execute(process.execPath, [cli, 'review', '--project', projectPath, '--update', updatePath, '--out', reviewDir]), /拒绝覆盖/);
  const output = path.join(directory, 'accepted.json');
  const acceptArgs = [cli, 'accept', '--project', projectPath, '--update', updatePath, '--select', 'action', '--out', output];
  await execute(process.execPath, acceptArgs);
  const accepted = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(accepted.actions.length, 1);
  assert.deepEqual(accepted.tasks[0].forecast, dateRange);
  await assert.rejects(execute(process.execPath, acceptArgs), /拒绝覆盖/);
  await assert.rejects(execute(process.execPath, [cli, 'accept', '--project', projectPath, '--update', updatePath, '--out', path.join(directory, 'no-select.json')]), /缺少 --select/);
  await assert.rejects(execute(process.execPath, [cli, 'accept', '--project', projectPath, '--update', updatePath, '--select', 'action', '--out', projectPath]), /拒绝覆盖/);
  assert.equal(await readFile(projectPath, 'utf8'), original);
  assert.match((await execute(process.execPath, [cli, '--help'])).stdout, /普通更新不能修改批准基准/);
});

test('PM 命令：拒绝逗号与参数前缀 ID，歧义选择不能应用其他修改或写入审阅结果', async (t) => {
  const { directory, updatePath } = await fixture(t);
  const projectPath = path.join(directory, 'project.json');
  const original = JSON.stringify(project());
  await writeFile(projectPath, original);
  for (const [index, invalidId] of ['C01,C02', '--C03'].entries()) {
    const invalid = update();
    invalid.changes[0].id = 'C01';
    invalid.changes[1].id = 'C02';
    invalid.changes[2].id = invalidId;
    await writeFile(updatePath, JSON.stringify(invalid));
    const reviewDir = path.join(directory, `ambiguous-review-${index}`);
    const output = path.join(directory, `ambiguous-accepted-${index}.json`);
    await assert.rejects(execute(process.execPath, [cli, 'review', '--project', projectPath, '--update', updatePath, '--out', reviewDir]), /修改 ID格式无效/);
    // 用户试图选第三项 C01,C02 时，不能误接受同名拆分后的前两项。
    const selected = invalidId.includes(',') ? invalidId : 'C01';
    await assert.rejects(execute(process.execPath, [cli, 'accept', '--project', projectPath, '--update', updatePath, '--select', selected, '--out', output]), /修改 ID格式无效/);
    await assert.rejects(stat(reviewDir), { code: 'ENOENT' });
    await assert.rejects(stat(output), { code: 'ENOENT' });
    assert.equal(await readFile(projectPath, 'utf8'), original);
  }
  const chinese = update();
  chinese.changes[0].id = '预测日期修改';
  await writeFile(updatePath, JSON.stringify(chinese));
  const output = path.join(directory, 'chinese-id-accepted.json');
  await execute(process.execPath, [cli, 'accept', '--project', projectPath, '--update', updatePath, '--select', '预测日期修改', '--out', output]);
  const accepted = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(accepted.tasks[0].forecast.finish, '2026-10-21');
  assert.equal(accepted.actions.length, 0);
  assert.deepEqual(accepted.appliedUpdates[0].changeIds, ['预测日期修改']);
});
