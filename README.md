# Kobo Diagrams

**Bring the scope, owners, dates and release evidence to the same project review.**

[简体中文](README.zh-CN.md) · [Complete case gallery](docs/gallery.md) · [Case notes](docs/project-case.md) · [API](docs/api.md) · [Integration](docs/integration.md)

The case below follows one customer-service CRM rollout across **3 service windows, 40 users and 20,000 records**. It is fictional, with a reporting date of **14 October 2026**. Completed work, forecasts and proposed implementation work are identified separately throughout the set.

The API baseline has already passed while authentication returns **401**. Trial reconciliation has found **80 duplicate-key candidates**. An SMS request would add **8 person-days and JPY 600,000**, and still needs a decision. These are the conditions the diagrams must help the team handle.

![Readable details from the same CRM case: baseline, actual and forecast dates, and a responsibility matrix with activity names and role headers. Complete documents are linked in the gallery.](docs/assets/crm-case/showcase.png)

[View complete SVGs, PNGs and reading details](docs/gallery.md) · [Local HTML gallery file](docs/assets/crm-case/showcase.html) · [Inspect the committed case sources](examples/project-case/)

`@taskobo/diagrams` is a framework-independent ESM package extracted from the [Taskobo workbench](https://taskobo.com/free-tools/mermaid/) and shared with [DOCSKOBO](https://docskobo.com). The renderer runs in the browser. Each application keeps its own interface, document storage and deployment.

This source version is **0.1.2**, using **Mermaid 12.2.0**. The package is **not published to npm**; install a locally built tarball or a matching asset from [GitHub Releases](https://github.com/dfzzq719/kobo-diagrams/releases). Version 0.1.2 improves English wrapping in enterprise tables and flowchart labels, and gives long Gantt section labels room beside the bars. Table handling retains CJK and explicit line breaks. It accompanies the complete CRM case shown here. The blue-gray RACI treatment introduced in 0.1.1 is retained; the Mermaid engine version is unchanged.

## Follow the decision across documents

| Working document | What the team must decide | Coverage |
| --- | --- | --- |
| [Scope and acceptance](docs/gallery.md#scope-and-acceptance) | Does the first release include migration reconciliation, access audit, recovery and operational handover, or have they fallen out of the delivery plan? | 6 delivery groups, 18 work packages |
| [Change authorization](docs/gallery.md#change-authorization) | Can SMS enter the baseline before cost, privacy and delivery impacts have been assessed and the Sponsor has decided? | Evidence review, return for revision, approval, deferral and rejection paths |
| [Delivery dates](docs/gallery.md#delivery-dates) | Which baseline has already been missed, which dates are forecasts, and which future tasks still depend on unresolved gates? | 6 baseline comparisons, 4 decision gates, 30 proposed implementation entries |
| [Decision and execution](docs/gallery.md#decision-and-execution) | Who decides, who does the work, and who provides independent acceptance evidence? | 14 activities × 8 project roles |
| [Risk triggers](docs/gallery.md#risk-triggers) | What event turns a future concern into an action, and who escalates or stops the work? | 7 risks with triggers and responses |
| [Issues and closure](docs/gallery.md#issues-and-closure) | What must happen next on each observed problem, by when, and what evidence will close it? | 6 linked issues |

### Check the release boundary

![Detail from the complete CRM WBS, showing work-package deliverables and their acceptance conditions.](docs/assets/crm-case/wbs-detail.png)

The WBS includes the work needed to accept the release, not just build its visible features. Read its migration and operating-readiness deliverables against the open reconciliation and night-duty issues. SMS remains a change request until a decision changes the approved scope. [Full scope tree and source](docs/gallery.md#scope-and-acceptance).

### Separate the decision from the execution

![Detail from the full 14-activity, 8-role CRM responsibility matrix, using navy for accountability, soft blue for execution and quiet gray for consultation and information.](docs/assets/crm-case/raci-detail.png)

The Sponsor owns scope, budget and Go/No Go decisions. Development, business, information management, operations and quality retain their own delivery and evidence responsibilities. An external vendor's fix is not the team's integration acceptance, and an emergency rollback follows its authorized operating conditions. [Full matrix and role-by-role reading](docs/gallery.md#decision-and-execution).

### Distinguish overdue work from a future warning

![Detail from the complete CRM schedule comparing baseline dates with actual completion or forecast completion at the 14 October reporting date.](docs/assets/crm-case/gantt-detail.png)

The API baseline was **12 October**; **18 October** is still a forecast, so this item is already overdue on the reporting date. Trial migration is forecast for **23 October** against a **20 October** baseline: that is a predicted miss, not yet an overdue baseline on 14 October. The same full schedule retains all 30 implementation-plan entries, including 5 milestones, so the team can inspect downstream exposure. [Full schedule and date interpretation](docs/gallery.md#delivery-dates).

## Rendering capabilities

| Need | Entry point |
| --- | --- |
| Ordinary Mermaid editing, with the engine's full diagram vocabulary | `createMermaidRenderer(mermaid)` |
| Shared enterprise colours, typography and diagram treatments | `renderDiagram()` / `renderDocument()` |
| A style profile that can be saved and transferred with source | `createDiagramProfile()` / `validateDiagramProfile()` |
| RACI and project registers rendered as SVG tables | `taskobo.table/v1` JSON through `renderDocument()` |

The general adapter adds no diagram whitelist. Enterprise control support depends on the diagram type; a host enforcing a frozen standard explicitly calls `validateFrozenSource(source)` before import/render. **JSON tables are a Kobo extension, not native Mermaid syntax.**

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
npm install ../kobo-diagrams/taskobo-diagrams-0.1.2.tgz mermaid@12.2.0
```

To try the complete case without a build step, run `python -m http.server 4173 --bind 127.0.0.1` in this repository and open [the local browser example](http://127.0.0.1:4173/examples/browser.html). It starts with the full RACI and lets you select, edit, render and export the six case documents. The [local HTML gallery](http://127.0.0.1:4173/docs/assets/crm-case/showcase.html) is available from the same server. GitHub displays the HTML file as source; use the gallery's direct SVG/PNG links on GitHub. Dependencies load locally, without a CDN.

## Minimal API call

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

The common package is installed **at build time**. Each Docker image contains its own bundled copy. No shared writable directory or rendering service is required on the server.

Pin the package, Mermaid and lockfile in both applications; build and verify both images before deploying. A document handoff must carry source, format, profile and protocol version. This package provides profile validation, while the applications implement origin checks, transport and persistence. [Deployment architecture and integration guide](docs/integration.md).

## Stay current, keep documents open

Daily release discovery and Dependabot surface new stable Mermaid versions. The upgrade helper aligns exact dependencies, the lockfile and compatibility declarations; tests check version consistency, historical profiles and real browser rendering/export. Both consumer applications still need regression checks and new image builds before deployment.

Version 0.1.2 accepts saved **0.1.0, 0.1.1 and 0.1.2** profiles with Mermaid **12.2.0**, retains their saved `coreVersion`, and uses the current RACI and table-layout rules. A preserved profile records provenance; it is not a promise to reproduce historical pixels with new renderer code. [See the compatibility and upgrade policy](docs/upgrading.md).

Fixed offline Agent Skills are separate, versioned downloads. Existing Skill files stay unchanged. To receive a new core, engine or style treatment, users download and reinstall a newly generated complete Skill package. Updating this repository or a Docker image does not update an already installed Skill.

## Boundaries

- Mermaid rendering, SVG measurement and PNG export require a **browser**. This package is not a Node-only headless rendering service. Profile and colour utilities can run without a DOM.
- The package does not provide an application UI, storage, document synchronization, or container deployment. The host owns source trust policy and cross-origin checks.
- Fonts, browser versions and layout settings affect output. Shared code and profiles reduce variation; they do not guarantee identical pixels across arbitrary systems.
- The toolkit invokes no AI API. All gallery project data is fictional. Diagram templates express a plan or responsibility model; they do not certify project quality.

## License & attribution

MIT, Copyright 2026 Taskobo contributors. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Mermaid and transitive dependencies retain their own copyright and licenses. Named font fallbacks are not bundled.

Kobo Diagrams is an independent project, **not an official Mermaid project**. [Mermaid](https://github.com/mermaid-js/mermaid) provides the underlying diagram engine. The toolkit makes no project management certification claim.
