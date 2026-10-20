# API reference

All imports below use `@taskobo/diagrams`. The package is ESM and does not load Mermaid implicitly. Version 0.1.1 targets Mermaid 12.2.0; this patch changes the RACI presentation, not the Mermaid engine.

## General Mermaid rendering

```js
import mermaid from 'mermaid/dist/mermaid.esm.mjs';
import {createMermaidRenderer} from '@taskobo/diagrams';

const renderer = createMermaidRenderer(mermaid);
const result = await renderer.render(source, {
  config: {securityLevel: 'strict', htmlLabels: false},
  id: 'preview_diagram', // optional; use a unique DOM-safe ID
  container: element,   // optional Mermaid render container
});
element.innerHTML = result.svg;
result.bindFunctions?.(element);
```

`createMermaidRenderer(mermaid)` accepts an engine instance exposing `initialize`, `parse`, and `render`. `render(source, options)` returns the upstream Mermaid render result, including `svg` and an optional `bindFunctions` callback. `source` must be a string. Parsing and rendering errors reject the promise.

The adapter serializes calls that share an engine instance because Mermaid configuration is mutable. Route other users of that instance through this package too; calling `mermaid.initialize()` or `mermaid.render()` directly bypasses the queue. `startOnLoad` is forced to false. The adapter does not restrict diagram types or apply enterprise source/style rules. The host owns its chosen config and source trust policy.

## Versioned profiles

```js
import {createDiagramProfile, validateDiagramProfile} from '@taskobo/diagrams';

const profile = createDiagramProfile({
  roles: {primary: '#1456D9', anchor: '#0D2046'},
  settings: {fontSize: 18, direction: 'LR'},
  standard: {name: 'Example delivery standard', version: '1.0'},
});
const checked = validateDiagramProfile(JSON.parse(JSON.stringify(profile)));
```

`createDiagramProfile({roles = {}, settings = {}, standard?} = {})` fills defaults and returns a fresh serializable object:

```json
{
  "schema": "kobo.diagram-profile/v1",
  "engineVersion": "12.2.0",
  "coreVersion": "0.1.1",
  "roles": {},
  "settings": {}
}
```

The empty objects above are abbreviated: the actual profile includes all normalized roles and settings. `standard` is optional metadata with a nonempty `name` (up to 180 characters) and `version` (up to 80). It does not certify conformance to an external standard.

`validateDiagramProfile(input)` rejects unknown fields, invalid values, unsupported schema and versions with `TypeError`. Version 0.1.1 explicitly accepts core versions `0.1.0` and `0.1.1` with engine version `12.2.0`, returning normalized copies while retaining the saved `coreVersion`. It does not rewrite the document's provenance, accept arbitrary Mermaid config/CSS, or promise historical pixel reproduction. RACI output uses the currently installed renderer's blue-gray rules, including for compatible 0.1.0 profiles.

| Field | Values |
| --- | --- |
| Colour roles | `paper`, `surface`, `ink`, `muted`, `primary`, `anchor`, `line`, `border`, `success`, `warning`, `danger` |
| Role values | Three- or six-digit HEX strings, normalized to `#RRGGBB` |
| `radius` | Number from 0 to 20 |
| `lineWidth` | Number from 1 to 3 |
| `fontSize` | Number from 14 to 22 |
| `curve` | `basis`, `linear`, `stepAfter` |
| `density` | `compact`, `comfortable`, `spacious` |
| `direction` | `auto`, `TB`, `TD`, `BT`, `LR`, `RL` |
| `transparent` | Boolean |

## Enterprise diagrams and tables

```js
import mermaid from 'mermaid/dist/mermaid.esm.mjs';
import {createDiagramProfile, renderDocument, renderDiagram} from '@taskobo/diagrams';

const profile = createDiagramProfile();
const result = await renderDocument(source, profile.roles, profile.settings, {mermaid});
preview.innerHTML = result.svg;

// Mermaid-only entry point with the same argument order:
const diagram = await renderDiagram(source, profile.roles, profile.settings, {mermaid});
```

`renderDocument(source, roles, settings, {mermaid})` detects a JSON table from a leading `{`, otherwise delegates to `renderDiagram`. Both return a promise for an object containing at least `svg`, normalized `source`, `type`, `palette`, `settings`, and `capabilities`. Tables also return numeric `width` and `height`. Validate an incoming profile before passing its values to either renderer.

The enterprise path applies shared theme configuration and diagram-specific postprocessing. A host enforcing a frozen standard must explicitly call the exported `validateFrozenSource(source)` before import/render: it rejects source-level style/config overrides and returns renderable source. It does not parse full Mermaid grammar, and the host can preserve the original source text separately. `renderDocument()` alone does not enforce that frozen-source policy. The general adapter is suitable for ordinary Mermaid editing. Consult `getDiagramCapabilities(source)` or `getDocumentCapabilities(source)` to discover control support; not every diagram type supports every enterprise control.

`DEFAULT_SETTINGS`, `ROLE_DEFS`, and `PRESETS` expose the default display settings, colour role definitions, and built-in colour presets. `CORE_VERSION`, `MERMAID_VERSION`, and `PROFILE_SCHEMA` expose the compatibility identifiers.

### Table extension

`taskobo.table/v1` is a Kobo-specific JSON format. A table requires 2–10 columns and 1–80 rows. Column keys must be nonempty and unique; cell values are strings, numbers, booleans, or null. RACI rows require exactly one accountable assignment (`A` or `A/R`) and at least one responsible assignment (`R` or `A/R`). See [the example](../examples/raci.json).

```js
import {parseTable, isTableSource, svgToPng} from '@taskobo/diagrams';

const table = parseTable(jsonSource); // validation; throws on malformed input
const isTable = isTableSource(jsonSource); // leading-character detection only
const pngBlob = await svgToPng(result, 2); // browser-only; resolves to a PNG Blob
```

`isTableSource()` is a dispatch hint, not a schema validator. `parseTable()` validates the table. Rendering uses SVG text rather than interpreting cell values as HTML. PNG conversion also needs browser DOM, image, and canvas APIs.

## Environment and responsibility

Profile and colour utilities do not require a DOM. Mermaid rendering, SVG measurement/postprocessing, and PNG conversion require a browser. Rendering under Node needs a separately provided and tested browser runtime; installing this package alone does not provide one.

The package does not store documents, send network requests, implement a cross-origin handshake, or deploy containers. Keep document source and its profile together and validate both at the receiving application boundary.
