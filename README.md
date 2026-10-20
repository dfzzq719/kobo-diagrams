![Kobo Diagrams: real work breakdown, delivery schedule and responsibility matrix rendered with a shared Taskobo profile.](docs/assets/showcase.png)

[简体中文](README.zh-CN.md) · [Gallery & sources](docs/gallery.md) · [API](docs/api.md) · [Integration](docs/integration.md) · [Upgrades](docs/upgrading.md)

# Kobo Diagrams

**A shared visual language for project work.** Render Mermaid diagrams and responsibility tables with one profile, then carry that profile with the document into another application.

`@taskobo/diagrams` is a framework-independent ESM package extracted from the [Taskobo workbench](https://taskobo.com/free-tools/mermaid/) and shared with [DOCSKOBO](https://docskobo.com). The renderer runs in the browser. Each application keeps its own interface, document storage and deployment.

This source version is **0.1.1**, using **Mermaid 12.2.0**. The package is **not published to npm**; install a locally built tarball or a matching asset from [GitHub Releases](https://github.com/dfzzq719/kobo-diagrams/releases). Version 0.1.1 refines the RACI presentation and accepts saved 0.1.0 profiles without rewriting their source version. It is not a Mermaid engine upgrade.

## What you can build

| Need | Entry point |
| --- | --- |
| Ordinary Mermaid editing, with the engine's full diagram vocabulary | `createMermaidRenderer(mermaid)` |
| Shared enterprise colours, typography and diagram treatments | `renderDiagram()` / `renderDocument()` |
| A style profile that can be saved and transferred with source | `createDiagramProfile()` / `validateDiagramProfile()` |
| RACI and project registers rendered as SVG tables | `taskobo.table/v1` JSON through `renderDocument()` |

The general adapter adds no diagram whitelist. The enterprise path has its own capability catalog and source rules; support for each control depends on the diagram type. **JSON tables are a Kobo extension, not native Mermaid syntax.**

## Ownership, without visual noise

![A real RACI output with navy accountable roles, soft blue responsible roles and quiet gray supporting roles.](docs/assets/raci-figure.png)

The renderer reserves the strongest emphasis for accountability. Labels remain explicit, and the legend uses the same colours as the cells. This figure, the header and the [full gallery](docs/gallery.md) are actual package output from committed, fictional source data. [View the original SVG](docs/assets/raci.svg) or [rebuild every figure](docs/gallery.md#reproduce-the-figures).

## Start locally

Use **Node 22.12.0 or newer**. CI uses Node 24. Mermaid is an exact peer dependency so applications can inject and share the same engine instance.

```sh
git clone https://github.com/dfzzq719/kobo-diagrams.git
cd kobo-diagrams
npm ci
npm test
npm run test:browser
npm pack
```

The browser check uses an installed Chrome/Edge and does not download one. Pass a nonstandard location with `npm run test:browser -- --browser /path/to/browser`.

Install the resulting tarball into a consumer application, together with the matching engine:

```sh
# From a sibling consumer project; use the actual tarball location.
npm install ../kobo-diagrams/taskobo-diagrams-0.1.1.tgz mermaid@12.2.0
```

For a no-build example, run `python -m http.server 4173 --bind 127.0.0.1` in this repository and open [the local browser example](http://127.0.0.1:4173/examples/browser.html). It loads the installed dependency locally, without a CDN.

## Render with a shared profile

Provide a preview element in the host page, then inject Mermaid explicitly:

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

Save `source` and `profile` together. At a receiving application boundary, call `validateDiagramProfile()` before rendering or saving an imported profile. The validator preserves supported saved versions; it does not silently relabel old documents.

For an ordinary Mermaid editor, use the general adapter and supply your application config:

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

Calls using the same engine instance share a queue, keeping mutable Mermaid configuration from crossing between documents. Route all rendering for that instance through the package. See [the API reference](docs/api.md) for profiles, controls, tables, SVG and PNG output.

## One package, two Docker images

![A shared source package feeds separate Taskobo and DOCSKOBO image builds. Each browser runs its own renderer, while document source and profile pass between browser windows.](docs/assets/architecture-figure.png)

The common package is installed **at build time**. Each Docker image contains its own bundled copy. No shared writable directory or rendering service is required on the server.

Pin the package, Mermaid and lockfile in both applications; build and verify both images before deploying. A document handoff must carry source, format, profile and protocol version. This package provides profile validation, while the applications implement origin checks, transport and persistence. [Read the integration guide](docs/integration.md).

## Stay current, keep documents open

Daily release discovery and Dependabot surface new stable Mermaid versions. The upgrade helper aligns exact dependencies, the lockfile and compatibility declarations; tests check version consistency, historical profiles and real browser rendering/export. Both consumer applications still need regression checks and new image builds before deployment.

Version 0.1.1 accepts saved **0.1.0 and 0.1.1** profiles with Mermaid **12.2.0**, retains their saved `coreVersion`, and renders RACI using the current blue-gray rules. A preserved profile records provenance; it is not a promise to reproduce historical pixels with new renderer code. [See the compatibility and upgrade policy](docs/upgrading.md).

Fixed offline Agent Skills are separate, versioned downloads. Existing Skill files stay unchanged. To receive a new core, engine or style treatment, users download and reinstall a newly generated complete Skill package. Updating this repository or a Docker image does not update an already installed Skill.

## Boundaries

- Mermaid rendering, SVG measurement and PNG export require a **browser**. This package is not a Node-only headless rendering service. Profile and colour utilities can run without a DOM.
- The package does not provide an application UI, storage, document synchronization, or container deployment. The host owns source trust policy and cross-origin checks.
- Fonts, browser versions and layout settings affect output. Shared code and profiles reduce variation; they do not guarantee identical pixels across arbitrary systems.
- The toolkit invokes no AI API. All gallery project data is fictional. Diagram templates express a plan or responsibility model; they do not certify project quality.

## License & attribution

MIT, Copyright 2026 Taskobo contributors. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Mermaid and transitive dependencies retain their own copyright and licenses. Named font fallbacks are not bundled.

Kobo Diagrams is an independent project, **not an official Mermaid project**. [Mermaid](https://github.com/mermaid-js/mermaid) provides the underlying diagram engine. The toolkit makes no project management certification claim.
