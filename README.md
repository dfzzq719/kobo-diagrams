# Kobo Diagrams · 项目管理图表渲染工具包

Framework-independent Mermaid rendering, shared enterprise styles, and project management tables.

**状态 / Status:** 0.1.0，首次集成版本。公开源码见 [GitHub](https://github.com/dfzzq719/kobo-diagrams)。本包尚未发布到 npm，使用源码或 Release 中的 tarball 安装。

## 中文

`@taskobo/diagrams` 把两个独立网站需要的 Mermaid 渲染调度、企业配色、字体和图表增强收敛到一个公共包。每个网站在构建 Docker 镜像时安装同一准确版本，运行时由各自的浏览器代码渲染。服务器无需共享可写目录，也无需增加渲染服务。

- 普通 Mermaid：`createMermaidRenderer()` 保留上游图种能力，适合通用文档编辑器。
- 企业图表：`renderDiagram()` / `renderDocument()` 统一配色与展示设置；固定样式功能的支持程度随图种而异。
- 配置互通：`createDiagramProfile()` / `validateDiagramProfile()` 生成和验证可保存、可跨站传递的版本化样式配置。
- 项目管理表：`taskobo.table/v1` JSON 支持 RACI 和一般台账。**这是本包的扩展格式，不是 Mermaid 原生语法。**

本项目独立于 Mermaid 官方项目，不声称获得项目管理机构认证。WBS、甘特图、RACI 等只是文档表达方式；工具不代替业务审查。所有示例均为虚构内容。

### 安装与运行

本包使用 ESM，需要 Node **22.12.0 或更新版本**进行安装与验证；CI 使用 Node 24。Mermaid 为精确版本 peer dependency；0.1.0 对应 Mermaid **12.2.0**。尚未发布到 npm 时，从本目录打包并安装 tarball：

```sh
# 在本包根目录
npm ci
npm test
npm run test:browser
npm pack

# 在消费项目中，替换为实际生成的 tarball 路径
npm install ./taskobo-diagrams-0.1.0.tgz mermaid@12.2.0
```

浏览器快速示例：

```js
import mermaid from 'mermaid/dist/mermaid.esm.mjs';
import {createMermaidRenderer} from '@taskobo/diagrams';

const renderer = createMermaidRenderer(mermaid);
const result = await renderer.render('flowchart LR\n  Plan --> Review', {
  config: {securityLevel: 'strict', htmlLabels: false},
});
preview.innerHTML = result.svg;
result.bindFunctions?.(preview);
```

`preview` 是由宿主应用提供的 DOM 元素。源码渲染和 PNG 转换需要浏览器；本包不是 Node 端无头 SVG 渲染服务。宿主负责输入信任边界、文件保存、跨站来源校验和应用界面。

`npm test` 先检查已安装引擎、依赖声明和版本常量的一致性；`npm run test:browser` 使用本机已有 Chrome／Edge，无需下载浏览器。无构建工具的本地演示：在本包目录执行 `python -m http.server 4173 --bind 127.0.0.1`，打开 [本地演示](http://127.0.0.1:4173/examples/browser.html)。它只读取本地安装的依赖，不使用 CDN。

### 两个网站与 Docker

公共包是一份共同维护的源码，两个镜像各自包含其构建产物。固定公共包、Mermaid 和 lockfile 后分别构建镜像，两站完成显示、导出和交接回归后再部署。公共包自身不发布或重启消费者容器。

跨站交接应携带源码、文档类型、版本化 profile 和协议版本。接收方调用 `validateDiagramProfile()`，拒绝不兼容版本；不要只传 Mermaid 源码后假定样式会自动同步。公共包没有联网同步或文档存储能力。

升级策略是每日发现最新稳定版、提交可审查的依赖升级、验证两站后发布。**运行中的容器不会自动升级。** 现有文档应保留其原始源码和 profile；改变版本需要明确迁移。详见 [集成与 Docker](docs/integration.md) 和 [升级说明](docs/upgrading.md)。

## English

Kobo Diagrams is a portable ESM toolkit for shared Mermaid rendering and enterprise diagram profiles. It offers a general Mermaid adapter, a styled diagram renderer, and SVG tables for fictional project management examples. It is independent of the official Mermaid project and makes no project management certification claim.

The general adapter accepts Mermaid syntax supported by the injected engine without a toolkit diagram whitelist. Enterprise styling has a separate capability catalog and source policy. Table documents use the toolkit-specific `taskobo.table/v1` JSON schema, not native Mermaid.

Inject Mermaid explicitly as shown above. DOM-dependent rendering runs in a browser. Colour/profile utilities can run without a DOM; the package is not a server-side headless renderer. Applications retain responsibility for UI, storage, origin checks, and deployment.

See the [API reference](docs/api.md), [integration guide](docs/integration.md), [upgrade process](docs/upgrading.md), and [browser example](examples/browser.html). Use Node 22.12.0 or newer (Node 24 in CI). Run `npm ci`, `npm test`, `npm run test:browser`, and `npm pack --dry-run` from this directory. Browser checks use an installed Chrome/Edge. The workflows are intended to run once this directory is the root of its own GitHub repository.

## License

MIT, Copyright 2026 Taskobo contributors. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Mermaid and other dependencies retain their own licenses.
