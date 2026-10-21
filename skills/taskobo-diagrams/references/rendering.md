# 初始化、分页与出图诊断

## 从计划开始

```sh
node scripts/pm.mjs init --from /path/to/plan.md --out /path/to/draft --name 项目名称 --as-of 2026-10-21
```

也支持 UTF-8 CSV，含引号内逗号、换行和 BOM；Excel 另存 CSV UTF-8，Word／PDF 先由宿主提取文本。Markdown 支持一个任务表；多个表格时需明确选择。没有表格的 Markdown 保留全文，让 AI 整理事实。省略 `--from` 可取得空模板。

生成 `draft.json`、`questions.md`、`plan-template.csv`。草稿保留原文、表格列值和源文件 SHA-256，不自动把负责人等同 A／R，不补日期，不把计划视为批准基准。由 AI 核实缺口、按项目格式整理 `project.json`，运行 `check` 后出图。`taskobo.pm-draft/v1` 草稿不能直接当项目渲染。

## 大项目与反复调整

```sh
node scripts/render.mjs --project /path/to/project.json --out /path/to/preview
node scripts/render.mjs --project /path/to/project.json --out /path/to/preview --force
node scripts/render.mjs --project /path/to/project.json --out /path/to/filtered --group delivery --from 2026-10-01 --to 2026-11-30 --page-size 8
node scripts/render.mjs --project /path/to/project.json --out /path/to/svg --format svg
node scripts/render.mjs --project /path/to/project.json --out /path/to/sources --format sources
```

- 项目上限 300 个工作包、32 个角色。每组默认 12 项一页，`--page-size` 范围 1–20；日程与 RACI 按同一工作包切片，WBS 再分为每图最多 4 项，保持真正的父子包含结构。
- RACI 每页最多 8 个角色，重复工作包列；完整矩阵先校验唯一 A 和至少一个 R，再展示角色面板。单个面板可能看不到 A 或 R，应合并阅读。源 JSON 保留完整角色。
- 每页依赖图最多 12 条边（随页大小调整，最多 16 条）。所有选中任务的显式 `dependsOn` 都画出；跨分组、筛选外或归档的前置任务保留 ID 和提示。不会推算关键路径或自动重排。
- 图内长名称与验收条件使用短标签，完整原文位于审阅页明细及项目快照。筛选仅选择工作包，基准、预测和依赖原值不变。
- 预测结束日早于状态日时，保留原日期，以风险色和“预测期限已过，需更新”提示 PM；不自动顺延，也不标为完成。
- PNG 最多 3200 万像素、单边 16384 像素；必要时降采样。SVG 保留矢量尺寸。
- `--force` 只刷新本工具生成、哈希一致、无额外文件或符号链接的目录。新结果完整生成后替换；部分失败另存 `.failed-…`，原成功包保留。`review` 和 `accept` 仍要求新路径。
- `--format sources` 不需要浏览器，仅输出可编辑源、快照和审阅文字，没有验证图形渲染。SVG 与 PNG 渲染仍需要已安装的 Chrome／Edge。

## 识别失败

退出码 `0` 表示所选格式完整生成，`2` 表示部分失败，`1` 表示输入或输出操作失败。交付前查看 `report.json.status`，不能只检查文件是否存在。

`diagnostics.json` 记录出错图 ID、工作包 ID、源码长度、阶段、错误码、浏览器版本、退出状态及日志。浏览器缺失、启动失败、连接中断和调用超时分别报告；只有日志明确报告内存不足时才标为内存故障。一般断连无法仅凭现象确认原因。默认每图调用超时 180 秒，`--timeout` 可设为 1000–300000 毫秒。

失败图的源文件保留；PNG 失败时保留有效 SVG 并标记部分失败，审阅页使用 SVG。可缩小页大小、按组筛选或先用 `--format svg`。错误提示图不作为业务图保存。

```sh
node scripts/render.mjs --doctor
node scripts/render.mjs --verify --out /path/to/preview
```

`--doctor` 检查 Node、runtime 与浏览器路径，不代表浏览器已执行成功。`--verify` 核对文件完整性，同时显示输出状态；哈希一致不证明业务事实正确，源文件模式也不代表图形渲染通过。
