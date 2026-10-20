# Keeping Mermaid current

The target is the latest upstream **stable** Mermaid release, while production builds remain reproducible. Package 0.1.0 currently pins Mermaid 12.2.0. Never describe a running container as updated merely because the registry has a newer version.

## Automated discovery

- Dependabot checks npm dependencies every day and proposes reviewed updates. A dependency-only Mermaid PR may fail the version-consistency gate until a maintainer also updates the compatibility constants and reviews the rendering changes; that failure prevents an incomplete engine upgrade from being merged.
- The scheduled `Check Mermaid stable release` workflow reads the npm registry's `latest` tag every day. When it differs from this package's declared version, it creates one tracking issue per target version. It does not render untrusted content, invoke an AI API, merge a PR, publish a package, or deploy a Docker image.
- These workflows activate when this package directory is the root of its GitHub repository. Issue creation needs GitHub Actions enabled and the supplied `issues: write` permission. Scheduled runs use the repository's default branch.

## Reviewed upgrade

1. Check upstream release notes and syntax/security changes. Select the newest stable release rather than prereleases.
2. Run the helper below to update the exact Mermaid peer/development dependencies, lockfile, `MERMAID_VERSION` and TypeScript declaration together. Align documentation, upstream license notices and fixtures. An upstream update alone is insufficient: enterprise adapters and saved profiles also need review.
3. Bump the core/package version as appropriate. Define profile migration or rejection behavior; do not silently re-label a saved profile as a newer engine version.
4. Run `npm ci`, `npm test`, `npm run test:browser` and `npm pack --dry-run`. `npm test` checks that the installed engine, development/peer dependencies, source constant and TypeScript declaration agree. The browser test uses an already installed Chrome/Edge and does not download one. CI uses the Chrome installation on `ubuntu-latest`. Exercise representative flowcharts, WBS/organization diagrams, sequence diagrams, Gantt status, unsupported enterprise controls, RACI, tables, malformed input and consecutive/concurrent render calls.
5. Update both consumers to the same approved package and Mermaid versions. Verify appearance, SVG/PNG export, saving/reopening and cross-site profile handoff in each application.
6. Publish the package or immutable tarball, build both consumer images, then deploy through their existing release processes. Preserve the previous package/image tags for rollback.

Dependabot opens dependency changes; it cannot verify enterprise SVG postprocessing or application integration by itself. The tracking issue remains useful until compatibility work and both consumer deployments are complete. Closing an issue does not cause a new issue for the same target version to be created automatically.

```sh
# Prepare the current npm stable version, or choose a reviewed stable target.
npm run upgrade:mermaid
npm run upgrade:mermaid -- --target X.Y.Z

# Review the diff before testing and publishing.
npm test
npm run test:browser
npm pack --dry-run
```

Run only one helper invocation for the intended target. The helper queries the npm registry and runs `npm install --ignore-scripts` to update the lockfile; it requires network access. It does not publish or deploy. In a Dependabot PR, run the helper for the PR's target version and commit the additional compatibility changes after review.

If Chrome/Edge is in a nonstandard location, use `npm run test:browser -- --browser /path/to/browser`. An optional `--output report.json` writes the browser report to the given local path. This test validates the package itself; each consumer still needs application regression testing.

## Compatibility and old documents

Source text, engine/core version and style profile form a reproducible document input. Layout and syntax may change across Mermaid releases. Keep original inputs, compare representative exported output, and give users a deliberate migration path. Validation currently requires an exact profile version match; accepting older versions must be implemented as a separate reviewed migration.
