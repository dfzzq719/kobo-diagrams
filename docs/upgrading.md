# Keeping Mermaid current

The target is the latest upstream **stable** Mermaid release, while production builds remain reproducible. Package 0.1.2 currently pins Mermaid 12.2.0. This patch improves enterprise English table/flowchart wrapping and Gantt section spacing, and accompanies the complete CRM case; it does not upgrade Mermaid. Never describe a running container as updated merely because the registry has a newer version.

## Automated discovery

- Dependabot checks npm dependencies every day and proposes reviewed updates. A dependency-only Mermaid PR may fail the version-consistency gate until a maintainer also updates the compatibility constants and reviews the rendering changes; that failure prevents an incomplete engine upgrade from being merged.
- The scheduled `Check Mermaid stable release` workflow reads the npm registry's `latest` tag every day. When it differs from this package's declared version, it creates one tracking issue per target version. It does not render untrusted content, invoke an AI API, merge a PR, publish a package, or deploy a Docker image.
- These workflows activate when this package directory is the root of its GitHub repository. Issue creation needs GitHub Actions enabled and the supplied `issues: write` permission. Scheduled runs use the repository's default branch.

## Reviewed upgrade

1. Check upstream release notes and syntax/security changes. Select the newest stable release rather than prereleases.
2. Run the helper below to update the exact Mermaid peer/development dependencies, lockfile, `MERMAID_VERSION` and TypeScript declaration together. Align documentation, upstream license notices and fixtures. An upstream update alone is insufficient: enterprise adapters and saved profiles also need review.
3. Bump the core/package version as appropriate. Define profile migration or rejection behavior; do not silently re-label a saved profile as a newer engine version.
   The published historical profile fixture `test/fixtures/profile-0.1.0.json` must keep passing validation on future upgrades; if it fails, define an explicit compatibility or migration plan before release, and never edit that historical fixture to conceal documents that no longer open. Version 0.1.2 explicitly supports 0.1.0, 0.1.1 and 0.1.2 profile provenance with Mermaid 12.2.0, retaining the saved version.
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

Keep source text, engine/core provenance and style profile together. Layout and syntax can change across Mermaid releases; rendering treatments can also change in a package patch without an engine upgrade.

The 0.1.2 validator accepts profiles from core 0.1.0, 0.1.1 and 0.1.2 with Mermaid 12.2.0, and preserves the saved `coreVersion`. All use the installed renderer's table layout and RACI rules. This compatibility keeps documents readable without falsely relabelling their origin. It does not promise the exact historical pixels. Other core or engine versions remain unsupported until a reviewed compatibility or migration decision is implemented.

The patch history remains distinct:

- **0.1.1** introduced the blue-gray RACI treatment: navy accountable roles, soft blue responsible roles, light neutral supporting roles and blue-gray combined roles. It accepted 0.1.0 and 0.1.1 profiles with Mermaid 12.2.0.
- **0.1.2** improves English word wrapping in enterprise tables and flowcharts, retaining CJK and explicit newlines in table text, and separates long Gantt section labels from bars. It accepts 0.1.0, 0.1.1 and 0.1.2 profiles with the same engine. The complete CRM case makes long responsibility labels, trigger/response text and closure evidence available for regression review.

Existing frozen offline Skill files remain unchanged. New exported Skills contain the new core and its notices; users receive them by downloading and reinstalling the complete new package. Neither a GitHub commit nor a Docker deployment updates previously installed Skill files. Preserve original inputs and compare representative exports before distributing a replacement.

## Standalone PM Skill

The public `skills/taskobo-diagrams` directory also bundles a reviewed core and Mermaid version. On an engine upgrade, review the new official bundle hash and the compatibility checks in `scripts/build-pm-runtime.mjs` and the Skill's `scripts/render.mjs`, then rebuild the runtime with `--vendor <reviewed-mermaid.min.js>`. Do not bypass the pinned hash to make an upgrade pass.

Run `node scripts/build-pm-runtime.mjs --check`, `node scripts/verify-pm-demo.mjs` and `node scripts/check-pm-skill.mjs`. Re-render the teaching preview, refresh its embedded files, and rebuild `docs/downloads/taskobo-diagrams-zh-CN.zip` using `python scripts/build-pm-skill.py`; `--check` verifies that the archive still matches the committed Skill. CI checks both the unchanged shared renderer and the installed PM workflow. Distribute the complete replacement Skill; users keep their project states separately.
