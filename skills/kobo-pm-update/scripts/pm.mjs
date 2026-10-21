#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateProject, prepareUpdate, applyUpdate, reviewUpdate } from './project.mjs';

const HELP = `Kobo PM 项目材料更新（Node.js 22.12+）

check  --project 项目.json
review --project 项目.json --update 本周/更新.json --out 全新审阅目录
accept --project 项目.json --update 本周/更新.json --select 修改1,修改2 --out 全新项目.json

review 生成 candidate.json、review.json、review.md；预览不代表批准。
accept 只应用 --select 中明确选中的修改，不修改输入、不覆盖输出。
来源文件必须位于更新文件的目录树内；原文匹配不证明建议真实或获得批准。
普通更新不能修改批准基准 baseline，批准后的基准修订需另行处理。
`;

async function jsonFile(file) {
  let source;
  try { source = await readFile(file, 'utf8'); } catch (error) { throw new Error(`无法读取文件 ${file}：${error.code ?? error.message}`); }
  try { return JSON.parse(source.replace(/^\uFEFF/u, '')); } catch { throw new Error(`JSON 格式无效：${file}`); }
}

function options(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!['--project', '--update', '--out', '--select'].includes(key) || !value || value.startsWith('--') || Object.hasOwn(result, key.slice(2))) throw new Error(`参数无效或重复：${key}。运行 --help 查看用法`);
    result[key.slice(2)] = value;
  }
  return result;
}

function requireOptions(values, required, allowed) {
  for (const key of required) if (!values[key]) throw new Error(`缺少 --${key} 参数`);
  for (const key of Object.keys(values)) if (!allowed.includes(key)) throw new Error(`当前命令不接受 --${key}`);
}

const pretty = (value) => `${JSON.stringify(value, null, 2)}\n`;
const md = (value) => String(value).replace(/[\\`*_{}\[\]<>|]/gu, '\\$&').replace(/\r?\n/gu, ' ');

function reviewMarkdown(review) {
  const lines = [
    `# ${md(review.projectName)}：项目更新审阅`, '',
    '**拟更新预览，尚未确认。** 候选应用全部未接受建议，不能代替 PM 逐项选择。', '',
    `更新：${md(review.updateId)}；状态日：${review.asOf}。`, '',
    '脚本只校验格式、来源引用与旧值冲突；原文存在不证明建议真实、完整或已获授权。', '',
  ];
  for (const change of review.changes) {
    lines.push(`## ${md(change.id)}${change.alreadyApplied ? '（已接受，重复执行不再修改）' : '（待确认）'}`, '');
    lines.push(`操作：${md(change.kind)}${change.targetId ? `；目标：${md(change.targetId)}.${md(change.field)}` : ''}。`, '');
    if (Object.hasOwn(change, 'expected')) lines.push('原值：', '```json', pretty(change.expected).trimEnd(), '```', '');
    lines.push('建议值：', '```json', pretty(change.value).trimEnd(), '```', '');
    for (const evidence of change.evidence) lines.push(`依据（${md(evidence.sourceId)}）：${md(evidence.quote)}`, '');
  }
  lines.push('## 来源快照', '', '| 来源 ID | 文件 | SHA-256 |', '| --- | --- | --- |');
  for (const source of review.sources) lines.push(`| ${md(source.id)} | ${md(source.file)} | ${source.sha256} |`);
  lines.push('', '选择修改时使用更新文件中的稳定 ID，例如：', '', '```sh', 'node scripts/pm.mjs accept --project 项目.json --update 本周/更新.json --select 修改1,修改2 --out 项目-新版本.json', '```', '');
  return lines.join('\n');
}

export async function main(args = process.argv.slice(2)) {
  if (!args.length || args.includes('--help') || args.includes('-h')) { process.stdout.write(HELP); return; }
  const [command, ...rest] = args;
  if (!['check', 'review', 'accept'].includes(command)) throw new Error(`未知命令：${command}。运行 --help 查看用法`);
  const opts = options(rest);
  const required = command === 'check' ? ['project'] : command === 'review' ? ['project', 'update', 'out'] : ['project', 'update', 'select', 'out'];
  requireOptions(opts, required, required);
  const project = validateProject(await jsonFile(opts.project));
  if (command === 'check') {
    process.stdout.write(`项目校验通过：${project.name}（${project.tasks.length} 个任务，状态日 ${project.statusDate}）\n`);
    return;
  }
  const update = await jsonFile(opts.update);
  const prepared = await prepareUpdate(project, update, { updatePath: opts.update });
  if (command === 'review') {
    const review = reviewUpdate(project, prepared);
    try { await mkdir(opts.out); } catch (error) {
      if (error.code === 'EEXIST') throw new Error(`审阅输出目录已存在，拒绝覆盖：${opts.out}`);
      throw new Error(`无法创建审阅目录 ${opts.out}：${error.code ?? error.message}`);
    }
    await writeFile(path.join(opts.out, 'candidate.json'), pretty(review.candidateProject), { flag: 'wx' });
    await writeFile(path.join(opts.out, 'review.json'), pretty(review), { flag: 'wx' });
    await writeFile(path.join(opts.out, 'review.md'), reviewMarkdown(review), { flag: 'wx' });
    process.stdout.write(`已生成拟更新审阅：${opts.out}（${review.pendingChangeIds.length} 项待确认）\n`);
    return;
  }
  const selectedIds = opts.select.split(',').map((value) => value.trim());
  if (selectedIds.some((value) => !value)) throw new Error('--select 必须是非空修改 ID，以逗号分隔');
  const candidate = applyUpdate(project, prepared, selectedIds);
  try { await writeFile(opts.out, pretty(candidate), { flag: 'wx' }); } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`项目输出文件已存在，拒绝覆盖：${opts.out}`);
    throw new Error(`无法写入项目输出 ${opts.out}：${error.code ?? error.message}`);
  }
  process.stdout.write(`已按明确选择生成新项目：${opts.out}（原项目未修改）\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`错误：${error.message}\n`);
    process.exitCode = 1;
  });
}
