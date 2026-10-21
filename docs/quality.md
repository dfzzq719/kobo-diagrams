# Rendering checks for 0.1.3

This release addresses the external review of large projects and first use. The installable PM Skill still uses Chinese instructions and UI. Mermaid remains pinned to 12.2.0.

## Reproduce the checks

```sh
npm ci
npm test
npm run test:browser
node scripts/build-pm-runtime.mjs --check
node scripts/verify-pm-demo.mjs
node scripts/check-pm-skill.mjs
node scripts/check-pm-scale.mjs
python scripts/build-pm-skill.py --check
```

Browser checks use an installed Chrome/Edge. CI also runs these checks on Ubuntu with Node 24. They make no AI API calls.

## Coverage

| Check | Expected result |
|---|---|
| 12 tasks with 4,500-character acceptance conditions each | Real WBS labels render; full text remains in the review page and snapshot |
| 50 / 60 / 120 tasks in one group | Bounded WBS, RACI and schedule pages; every task and dependency retained |
| 300 tasks, 32 roles, 299 dependencies | 225 SVG figures; complete task, role and edge coverage |
| Expired forecasts on active work | Original dates retained; distinct stale-forecast state and PM warning |
| Mermaid source over its text limit, or returned error graphic | Explicit failure; no successful error-card export |
| Native PNG wider than the side budget | Export downscales below 1×; both side and total-pixel budgets respected |
| Injected PNG export failure in a disposable installed copy | Exit 2, valid SVG and sources retained, review page uses SVG |
| Injected stalled render in a disposable installed copy | Exit 2, chart/stage timeout diagnostic and sources retained |
| Closed CDP connection | Pending calls and page waits reject promptly; cleanup does not wait 180 seconds |
| Managed refresh, extra files, hand edits, directory links | Only unchanged generated results refresh; previous success survives partial failure |
| CSV/Markdown initialization | Raw facts and open questions preserved; unknown dates, A/R and approval remain unknown |
| Evidence-backed task addition and archive | Stable IDs, baseline history, dependency references and replay behavior preserved |

Local verification on 21 October 2026 used Windows, Node 25.2.1 and Chrome 155. The 120/300-task cases were tested as SVG; the 12-task long-text, 50/60-task and 18-task installed workflows also exercised PNG. A 32-role PNG panel was visually checked with its responsible role on the last page. These fixtures are regression coverage, not a universal time or memory guarantee.

The original claim that 50/60 tasks always disconnect was not reproduced in this environment. The confirmed problems were unreadable large canvases, a successful-looking Mermaid error card for long text, and expired forecasts rejected during rendering. The new tests check business labels and coverage in addition to process exit status.

## Current limits

The project model accepts at most 300 tasks and 32 roles. Rendering remains local and requires Chrome/Edge; source-only export does not. The importer produces a draft from UTF-8 CSV or Markdown, without native Word/Excel/PDF parsing. npm publication and English/Japanese Skill execution are still pending. Dense dependency networks can produce many pages; this version shows explicit relationships and does not calculate a critical path or reschedule work.

Reinstall the complete [Skill download](https://github.com/dfzzq719/taskobo-diagrams/raw/refs/heads/main/docs/downloads/taskobo-diagrams-zh-CN.zip) to receive the runtime changes. Updating the repository does not update existing installations or deploy consumer websites.
