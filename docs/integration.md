# Integration and independent Docker deployments

The common package is a source dependency. Each consumer installs a pinned version and produces its own browser bundle inside its own Docker image. There is no required shared server directory, mounted `node_modules`, or always-on rendering service.

## Distribution

During initial integration, create a tarball with `npm pack` and make it available in both build contexts. After repository/package publication, use a package registry or an immutable Git release with the same exact dependency version in both consumers. A private registry is equally valid; open-source publication does not change the runtime design.

Pin both the package and Mermaid in each consumer's manifest and commit the lockfile. Run `npm ci` in each image build. A local tarball reference must be copied into the Docker build context before that command. A published package can instead be fetched from the configured registry. Do not point production builds at a moving Git branch or unversioned CDN URL.

The two consumer applications keep their own preview shells, editing UI, document storage, and export UI. Only the Mermaid/enterprise diagram branch calls this package; HTML, Markdown, PDF and other viewers can keep their existing implementations.

## Passing a document between websites

Keep the following together in the application's existing handoff envelope:

```js
const payload = {
  protocolVersion: 2, // example host protocol, not a package-owned protocol
  format: 'mermaid', // use a distinct table format for taskobo.table/v1
  name: 'Example delivery plan',
  source: 'flowchart LR\n  Plan --> Review',
  diagramProfile: createDiagramProfile({
    standard: {name: 'Example style', version: '1.0'},
  }),
};
```

The host defines and implements its actual protocol version and format values. The common package provides profile creation and validation; it does not add transport or persistent storage automatically.

For an existing `postMessage` handshake, send to the expected exact origin and verify both `event.origin` and the expected sending window on receipt. Validate the envelope, size limits, source, and `validateDiagramProfile(payload.diagramProfile)` before rendering or saving. Do not accept wildcard origins or arbitrary CSS/config in place of a profile. Profile validation rejects incompatible engine/core versions; show an actionable upgrade or migration message instead of silently changing rendering.

Store the profile beside the source, including on subsequent saves and exports. Legacy documents with no profile need an explicit host fallback policy. The package does not infer which enterprise style was used when only the source exists.

Package 0.1.1 still uses Mermaid 12.2.0 and accepts saved 0.1.0 and 0.1.1 profiles. Validation retains the saved `coreVersion`, while rendering uses the installed package's current blue-gray RACI rules. This keeps provenance and readability without promising the old renderer's pixels. Other versions require an explicit compatibility decision. Existing frozen offline Skill files stay unchanged; a new generated Skill must be downloaded and reinstalled to receive the new core.

## Release and deployment

1. Publish or distribute one reviewed package version with its exact Mermaid compatibility version.
2. Update each consumer manifest and lockfile, then build two new image tags.
3. Run each consumer's browser regression checks, including edit/render/export, imported legacy documents, table extensions and cross-site handoff.
4. Deploy both approved image tags in a coordinated window. Keep their previous tags available for rollback.

A successful package CI run does not verify the complete consumer applications and does not publish their Docker images. No registry credentials or server connection details belong in this public repository. Use the existing deployment systems and secrets stores for each application.

Font availability, viewport, browser version, and layout engine settings can affect output. Shared code and profiles reduce variation but do not guarantee pixel-identical output across arbitrary environments. Use controlled browser/font fixtures for visual regression checks.
