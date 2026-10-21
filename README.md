# Kobo Diagrams

[简体中文](README.zh-CN.md) · [Gallery](docs/gallery.md) · [API](docs/api.md) · [Integration](docs/integration.md)

`@taskobo/diagrams` is a browser ESM package for Mermaid rendering and shared enterprise diagram styles. It is used by [Taskobo](https://taskobo.com/free-tools/mermaid/) and [DOCSKOBO](https://docskobo.com); each application keeps its own UI and document storage.

[![Complete CRM responsibility matrix: 14 activities across 8 project roles.](docs/assets/crm-case/raci-figure.png)](docs/assets/crm-case/raci.svg)

[Open the complete SVG](docs/assets/crm-case/raci.svg). The fictional CRM case uses a fixed reporting date of 14 October 2026.

- [WBS — scope and acceptance](docs/gallery.md#scope-and-acceptance): 6 delivery groups, 18 work packages.
- [Workflow — change authorization](docs/gallery.md#change-authorization): assessment, decision and verification paths.
- [Schedule — delivery dates](docs/gallery.md#delivery-dates): baseline, actual and forecast dates across 47 entries.
- [RACI — decision and execution](docs/gallery.md#decision-and-execution): the complete 14 × 8 responsibility matrix.

Optional source registers: [risks](examples/project-case/risk-register.json) · [issues](examples/project-case/issues.json).

## Install

Current version: **0.1.2**, with **Mermaid 12.2.0** as an exact peer dependency. Use **Node 22.12.0+**. The package is **not published to npm**; build a tarball or use the matching [GitHub Release](https://github.com/dfzzq719/kobo-diagrams/releases) asset.

```sh
git clone https://github.com/dfzzq719/kobo-diagrams.git
cd kobo-diagrams
npm ci
npm pack

# From a consumer project; adjust the tarball path.
npm install ../kobo-diagrams/taskobo-diagrams-0.1.2.tgz mermaid@12.2.0
```

After `npm ci`, serve the repository with `python -m http.server 4173 --bind 127.0.0.1` and open [the local browser example](http://127.0.0.1:4173/examples/browser.html) to edit, render and export the complete cases. The [gallery](docs/gallery.md) links directly to full SVGs and PNGs.

## Minimal API

Add `<div id="preview"></div>` to the host page, then inject Mermaid:

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

Save `source` and `profile` together; validate imported profiles with `validateDiagramProfile()`. Hosts enforcing a frozen standard also call `validateFrozenSource(source)` before import/render.

For ordinary Mermaid editing, `createMermaidRenderer(mermaid)` accepts application config and shares a rendering queue for the same engine. RACI uses Kobo's `taskobo.table/v1` JSON extension. See the [API reference](docs/api.md) for controls, formats, SVG and PNG export. Rendering and export require a browser.

## Compatibility and integration

Core **0.1.2** accepts saved **0.1.0, 0.1.1 and 0.1.2** profiles with Mermaid **12.2.0**, retaining their saved `coreVersion`. Rendering uses current layout rules; fonts and browsers can affect the result. See the [upgrade policy](docs/upgrading.md) for regression checks and version compatibility.

Applications install the shared package at build time and rebuild their own Docker images. Offline Agent Skills are separate versioned downloads and require reinstallation to receive updates. [Integration details](docs/integration.md).

## License and attribution

MIT, Copyright 2026 Taskobo contributors. See [LICENSE](LICENSE) and [NOTICE](NOTICE). [Mermaid](https://github.com/mermaid-js/mermaid) and transitive dependencies retain their own licenses. Kobo Diagrams is an independent project; fonts are not bundled.
