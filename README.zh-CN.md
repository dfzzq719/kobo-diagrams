# Kobo Diagrams

**把范围、责任、日期和放行证据放到同一次项目评审中。**

[English](README.md) · [完整案例画册](docs/gallery.zh-CN.md) · [案例说明](docs/project-case.md) · [API](docs/api.md) · [集成说明](docs/integration.md)

下面用同一个客户服务 CRM 导入项目，贯穿 **3 个业务窗口、40 名使用者和 20,000 条记录**。案例全部虚构，统一状态日为 **2026 年 10 月 14 日**；已完成实绩、完成预测和后续实施计划案分别标示。

此时，API 完成基准已过，认证仍返回 **401**；试行照合发现 **80 条重复键候选**；新增短信预计需要 **8 人日、60 万日元**，还在等待决定。这些具体问题需要图表支持团队作出判断。

![同一 CRM 案例的两个可读局部：基准／实绩／预测日期，以及带活动名称和角色表头的责任矩阵。完整材料见画册。](docs/assets/crm-case/showcase.png)

[查看完整 SVG、PNG 与阅读局部](docs/gallery.zh-CN.md) · [本地 HTML 画册文件](docs/assets/crm-case/showcase.html) · [查看已提交的案例源码](examples/project-case/)

`@taskobo/diagrams` 是一个不依赖界面框架的 ESM 公共包，提取自 [Taskobo 样式配置器](https://taskobo.com/free-tools/mermaid/)，并与 [DOCSKOBO](https://docskobo.com) 共用。绘制在浏览器中完成，两个应用各自保留界面、文档存储和部署方式。

当前源码版本为 **0.1.2**，使用 **Mermaid 12.2.0**。本包**尚未发布到 npm**，请安装本地构建的 tarball，或 [GitHub Releases](https://github.com/dfzzq719/kobo-diagrams/releases) 中对应版本的文件。0.1.2 改善企业表格与流程图标签的英文换行，为甘特长分区标题和任务条分别留出空间；表格继续保留中日韩文字处理与显式换行，并配套本页完整 CRM 案例。0.1.1 引入的蓝灰 RACI 规则继续保留，Mermaid 引擎版本不变。

## 沿着同一个决策查阅材料

| 工作材料 | 团队需要作出的判断 | 内容规模 |
| --- | --- | --- |
| [范围与验收](docs/gallery.zh-CN.md#范围与验收) | 首版是否覆盖移行照合、权限审计、恢复验证和运营交接，这些工作是否漏出了交付计划？ | 6 个交付群、18 个工作包 |
| [变更授权](docs/gallery.zh-CN.md#变更授权) | 短信的费用、个人信息和交期影响尚未审清，Sponsor 尚未决定，能否进入当前基准？ | 证据审查、退回补充、批准、延期和拒绝路径 |
| [交付日期](docs/gallery.zh-CN.md#交付日期) | 哪项基准已经超期，哪些只是预测，哪些后续工作仍受待决门槛影响？ | 6 组基准对照、4 个判断门槛、30 项后续实施计划案 |
| [决策与执行](docs/gallery.zh-CN.md#决策与执行) | 谁拍板、谁执行、谁提供独立验收证据？ | 14 项活动 × 8 个项目角色 |
| [风险触发器](docs/gallery.zh-CN.md#风险触发器) | 什么事件会把未来担忧变成具体行动，谁升级处理或停止作业？ | 7 项风险及其触发器和应对 |
| [问题与关闭](docs/gallery.zh-CN.md#问题与关闭) | 每个已发生问题下一步做什么、何时完成、凭什么证据关闭？ | 6 项相互关联的问题 |

### 先查首版交付边界

![完整 CRM 工作分解中的真实局部，展示工作包成果物及其验收条件。](docs/assets/crm-case/wbs-detail.png)

WBS 同时覆盖验收所需工作与可见业务功能。将其中的移行和运维就绪成果物，与照合差分、夜间值班未定的问题一起阅读；短信需要通过变更决定，才能调整已批准范围。[完整范围树与源码](docs/gallery.zh-CN.md#范围与验收)。

### 分清决定权与执行责任

![完整 14 项活动、8 角色 CRM 责任矩阵的局部：深蓝表示最终责任，柔蓝表示执行责任，轻灰表示咨询与告知。](docs/assets/crm-case/raci-detail.png)

Sponsor 对范围、预算和 Go／No Go 决策负责；开发、业务、信息管理、运维和质量仍须履行各自的交付与举证职责。厂商修复不等于本方集成验收，紧急切回则按已经授权的运维条件执行。[完整矩阵及角色解读](docs/gallery.zh-CN.md#决策与执行)。

### 区分已经超期与未来预警

![完整 CRM 日程的局部，以 10 月 14 日为状态日，对照完成基准、完成实绩和完成预测。](docs/assets/crm-case/gantt-detail.png)

API 完成基准是 **10 月 12 日**，**10 月 18 日**仍是预测，因此状态日已经超期。试行移行的基准是 **10 月 20 日**，预测为 **10 月 23 日**，在 10 月 14 日应读作预计延误，还未越过其基准日。完整日程保留全部 30 项后续实施计划案，其中含 5 个里程碑，可继续追查后续影响。[完整日程与日期口径](docs/gallery.zh-CN.md#交付日期)。

## 绘制能力

| 需求 | 入口 |
| --- | --- |
| 普通 Mermaid 编辑，保留引擎支持的图种 | `createMermaidRenderer(mermaid)` |
| 共用企业配色、字体和图表增强规则 | `renderDiagram()` / `renderDocument()` |
| 把样式配置与源码一起保存、跨站传递 | `createDiagramProfile()` / `validateDiagramProfile()` |
| 把 RACI 和项目台账绘制为 SVG 表格 | `taskobo.table/v1` JSON → `renderDocument()` |

通用适配器不额外限制图种；企业绘制中不同图种对各项设置的支持程度不同。执行固定标准的宿主应用，需要在导入／绘制前显式调用 `validateFrozenSource(source)`。**JSON 表格是 Kobo 的扩展格式，不是 Mermaid 原生语法。**

## 本地运行

使用 **Node 22.12.0 或更新版本**；CI 使用 Node 24。Mermaid 是精确版本 peer dependency，应用可以显式传入并共用同一个引擎实例。

```sh
git clone https://github.com/dfzzq719/kobo-diagrams.git
cd kobo-diagrams
npm ci
npm test
npm run test:browser
npm pack
```

浏览器验证使用本机已有的 Chrome／Edge，不下载浏览器。非标准安装位置可通过 `npm run test:browser -- --browser /path/to/browser` 指定。

在消费项目中安装生成的 tarball 及对应引擎：

```sh
# 在同级的消费项目中执行；按实际位置修改 tarball 路径。
npm install ../kobo-diagrams/taskobo-diagrams-0.1.2.tgz mermaid@12.2.0
```

无需构建即可体验完整案例：在仓库根目录运行 `python -m http.server 4173 --bind 127.0.0.1`，然后打开[本地浏览器示例](http://127.0.0.1:4173/examples/browser.html)。默认显示完整 RACI，可选择、编辑、绘制和导出六份案例材料；同一服务也可打开[本地 HTML 画册](http://127.0.0.1:4173/docs/assets/crm-case/showcase.html)。GitHub 中 HTML 文件显示源码，直接看图请使用画册中的 SVG／PNG 链接。依赖从本地加载，不使用 CDN。

## 最小 API 调用

先在宿主页面中提供预览元素，再显式传入 Mermaid：

```html
<div id="preview"></div>
```

```js
import mermaid from 'mermaid/dist/mermaid.esm.mjs';
import {createDiagramProfile, renderDocument} from '@taskobo/diagrams';

const profile = createDiagramProfile({
  roles: {primary: '#1456D9', anchor: '#0D2046'},
  settings: {fontSize: 18, direction: 'LR'},
  standard: {name: 'Example team standard', version: '1.0'},
});
const source = 'flowchart LR\n  Plan --> Review --> Deliver';
const result = await renderDocument(source, profile.roles, profile.settings, {mermaid});
document.getElementById('preview').innerHTML = result.svg;
```

把 `source` 与 `profile` 一起保存。接收其他应用传来的配置时，先调用 `validateDiagramProfile()`，再绘制或保存。校验器保留受支持的历史来源版本，不会悄悄给旧文档换上新版本号。

普通 Mermaid 编辑器使用通用适配器，并传入应用自己的配置：

```js
import {createMermaidRenderer} from '@taskobo/diagrams';

const renderer = createMermaidRenderer(mermaid);
const result = await renderer.render(source, {
  config: {securityLevel: 'strict', htmlLabels: false},
});
const preview = document.getElementById('preview');
preview.innerHTML = result.svg;
result.bindFunctions?.(preview);
```

共用同一引擎实例的调用会进入同一队列，避免 Mermaid 的可变配置串到其他文档。该实例的绘制调用应统一经过本包。profile、图表设置、表格和 SVG／PNG 的详细说明见 [API 文档](docs/api.md)。

## 一份公共包，两个 Docker 镜像

公共包在**构建时**安装，两个镜像分别包含自己的打包副本。服务器无需设置共享可写目录，也无需增加常驻绘图服务。

两边锁定相同的公共包、Mermaid 与 lockfile，分别构建、验证镜像后再部署。文档交接需携带源码、格式、profile 和协议版本。本包负责 profile 校验，应用负责来源检查、传输和持久保存。详见[部署架构与集成说明](docs/integration.md)。

## 保持更新，也让旧文档可打开

每日版本检查与 Dependabot 发现新的 Mermaid 稳定版。升级脚本同步精确依赖、lockfile 和兼容声明；测试检查版本一致性、历史 profile 及真实浏览器绘制和导出。两个消费应用仍需完成回归、构建新镜像，再进行部署。

0.1.2 接收 Mermaid **12.2.0** 对应的 **0.1.0、0.1.1 和 0.1.2** profile，保留已保存的 `coreVersion`，使用当前 RACI 配色与表格排版规则。保留 profile 的来源版本不等于新代码能逐像素复现旧输出。详见[兼容与升级规则](docs/upgrading.md)。

固定样式的离线 Agent Skill 是独立的版本化下载文件，已分发文件保持不动。接收新版核心、引擎或绘制规则，需要重新下载并安装新生成的完整 Skill 包。更新仓库或 Docker 镜像不会更新已经安装的 Skill。

## 使用边界

- Mermaid 绘图、SVG 尺寸测量和 PNG 导出需要**浏览器**。本包不是纯 Node 无头绘图服务；profile 与颜色工具可在无 DOM 环境运行。
- 本包不提供应用界面、存储、文档同步或容器部署。输入信任策略及跨站来源检查由宿主应用负责。
- 字体、浏览器和布局配置会影响输出。共用代码与 profile 可以减少差异，但不保证任意系统逐像素一致。
- 本工具包不调用 AI API；图例中的项目数据全部虚构。模板用于表达计划或职责关系，不构成项目质量认证。

## 许可证与上游归属

MIT，Copyright 2026 Taskobo contributors。详见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。Mermaid 及传递依赖保留各自的版权与许可证；代码中的字体候选名称不代表捆绑字体文件。

Kobo Diagrams 是独立项目，**不是 Mermaid 官方项目**。[Mermaid](https://github.com/mermaid-js/mermaid) 提供基础图表引擎；本项目不声称获得项目管理机构认证。
