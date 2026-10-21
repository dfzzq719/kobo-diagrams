import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const PROJECT_SCHEMA = 'kobo.pm-project/v1';
const UPDATE_SCHEMA = 'kobo.pm-update/v1';
const TASK_FIELDS = new Set(['forecast', 'status', 'actualFinish', 'responsibilities', 'title', 'acceptance', 'dependsOn']);
const ACTION_FIELDS = new Set(['title', 'ownerRoleId', 'dueDate', 'status']);
const DECISION_FIELDS = new Set(['title', 'status']);
const HASH = /^[a-f0-9]{64}$/;
const own = (object, key) => Object.hasOwn(object, key);
const fail = (message) => { throw new Error(message); };

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label}必须是对象`);
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 10000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) fail(`${label}必须是非空文本`);
}

function id(value, label) {
  text(value, label);
  if (value.length > 128 || value.trim() !== value || /[\r\n,]/u.test(value) || value.startsWith('--')) fail(`${label}格式无效：不能包含 ASCII 逗号、换行、首尾空白或以 -- 开头，长度最多 128 字符`);
}

function list(value, label) {
  if (!Array.isArray(value)) fail(`${label}必须是数组`);
}

function unique(items, label) {
  list(items, label);
  const ids = new Set();
  for (const item of items) {
    object(item, label);
    id(item.id, `${label} ID`);
    if (ids.has(item.id)) fail(`${label} ID 重复：${item.id}`);
    ids.add(item.id);
  }
  return ids;
}

export function validDate(value, label = '日期') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) fail(`${label}必须是 YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(`${label}不是有效日历日：${value}`);
  return value;
}

function range(value, label) {
  object(value, label);
  validDate(value.start, `${label}开始日`);
  validDate(value.finish, `${label}结束日`);
  if (value.start > value.finish) fail(`${label}开始日晚于结束日`);
}

function action(value, roleIds) {
  text(value.title, `行动 ${value.id} 的标题`);
  if (!roleIds.has(value.ownerRoleId)) fail(`行动 ${value.id} 的负责人不存在：${value.ownerRoleId}`);
  validDate(value.dueDate, `行动 ${value.id} 的到期日`);
  if (!['open', 'done'].includes(value.status)) fail(`行动 ${value.id} 的状态无效`);
}

function decision(value) {
  text(value.title, `决策 ${value.id} 的标题`);
  if (!['pending', 'approved', 'rejected', 'deferred'].includes(value.status)) fail(`决策 ${value.id} 的状态无效`);
}

export function validateProject(project) {
  object(project, '项目');
  if (project.schema !== PROJECT_SCHEMA) fail(`项目 schema 必须是 ${PROJECT_SCHEMA}`);
  id(project.id, '项目 ID');
  text(project.name, '项目名称');
  validDate(project.statusDate, '项目状态日');
  const roleIds = unique(project.roles, '角色');
  if (roleIds.size < 1 || roleIds.size > 8) fail('项目需要 1–8 个角色');
  for (const role of project.roles) text(role.name, `角色 ${role.id} 的名称`);
  const groupIds = unique(project.groups, '分组');
  if (!groupIds.size) fail('项目至少需要一个分组');
  for (const group of project.groups) text(group.name, `分组 ${group.id} 的名称`);
  const taskIds = unique(project.tasks, '任务');
  if (taskIds.size < 1 || taskIds.size > 60) fail('项目需要 1–60 个任务');
  for (const task of project.tasks) {
    text(task.title, `任务 ${task.id} 的标题`);
    text(task.acceptance, `任务 ${task.id} 的验收标准`);
    if (!groupIds.has(task.groupId)) fail(`任务 ${task.id} 的分组不存在`);
    object(task.responsibilities, `任务 ${task.id} 的责任分配`);
    let accountable = 0;
    let responsible = 0;
    for (const [roleId, assignment] of Object.entries(task.responsibilities)) {
      if (!roleIds.has(roleId)) fail(`任务 ${task.id} 引用了不存在的角色：${roleId}`);
      if (!['A', 'R', 'C', 'I', 'A/R', ''].includes(assignment)) fail(`任务 ${task.id} 的责任值无效：${assignment}`);
      if (assignment === 'A' || assignment === 'A/R') accountable++;
      if (assignment === 'R' || assignment === 'A/R') responsible++;
    }
    if (accountable !== 1 || responsible < 1) fail(`任务 ${task.id} 必须恰有一位最终负责人 A，至少一位执行者 R`);
    range(task.baseline, `任务 ${task.id} 的批准基准`);
    range(task.forecast, `任务 ${task.id} 的当前预测`);
    if (!['planned', 'active', 'done'].includes(task.status)) fail(`任务 ${task.id} 的状态无效`);
    if (task.status === 'done') {
      validDate(task.actualFinish, `任务 ${task.id} 的实际完成日`);
      if (task.actualFinish > project.statusDate) fail(`任务 ${task.id} 的实际完成日晚于项目状态日`);
    } else if (task.actualFinish !== null) fail(`未完成任务 ${task.id} 的实际完成日必须为 null`);
    list(task.dependsOn, `任务 ${task.id} 的依赖`);
    if (new Set(task.dependsOn).size !== task.dependsOn.length) fail(`任务 ${task.id} 的依赖重复`);
    for (const predecessor of task.dependsOn) {
      if (!taskIds.has(predecessor)) fail(`任务 ${task.id} 的前置任务不存在：${predecessor}`);
      if (predecessor === task.id) fail(`任务 ${task.id} 不能依赖自己`);
    }
  }
  const tasksById = new Map(project.tasks.map((task) => [task.id, task]));
  const visited = new Set();
  const visiting = new Set();
  function visit(taskId) {
    if (visiting.has(taskId)) fail(`任务依赖存在环：${taskId}`);
    if (visited.has(taskId)) return;
    visiting.add(taskId);
    for (const predecessor of tasksById.get(taskId).dependsOn) visit(predecessor);
    visiting.delete(taskId);
    visited.add(taskId);
  }
  for (const taskId of taskIds) visit(taskId);
  unique(project.actions, '行动');
  for (const item of project.actions) action(item, roleIds);
  unique(project.decisions, '决策');
  for (const item of project.decisions) decision(item);
  unique(project.appliedUpdates, '已接受更新');
  for (const update of project.appliedUpdates) {
    if (!HASH.test(update.sha256)) fail(`已接受更新 ${update.id} 的 SHA-256 无效`);
    validDate(update.asOf, `已接受更新 ${update.id} 的状态日`);
    if (update.asOf > project.statusDate) fail(`已接受更新 ${update.id} 的状态日晚于项目状态日`);
    list(update.changeIds, `已接受更新 ${update.id} 的修改 ID`);
    if (!update.changeIds.length || new Set(update.changeIds).size !== update.changeIds.length) fail(`已接受更新 ${update.id} 的修改 ID 为空或重复`);
    for (const changeId of update.changeIds) id(changeId, '已接受的修改 ID');
    unique(update.sources, `已接受更新 ${update.id} 的来源`);
    for (const source of update.sources) {
      text(source.file, '已接受来源路径');
      if (!HASH.test(source.sha256)) fail('已接受来源的 SHA-256 无效');
    }
  }
  return project;
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

const equal = (left, right) => canonical(left) === canonical(right);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function validateUpdate(update) {
  object(update, '更新');
  if (update.schema !== UPDATE_SCHEMA) fail(`更新 schema 必须是 ${UPDATE_SCHEMA}`);
  id(update.id, '更新 ID');
  validDate(update.asOf, '更新状态日');
  const sourceIds = unique(update.sources, '来源');
  if (!sourceIds.size) fail('更新至少需要一个来源');
  for (const source of update.sources) {
    text(source.file, `来源 ${source.id} 的文件路径`);
    if (own(source, 'sha256') && !HASH.test(source.sha256)) fail(`来源 ${source.id} 的 SHA-256 必须是 64 位小写十六进制`);
  }
  unique(update.changes, '修改');
  if (!update.changes.length) fail('更新至少需要一项修改');
  const fields = new Set();
  const additions = new Set();
  for (const change of update.changes) {
    if (!own(change, 'value')) fail(`修改 ${change.id} 缺少 value`);
    const [entity, operation, extra] = typeof change.kind === 'string' ? change.kind.split('.') : [];
    if (extra || !['task', 'action', 'decision'].includes(entity) || !['set', 'add'].includes(operation) || (entity === 'task' && operation === 'add')) fail(`修改 ${change.id} 的 kind 不受支持`);
    if (operation === 'set') {
      id(change.targetId, `修改 ${change.id} 的目标 ID`);
      if (change.field === 'baseline' || String(change.field).startsWith('baseline.')) fail('普通更新禁止修改批准基准 baseline；批准后的基准修订需单独处理并保留批准依据和版本');
      const allowed = entity === 'task' ? TASK_FIELDS : entity === 'action' ? ACTION_FIELDS : DECISION_FIELDS;
      if (!allowed.has(change.field)) fail(`修改 ${change.id} 不支持字段：${change.field}`);
      if (!own(change, 'expected')) fail(`修改 ${change.id} 缺少 expected 当前值`);
      const fieldKey = canonical([entity, change.targetId, change.field]);
      if (fields.has(fieldKey)) fail(`同一更新对同一字段重复提出修改：${change.targetId}.${change.field}`);
      fields.add(fieldKey);
    } else {
      object(change.value, `修改 ${change.id} 的新增对象`);
      id(change.value.id, `修改 ${change.id} 的新增对象 ID`);
      if (['targetId', 'field', 'expected'].some((key) => own(change, key))) fail(`新增修改 ${change.id} 不应包含 targetId、field 或 expected`);
      const additionKey = canonical([entity, change.value.id]);
      if (additions.has(additionKey)) fail(`同一更新重复新增对象：${change.value.id}`);
      additions.add(additionKey);
    }
    list(change.evidence, `修改 ${change.id} 的依据`);
    if (!change.evidence.length) fail(`修改 ${change.id} 至少需要一条原文依据`);
    for (const evidence of change.evidence) {
      object(evidence, `修改 ${change.id} 的依据`);
      if (!sourceIds.has(evidence.sourceId)) fail(`修改 ${change.id} 的来源不存在：${evidence.sourceId}`);
      text(evidence.quote, `修改 ${change.id} 的原文引用`);
    }
  }
}

function within(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
}

export async function prepareUpdate(project, update, { updatePath } = {}) {
  validateProject(project);
  validateUpdate(update);
  if (!updatePath) fail('校验来源时必须提供更新文件路径 updatePath');
  const base = await realpath(path.dirname(path.resolve(updatePath)));
  const sourceText = new Map();
  const sources = [];
  for (const source of update.sources) {
    if (path.isAbsolute(source.file) || /^[a-zA-Z]:/u.test(source.file) || source.file.includes('\\')) fail(`来源 ${source.id} 必须使用目录内的相对路径（路径分隔使用 /）`);
    const resolved = path.resolve(base, source.file);
    if (!within(base, resolved)) fail(`来源 ${source.id} 越出更新目录树`);
    const physical = await realpath(resolved);
    if (!within(base, physical)) fail(`来源 ${source.id} 的真实路径越出更新目录树`);
    const details = await stat(physical);
    if (!details.isFile() || details.size > 2 * 1024 * 1024) fail(`来源 ${source.id} 必须是 2 MiB 以内的文本文件`);
    const bytes = await readFile(physical);
    let content;
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail(`来源 ${source.id} 不是有效 UTF-8 文本`); }
    if (content.includes('\0')) fail(`来源 ${source.id} 包含二进制空字符`);
    const hash = sha256(bytes);
    if (own(source, 'sha256') && source.sha256 !== hash) fail(`来源 ${source.id} 的 SHA-256 与文件不符`);
    sources.push({ id: source.id, file: source.file, sha256: hash });
    sourceText.set(source.id, content);
  }
  for (const change of update.changes) {
    for (const evidence of change.evidence) {
      if (!sourceText.get(evidence.sourceId).includes(evidence.quote)) fail(`修改 ${change.id} 的引用不在来源 ${evidence.sourceId} 原文中`);
    }
  }
  const updateHash = sha256(canonical({ update, sources }));
  const recorded = project.appliedUpdates.find((item) => item.id === update.id);
  if (recorded && recorded.sha256 !== updateHash) fail(`更新 ID ${update.id} 已存在但内容或来源改变，请使用新的更新 ID`);
  if (recorded && recorded.changeIds.some((changeId) => !update.changes.some((change) => change.id === changeId))) fail(`更新 ${update.id} 的已接受修改记录不匹配`);
  return { update: structuredClone(update), updateHash, sources };
}

export function applyUpdate(project, prepared, selectedIds) {
  validateProject(project);
  object(prepared, '已校验更新');
  const { update, updateHash, sources } = prepared;
  validateUpdate(update);
  if (!HASH.test(updateHash)) fail('已校验更新缺少有效内容哈希，请先 prepareUpdate');
  if (sha256(canonical({ update, sources })) !== updateHash) fail('已校验更新内容被修改，请重新 prepareUpdate');
  list(selectedIds, '明确选择的修改 ID');
  if (new Set(selectedIds).size !== selectedIds.length) fail('明确选择的修改 ID 重复');
  const selected = new Set(selectedIds);
  for (const changeId of selected) if (!update.changes.some((change) => change.id === changeId)) fail(`选择了不存在的修改 ID：${changeId}`);
  const candidate = structuredClone(project);
  let record = candidate.appliedUpdates.find((item) => item.id === update.id);
  if (record && record.sha256 !== updateHash) fail(`更新 ID ${update.id} 已存在但内容或来源改变，请使用新的更新 ID`);
  const previouslyApplied = new Set(record?.changeIds ?? []);
  const changes = update.changes.filter((change) => selected.has(change.id) && !previouslyApplied.has(change.id));
  if (!changes.length) return candidate;
  if (update.asOf < project.statusDate) fail(`更新状态日 ${update.asOf} 早于当前项目状态日 ${project.statusDate}`);
  for (const change of changes) {
    const [entity, operation] = change.kind.split('.');
    const collection = entity === 'task' ? candidate.tasks : entity === 'action' ? candidate.actions : candidate.decisions;
    if (operation === 'add') {
      if (collection.some((item) => item.id === change.value.id)) fail(`新增 ${entity} 的 ID 已存在：${change.value.id}`);
      collection.push(structuredClone(change.value));
    } else {
      const target = collection.find((item) => item.id === change.targetId);
      if (!target) fail(`修改 ${change.id} 的目标不存在：${change.targetId}`);
      if (!equal(target[change.field], change.expected)) fail(`修改 ${change.id} 的 expected 与当前值冲突：${change.targetId}.${change.field}`);
      target[change.field] = structuredClone(change.value);
    }
  }
  candidate.statusDate = update.asOf;
  if (!record) {
    record = { id: update.id, sha256: updateHash, asOf: update.asOf, changeIds: [], sources: structuredClone(sources) };
    candidate.appliedUpdates.push(record);
  }
  record.changeIds.push(...changes.map((change) => change.id));
  return validateProject(candidate);
}

export function reviewUpdate(project, prepared) {
  const appliedChangeIds = [...(project.appliedUpdates.find((item) => item.id === prepared.update.id)?.changeIds ?? [])];
  const applied = new Set(appliedChangeIds);
  const pendingChangeIds = prepared.update.changes.filter((change) => !applied.has(change.id)).map((change) => change.id);
  const candidateProject = applyUpdate(project, prepared, pendingChangeIds);
  return {
    schema: 'kobo.pm-review/v1', projectId: project.id, projectName: project.name,
    updateId: prepared.update.id, asOf: prepared.update.asOf, updateHash: prepared.updateHash,
    sources: structuredClone(prepared.sources), appliedChangeIds, pendingChangeIds,
    changes: prepared.update.changes.map((change) => ({ ...structuredClone(change), alreadyApplied: applied.has(change.id) })),
    candidateProject,
  };
}
