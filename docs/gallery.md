# One CRM rollout, six working documents

[简体中文](gallery.zh-CN.md) · [README](../README.md) · [Case notes](project-case.md) · [Case sources](../examples/project-case/)

This fictional customer-service CRM rollout covers **3 service windows, 40 users and 20,000 records**, with a fixed reporting date of **14 October 2026**. Actual completion, completion forecasts and unapproved implementation proposals remain distinct. The six documents use the same facts, role names, issue references and style profile.

Each section shows the **complete output** first, with an original-size SVG/PNG link, then a labelled **detail from that same SVG**. Table details stack column groups from the same rows with their original headers, keeping all responsibility and evidence columns readable. These are views of the full output, not smaller replacement sources. Open a full SVG to inspect the entire document at working size.

![Readable CRM schedule and responsibility details retain baseline, actual and forecast dates, activity names and role headers. Complete documents follow below.](assets/crm-case/showcase.png)

[Local HTML gallery file](assets/crm-case/showcase.html) · [Exact render inputs](assets/crm-case/inputs.json) · [Output manifest](assets/crm-case/manifest.json) · [Figure checks](assets/crm-case/qa.json)

On GitHub, use the complete SVG/PNG links in each section. For the HTML gallery, serve the repository locally using the commands below; GitHub displays that HTML file as source.

## Scope and acceptance

**Decision: is every first-release outcome backed by a deliverable and explicit acceptance evidence?**

![Complete WBS: six delivery groups and eighteen work packages for the CRM rollout, including business functions, integration, data, independent evidence, operations and governance.](assets/crm-case/wbs-figure.png)

[Full SVG](assets/crm-case/wbs.svg) · [Full PNG](assets/crm-case/wbs-figure.png) · [WBS source](../examples/project-case/wbs.mmd)

![Detail cropped from the full WBS. Work packages identify the evidence needed to accept their deliverables.](assets/crm-case/wbs-detail.png)

The **6 groups and 18 work packages** expose work that a feature-only plan can miss: migration decisions, production access evidence, recovery tests, monitoring and handover. The lines express deliverable containment. Task start conditions belong in the schedule and decision process.

Read **1.3.2** against **ISSUE-01**: an authenticated real CRM endpoint, retry and concurrency evidence are required; a mock does not satisfy that deliverable. Read **1.3.3** against **ISSUE-02**: the 80 duplicate-key candidates need approved decisions and a repeated reconciliation. For **1.2.3**, the current scope is in-app/email notification. SMS follows **CR-01**, rather than becoming an approved work package merely because someone requested it.

**Next action:** review the scope boundary with the Business Lead, then check that the RACI, schedule and registers cover the evidence for each work package.

## Change authorization

**Decision: what evidence and authority can change the current baseline?**

![Complete SMS change-control sequence, including parallel impact assessment, missing-evidence returns, blocked conditions, approval, rejection, deferral, verification and business acceptance.](assets/crm-case/workflow-figure.png)

[Full SVG](assets/crm-case/workflow.svg) · [Full PNG](assets/crm-case/workflow-figure.png) · [Change-control source](../examples/project-case/change-control.mmd)

![Detail cropped from the complete change-control sequence, showing the evidence review and decision boundaries for CR-01.](assets/crm-case/workflow-detail.png)

**CR-01 / ISSUE-03 / RISK-04** refer to the same SMS request. The **+8 person-days / +JPY 600,000** figures are a provisional impact estimate for the **16 October** review. The workflow asks for delivery and resource impacts, recipient-data conditions, operational changes and independent test coverage before a Sponsor decision.

An authorization must specify scope, funding and conditions. The baseline changes only when the required conditions and resources have been confirmed. Rejection and deferral also need a recorded reason, a communication trail and any next review conditions. The Sponsor's decision cannot discharge an unmet information-management blocker by itself.

**Next action:** assemble the change evidence, compare add-now/defer/reject options, and record the actual decision. Keep the first-release WBS and schedule unchanged while the request is unresolved.

## Delivery dates

**Decision: which date has already been missed, and what still lies ahead?**

![Complete integrated CRM schedule, retaining all six trial baseline comparisons, four planned decision gates and thirty implementation proposal entries on the same timeline.](assets/crm-case/gantt-figure.png)

[Full SVG](assets/crm-case/gantt.svg) · [Full PNG](assets/crm-case/gantt-figure.png) · [Schedule source and status metadata](../examples/project-case/schedule.mmd)

![Detail cropped from the complete schedule. Baseline, actual completion, forecast completion and the fixed reporting date remain distinguishable.](assets/crm-case/gantt-detail.png)

| Trial work | Baseline finish | Reported finish | Reading at 14 October |
| --- | --- | --- | --- |
| Requirements agreement | 8 October | **Actual: 10 October** | Completed 2 calendar days after baseline |
| CRM connection | 12 October | **Forecast: 18 October** | Already overdue; 401 remains open in ISSUE-01 |
| Trial migration | 20 October | **Forecast: 23 October** | Predicted 3-day miss; its baseline date is still ahead |
| Integration testing | 26 October | **Forecast: 26 October** | Date unchanged, with unresolved capacity exposure |
| Key-user training | 23 October | **Forecast: 22 October** | Earlier forecast, not a completed activity |
| Trial access verification | 11 October | **Actual: 11 October** | Passed for the trial environment only |

The four review markers are planned decision dates, not completed approvals. The full figure also preserves **30 proposed implementation entries, including 5 milestones**, from 19 October through December. Their dates retain the original dependency calculation; the trial delays have not silently produced an approved new baseline. Durations are calendar days, not effort or percentage complete.

**Next action:** use **b_api/f_api** and **b_migration/f_migration** to discuss forecast exposure; resolve the **3-person-day** capacity gap in ISSUE-04 before accepting the integration-test forecast. Reassess downstream dates and seek reapproval if the prerequisites fail.

## Decision and execution

**Decision: who is accountable, who executes, and who supplies acceptance evidence?**

![Complete 14-activity by 8-role CRM responsibility matrix, with A, R, C, I and combined A/R codes visible across the whole project.](assets/crm-case/raci-figure.png)

[Full SVG](assets/crm-case/raci.svg) · [Full PNG](assets/crm-case/raci-figure.png) · [RACI source](../examples/project-case/raci.json)

![Detail cropped from the full 14-by-8 RACI matrix. Accountable and responsible roles retain explicit codes as well as the blue-gray emphasis.](assets/crm-case/raci-detail.png)

All **14 activities and 8 roles** remain in the source and full figure: Sponsor, Project Manager (PM), Business Lead, Development Lead, Operations Lead, Information Management Lead, Quality Lead and CRM Vendor. Each row has one accountable assignment and at least one responsible assignment. **C means consultation, not another shared A.**

**RACI-11** gives the Sponsor A and the PM R for the SMS decision. **RACI-04** gives Development A/R for API implementation while the vendor is C; **RACI-05** gives Business A for duplicate-handling rules. **RACI-08** gives Quality A/R for independent verification, with Business R. Development's completion report still needs this independent evidence.

Compare **RACI-12** with **RACI-13**: the Sponsor owns Go/No Go, while Operations is A/R for an authorized emergency rollback, recovery checks and notification. These are distinct decisions with distinct triggers. **RACI-14** then requires the operations handover and an explicit transfer of open items.

Navy emphasizes accountability, soft blue execution, and light gray supporting roles. Codes carry the meaning; the legend uses the same cell rules. The renderer's built-in role legend is Japanese. This matrix is rendered from the Kobo-specific `taskobo.table/v1` JSON format.

**Next action:** check the rows covering scope, reconciliation, independent acceptance and operating readiness against the named owners and closure evidence in the other documents.

## Risk triggers

**Decision: what observable event requires a response before a future consequence occurs?**

![Complete seven-entry CRM risk register with exposure, trigger, owner and planned response.](assets/crm-case/risk-figure.png)

[Full SVG](assets/crm-case/risk.svg) · [Full PNG](assets/crm-case/risk-figure.png) · [Risk-register source](../examples/project-case/risk-register.json)

![Detail cropped from the complete risk register to read trigger conditions and the response assigned to an owner.](assets/crm-case/risk-detail.png)

The **401 has already occurred** and belongs in ISSUE-01. A further vendor recovery delay is a future exposure that needs a trigger and a response. Likewise, 80 duplicate-key candidates are an observed reconciliation issue; cutting over without resolving or approving the differences is the risk the team must prevent.

The seven rows connect foreseeable consequences to actions: **RISK-01** escalates further vendor delay; **RISK-02** blocks migration with unresolved candidate rules; **RISK-03** protects the testing capacity; **RISK-04** controls unapproved SMS work. **RISK-05** addresses batch overrun and reconciliation failure, **RISK-06** missing production safety evidence, and **RISK-07** a premature restart after rollback.

For example, if the vendor supplies no recovery reply on 15 October or the 18 October forecast slips, Development and the vendor review recovery options and PM escalates the date impact. A batch overrun or critical reconciliation failure instead calls for stopping or executing the authorized rollback, then verifying restoration and notifying the business before service restarts. Those are different trigger/action pairs, not a single red status.

**Next action:** review each trigger at its stated checkpoint and open or update the linked issue when it occurs. Check whether the response is already authorized or needs a Sponsor decision.

## Issues and closure

**Decision: what closes an observed problem, beyond changing its status label?**

![Complete six-entry CRM issue log with observed facts, next actions, owners, due dates and closure evidence.](assets/crm-case/issues-figure.png)

[Full SVG](assets/crm-case/issues.svg) · [Full PNG](assets/crm-case/issues-figure.png) · [Issue-log source](../examples/project-case/issues.json)

![Detail cropped from the complete issue log so the required next action, deadline and closure evidence can be read together.](assets/crm-case/issues-detail.png)

The log records actionable facts rather than a list of generic risks. **ISSUE-01** needs a vendor/development cause-and-recovery reply by **15 October** and real-endpoint verification; **18 October** is still a forecast. **ISSUE-02** needs a duplicate-key rule decision by **16 October** and a repeated reconciliation forecast for **23 October**. **ISSUE-03** closes through the recorded CR-01 decision and communication, including rejection or deferral where applicable.

**ISSUE-04** requires named staff/time agreements for the **3-person-day** shortfall and Quality's confirmation that the revised plan is feasible. **ISSUE-05** requires primary/backup contacts, an unavailable-contact drill, restoration checks and restart-notice evidence by **20 October**. **ISSUE-06** tracks all **30 cases: 18 passed, 5 failed, 4 blocked and 3 not run**; clearing the trial gaps still leaves formal acceptance retesting and business approval as separate gates.

The passed trial-environment access check remains limited to that environment when considering production release evidence in RISK-06 and work package 1.4.2.

**Next action:** inspect the closure-proof field and the linked work package before closing each issue. Carry unresolved consequences into the risk review and the next release decision.

## Use and reproduce the case

Install the locked dependencies, then run the source checks and the figure generator with an installed Chrome/Edge:

```sh
npm ci
node examples/project-case/verify.mjs
node scripts/build-showcase.mjs

# Optional nonstandard browser location:
node scripts/build-showcase.mjs --browser /path/to/chrome
```

For editing and exporting the six complete examples locally, serve the repository and open the browser example:

```sh
python -m http.server 4173 --bind 127.0.0.1
# Open http://127.0.0.1:4173/examples/browser.html
# HTML gallery: http://127.0.0.1:4173/docs/assets/crm-case/showcase.html
```

The browser example starts with the complete RACI matrix. The gallery generator renders the committed sources with **core 0.1.2 / Mermaid 12.2.0**, saves the complete SVGs and derives the labelled details from those outputs. Version 0.1.2 improves enterprise English table/flowchart wrapping and Gantt section spacing, while retaining CJK and explicit line breaks in tables. The [case manifest](../examples/project-case/case-manifest.json) identifies the six documents; [scenario data](../examples/project-case/scenario.json) carries the common facts. Figure inputs, versions and hashes are available beside the output assets.

The case figures are repository documentation assets accompanying core 0.1.2. Previously published tarballs and installed offline Skills retain their original files; consumers install the new package to receive the layout fixes. Deployment and browser-handoff architecture are described separately in the [integration guide](integration.md).
