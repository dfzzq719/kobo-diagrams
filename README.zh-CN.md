# Kobo Diagrams

[English](README.md) · [画册](docs/gallery.zh-CN.md) · [API](docs/api.md) · [集成说明](docs/integration.md)

`@taskobo/diagrams` 是在浏览器中绘制 Mermaid、共用企业图表样式的 ESM 包，由 [Taskobo](https://taskobo.com/free-tools/mermaid/) 和 [DOCSKOBO](https://docskobo.com) 使用；两个应用各自保留界面与文档存储。

[![完整 CRM 责任矩阵：14 项活动、8 个项目角色。](docs/assets/crm-case/raci-figure.png)](docs/assets/crm-case/raci.svg)

[打开完整 SVG](docs/assets/crm-case/raci.svg)。CRM 案例全部虚构，统一状态日为 2026 年 10 月 14 日。

- [WBS：范围与验收](docs/gallery.zh-CN.md#范围与验收)：6 个交付群、18 个工作包。
- [流程：变更授权](docs/gallery.zh-CN.md#变更授权)：评估、决策与验证路径。
- [日程：交付日期](docs/gallery.zh-CN.md#交付日期)：47 项记录中的基准、实绩与预测日期。
- [RACI：决策与执行](docs/gallery.zh-CN.md#决策与执行)：完整的 14 × 8 责任矩阵。

可选源码台账：[风险](examples/project-case/risk-register.json) · [问题](examples/project-case/issues.json)。

## 安装

当前版本为 **0.1.2**，精确依赖 **Mermaid 12.2.0**，需要 **Node 22.12.0+**。本包**尚未发布到 npm**，请构建 tarball，或使用 [GitHub Releases](https://github.com/dfzzq719/kobo-diagrams/releases) 中对应版本的文件。

```sh
git clone https://github.com/dfzzq719/kobo-diagrams.git
cd kobo-diagrams
npm ci
npm pack

# 在消费项目中执行，按实际位置修改 tarball 路径。
npm install ../kobo-diagrams/taskobo-diagrams-0.1.2.tgz mermaid@12.2.0
```

执行 `npm ci` 后，在仓库运行 `python -m http.server 4173 --bind 127.0.0.1`，打开[本地浏览器示例](http://127.0.0.1:4173/examples/browser.html)，即可编辑、绘制和导出完整案例。[画册](docs/gallery.zh-CN.md)提供完整 SVG、PNG 的直接链接。

## 最小 API

在宿主页面添加 `<div id="preview"></div>`，再显式传入 Mermaid：

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

把 `source` 与 `profile` 一起保存，接收外部 profile 时调用 `validateDiagramProfile()`。执行固定标准的宿主还需在导入／绘制前调用 `validateFrozenSource(source)`。

普通 Mermaid 编辑器使用 `createMermaidRenderer(mermaid)` 传入应用配置，同一引擎实例共用绘制队列。RACI 使用 Kobo 的 `taskobo.table/v1` JSON 扩展。图表设置、格式及 SVG／PNG 导出详见 [API 文档](docs/api.md)。绘制与导出需要浏览器。

## 兼容与集成

Core **0.1.2** 接收 Mermaid **12.2.0** 对应的 **0.1.0、0.1.1 和 0.1.2** profile，保留已保存的 `coreVersion`，使用当前排版规则；字体与浏览器可能影响输出。[升级规则](docs/upgrading.md)说明回归检查与版本兼容要求。

应用在构建时安装公共包，分别构建自己的 Docker 镜像。离线 Agent Skill 是独立的版本化下载文件，需要重新安装才能收到更新。详见[集成说明](docs/integration.md)。

## 许可与上游归属

MIT，Copyright 2026 Taskobo contributors。详见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。[Mermaid](https://github.com/mermaid-js/mermaid) 及传递依赖保留各自许可证。Kobo Diagrams 是独立项目，不捆绑字体。
