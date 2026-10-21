# Kobo Diagrams

**让 AI 承担繁杂的文档整理，让项目经理专注判断、沟通与交付。**

我们相信，AI 将改变项目管理工具，也将改变项目经理的工作方式。让 AI 协助起草和整理，让图表成为团队持续修订、讨论和落实行动的工作材料。

[下载中文图表工作包](https://github.com/dfzzq719/kobo-diagrams/raw/refs/heads/main/docs/downloads/kobo-diagrams-zh-CN.zip) · [看中文画册](docs/gallery.zh-CN.md) · [继续编辑（中文）](https://docskobo.com/app?lang=zh)

## 项目经理与 AI 怎样配合

- **准备材料**：AI 根据提供的项目事实起草图表；项目经理核对假设、缺口和依据。
- **讨论变化**：用统一图表看范围、责任和日期；项目经理组织取舍、澄清分歧。
- **推动交付**：把确认结果更新到材料中；项目经理落实负责人、验收条件和后续行动。

**新增：Taskobo Diagrams（中文 PM Skill，Alpha）**

把现有计划和周会纪要交给自己的 AI，生成有依据的修改对照、行动项和图表。[了解并安装](docs/pm-skill.zh-CN.md) · [下载 Skill 工作包](https://github.com/dfzzq719/kobo-diagrams/raw/refs/heads/main/docs/downloads/taskobo-diagrams-zh-CN.zip)

## 现在就能使用的流程

1. **下载工作包**：取得四类中文案例的源码、SVG／PNG 和给 AI 的任务说明。图片可直接查看，无需安装开发环境。
2. **交给自己的 AI 修改**：提供已确认的范围、角色和日期，让 AI 按工作包中的案例格式调整源码。
3. **绘制并确认**：在[配套样式工具](https://taskobo.com/free-tools/mermaid/)绘制，再通过工具中的 DOCSKOBO 编辑入口继续确认与导出。

现在可以使用这些图表样例、统一样式，并在线编辑和导出。AI 起草在你常用的 AI 工具中完成，项目判断和确认由团队负责。配套[样式工具](https://taskobo.com/free-tools/mermaid/)的界面目前为日文。

## 看一份完整的项目材料

下面是中文 CRM 案例的完整责任矩阵，保留 **14 项活动、8 个角色**，从范围决定一直覆盖到运营交接。

[![中文 CRM 项目完整责任矩阵：14 项活动、8 个角色。](docs/assets/crm-case/zh-CN/raci-figure.png)](docs/assets/crm-case/zh-CN/raci.svg)

[打开完整 SVG](docs/assets/crm-case/zh-CN/raci.svg)。案例为虚构，统一状态日为 2026 年 10 月 14 日。

- [WBS：范围与验收](docs/gallery.zh-CN.md#范围与验收)——看交付范围和验收条件。
- [流程：变更授权](docs/gallery.zh-CN.md#变更授权)——看一项变更怎样评估、决定与验证。
- [日程：交付日期](docs/gallery.zh-CN.md#交付日期)——对照基准、实绩和预测。
- [RACI：决策与执行](docs/gallery.zh-CN.md#决策与执行)——看谁决定、谁执行、谁参与。

<details>
<summary>开发接入、版本与安装</summary>

当前公共包为 `@taskobo/diagrams` **0.1.2**，使用 **Mermaid 12.2.0**，需要 **Node 22.12.0+**。本包尚未发布到 npm，可从 [GitHub Releases](https://github.com/dfzzq719/kobo-diagrams/releases)下载对应 tarball，或从源码构建：

```sh
git clone https://github.com/dfzzq719/kobo-diagrams.git
cd kobo-diagrams
npm ci
npm pack
# 在消费项目中执行，按实际位置修改路径。
npm install ../kobo-diagrams/taskobo-diagrams-0.1.2.tgz mermaid@12.2.0
```

[API 与最小调用](docs/api.md) · [集成方式](docs/integration.md) · [兼容与升级](docs/upgrading.md)

当前版本支持 0.1.0、0.1.1 和 0.1.2 的已保存 profile，并保留来源版本。离线 Skill 是独立下载文件，接收更新需重新下载并安装。

</details>

采用 MIT 许可证。详见[许可文件](LICENSE)与[第三方声明](NOTICE)。Kobo Diagrams 是独立项目；[Mermaid](https://github.com/mermaid-js/mermaid) 及依赖保留各自许可证。
