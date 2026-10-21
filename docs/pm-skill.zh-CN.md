# 让周会之后的项目整理少一点

[English](pm-skill.md) · [日本語](pm-skill.ja.md) · [简体中文](pm-skill.zh-CN.md)

**给 AI 现有计划和本周纪要，拿回一份能审阅、能继续维护的项目更新包。**

Taskobo Diagrams 让 AI 协助整理和持续更新项目材料，项目经理专注判断、沟通与交付。通过中文 Skill 使用，当前为 Alpha 版本。

这是 [Taskobo](https://taskobo.com/) 围绕 AI 与项目管理发起的开源实践。

## 能帮 PM 做什么

| 常见痛点 | Skill 帮助完成的工作 |
|---|---|
| 开完会，还要逐份整理后续事项 | 提取决定、行动项与计划变化，保留纪要依据 |
| 日期或责任在不同材料里对不上 | 从同一份项目状态生成 WBS、RACI 与日程 |
| AI 改了很多，却不知道为什么 | 展示修改前后对照、逐字引用及来源文件哈希 |
| 一周又一周，任务重复、旧决定丢失 | 沿用稳定编号和已应用记录，连续处理后续更新 |

预计延期仍是预测；讨论仍是讨论；自报完成仍需与验收区分。PM 能看见 AI 的建议，再按实际授权保存新版本。

## 下载并安装

[下载 Taskobo Diagrams 工作包](https://github.com/dfzzq719/taskobo-diagrams/raw/refs/heads/main/docs/downloads/taskobo-diagrams-zh-CN.zip)

1. 解压后可先双击 `taskobo-diagrams/assets/demo/review.html`，离线查看一次项目更新的结果，无需安装开发环境。
2. 要让 AI 执行流程，将完整的 `taskobo-diagrams` 文件夹放入所用 AI 软件支持的 Skill 目录。Codex 可使用 `~/.agents/skills/taskobo-diagrams/`，其中应直接包含 `SKILL.md`。
3. 重新加载或启动 AI 会话。执行校验和出图需要 **Node 22.12+、Chrome 或 Edge**；AI 软件还需支持本地文件与命令运行。
4. 在自己的项目工作目录调用 `$taskobo-diagrams`，提供现有项目状态和新增纪要。不要在安装目录内保存真实项目资料。

不同 AI 软件的安装和权限方式有所不同；仅支持聊天、不能运行本地工具的界面，无法直接执行随包脚本。

## 可以直接这样说

> 使用 $taskobo-diagrams，根据这个项目的 project.json 和本周会议纪要整理更新。先给我修改前后对照、行动项、需要拍板的问题和更新后的图表。保留原来的批准基准，不要把预测当承诺。

已有 Word／PDF 计划时，可由具备读取能力的 AI 先整理文本快照和初始状态。当前脚本接收符合格式的项目 JSON 与文本来源，不自带 OCR、录音转写或 Word／PDF 解析。

## 看一次连续更新

[演示源文件](../examples/pm-update-zh-CN/)包含初始项目、两次周会纪要及对应修改包：状态日从 2026 年 10 月 14 日推进到 16 日、21 日，覆盖 18 个工作包与 8 个角色。

这是**独立虚构教学分支**，用于展示“计划 → 第一周更新 → 第二周更新”的连续工作方式；其后续事实与原 CRM 画册分开维护。[结果文件](assets/pm-update-zh-CN/final/review.html)在 GitHub 上显示为 HTML 源码，请下载工作包后打开离线演示。

## 安装后是谁在工作

用户继续使用现有 AI，由一个主 Agent 读取 Skill 并完成整理。校验和出图交给本地脚本；材料较多且宿主支持时，可以让子 Agent 分别分析证据、日程或责任，再由主 Agent 汇总。

**不必为每一步单独安装 Agent。** Skill 不附带模型或密钥，也不会自动启动常驻 Agent。模型调用和材料处理沿用用户所使用 AI 软件的方式。

## 这一版的范围

本版支持本地项目更新、证据核对、选择应用修改，以及 WBS／RACI／日程图和静态审阅页。更新前后保留独立文件；没有用户确认或既有授权的候选修改保持待处理。

它尚不自动连接外部任务系统，不改写已批准基准，也不保证自动分析出全部依赖影响。估算、取舍、验收和项目承诺仍由团队判断。

<details>
<summary>查看 Skill 与数据格式</summary>

[Skill 入口](../skills/taskobo-diagrams/SKILL.md) · [更新流程](../skills/taskobo-diagrams/references/workflow.md) · [项目数据格式](../skills/taskobo-diagrams/references/project-format.md)

渲染沿用本仓库的公共图表核心与样式，不要求用户自行编写 Mermaid。随包版本固定；更新 Skill 时重新下载、替换安装文件，保留自己的项目目录。

</details>
