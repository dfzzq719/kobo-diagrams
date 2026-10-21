# 项目事实与更新格式

这些 JSON 是独立教学项目的工作文件。主 Agent 理解材料、提出更新；脚本校验结构、来源引用及冲突，只有 PM 明确选中的修改才会写入新版本。格式校验不证明材料或 AI 的理解真实、完整。

## 项目 `kobo.pm-project/v1`

```json
{
  "schema": "kobo.pm-project/v1",
  "id": "crm-demo",
  "name": "客户服务系统导入（独立教学项目）",
  "statusDate": "2026-10-14",
  "roles": [{ "id": "pm", "name": "项目经理" }],
  "groups": [{ "id": "delivery", "name": "交付" }],
  "tasks": [{
    "id": "WP-01", "title": "确认交付范围", "groupId": "delivery",
    "acceptance": "业务负责人确认范围和验收标准",
    "responsibilities": { "pm": "A/R" },
    "baseline": { "start": "2026-10-12", "finish": "2026-10-15" },
    "forecast": { "start": "2026-10-12", "finish": "2026-10-15" },
    "actualFinish": null, "status": "active", "dependsOn": []
  }],
  "actions": [], "decisions": [], "appliedUpdates": []
}
```

- `roles` 最多 8 个、`tasks` 最多 60 个；角色、分组、任务、行动和决策各自 ID 唯一。
- 所有 ID 可使用中文，最多 128 字符；不得含 ASCII 逗号 `,`、换行或首尾空白，也不得以 `--` 开头，确保命令行选择没有歧义。
- 日期均为真实日历日 `YYYY-MM-DD`，开始不晚于结束。不把日历日自动换算为工作日。
- 每个任务恰有一位最终负责人（`A` 或 `A/R`），至少一位执行者（`R` 或 `A/R`）。其他值为 `C`、`I` 或空字符串；遗漏角色等同未分配。
- `status` 为 `planned`、`active` 或 `done`；完成任务必须有不晚于状态日的 `actualFinish`，其他任务为 `null`。
- `dependsOn` 为已有任务 ID 数组，不允许重复、自依赖或依赖环。
- `baseline` 是批准基准，`forecast` 是当前预测。普通更新不允许修改基准；批准后的基准修订需单独处理并保留批准依据和版本。
- 行动项：`{id,title,ownerRoleId,dueDate,status}`，状态 `open` / `done`。
- 决策项：`{id,title,status}`，状态 `pending` / `approved` / `rejected` / `deferred`。AI 应把待决策事项列为 `pending`，只有明确的批准依据才提出 `approved`。

## 更新 `kobo.pm-update/v1`

```json
{
  "schema": "kobo.pm-update/v1", "id": "week-1", "asOf": "2026-10-16",
  "sources": [{ "id": "minutes", "file": "minutes.txt" }],
  "changes": [{
    "id": "api-forecast", "kind": "task.set", "targetId": "WP-01",
    "field": "forecast",
    "expected": { "start": "2026-10-12", "finish": "2026-10-15" },
    "value": { "start": "2026-10-12", "finish": "2026-10-18" },
    "evidence": [{ "sourceId": "minutes", "quote": "交付范围确认预计延期至10月18日" }]
  }]
}
```

- 更新 ID 与修改 ID 均需唯一。每项修改必须有原文引用。
- `sources[].file` 相对于更新文件所在目录，只允许该目录树内的 UTF-8 文本文件，符号链接不能越界。可提供 `sha256`；脚本总会计算真实 SHA-256 并保存。
- 原文中的 `quote` 必须逐字存在；脚本只能证明引用和文件相符，不能证明其支持 AI 提出的修改。
- `task.set` 可修改完整的 `forecast`、`status`、`actualFinish`、`responsibilities`、`title`、`acceptance`、`dependsOn`。每项必须带与当前值完全相同的 `expected`；同一更新不能对同一任务同一字段提出两项修改。
- `action.add` 的 `value` 为新行动项，`decision.add` 的 `value` 为新决策项。这两类不带 `targetId`、`field` 或 `expected`。既有对象不能被同 ID 覆盖。
- `action.set` 可更新既有行动的 `title`、`ownerRoleId`、`dueDate`、`status`；`decision.set` 可更新既有决策的 `title`、`status`。二者使用与 `task.set` 相同的 `targetId`、`field`、`expected`、`value` 和 `evidence`，通过稳定 ID 连续维护事项，避免每周重复新增。
- 要一起生效的修改应在同一次选择中接受，例如 `status=done` 和 `actualFinish`。最终项目校验失败时整次操作失败。

## 命令与结果

在 Skill 目录中运行（Node.js 22.12 或更高）：

```sh
node scripts/pm.mjs check --project 项目.json
node scripts/pm.mjs review --project 项目.json --update 本周/更新.json --out 本周/审阅
node scripts/pm.mjs accept --project 项目.json --update 本周/更新.json --select api-forecast --out 项目-新版本.json
```

`review` 在全新目录中生成 `candidate.json`、`review.json`、`review.md`。候选应用全部未接受的建议，便于预览，不代表已经批准。`accept` 只接受 `--select` 中显式选中的 ID，生成全新的项目文件。两者都不修改输入，也不覆盖既有输出；`review` 文件不是批准凭据。

`appliedUpdates` 由工具维护：`{id,sha256,asOf,changeIds,sources:[{id,file,sha256}]}`。`sha256` 对规范化更新内容及真实来源哈希计算，字段顺序或 JSON 空白不影响结果。同一更新重复接受已接受项不会重复创建行动项；可继续接受其余建议。同一更新 ID 的内容或来源改变时拒绝，需用新更新 ID。新接受项的 `expected` 仍需匹配当前值；更新状态日不允许倒退。

## 脚本接口

`scripts/project.mjs` 导出：

- `validateProject(project)`：校验并返回输入，失败抛出中文错误。
- `prepareUpdate(project, update, {updatePath})`：异步读取和校验来源，返回 `{update,updateHash,sources}`。
- `applyUpdate(project, prepared, selectedIds)`：校验后返回深拷贝项目，输入不变。
- `reviewUpdate(project, prepared)`：返回审阅对象，含候选、已接受项、未接受项及来源。

这些工具不调用大模型、不创建子 Agent、不访问网络，也不启动后台服务。AI 推理沿用用户当前使用的 AI 软件和模型服务。
