# Case notes: a CRM rollout awaiting evidence and decisions

[English gallery](gallery.md) · [中文画册](gallery.zh-CN.md) · [Case source directory](../examples/project-case/)

The case is a fictional customer-service CRM rollout for **3 service windows, 40 users and 20,000 records**. All six documents report the same position at **14 October 2026**. The trial runs in October; the full implementation proposal begins on 19 October and targets a December cutover. Later dates are plans or forecasts, not future events described as completed facts.

## What the review has to resolve

| Observed position | Required decision or next evidence | Where to follow it |
| --- | --- | --- |
| CRM sandbox authentication returns 401; the 12 October finish baseline has passed | Vendor and development cause/recovery reply by 15 October; verify a real endpoint. The 18 October completion date remains a forecast. | ISSUE-01; WBS 1.3.2; schedule b_api/f_api |
| Trial reconciliation found 80 duplicate-key candidates in 20,000 source records | Business decision on duplicate handling by 16 October, then apply the rule and repeat reconciliation. Forecast recheck finish: 23 October. | ISSUE-02; WBS 1.3.1 and 1.3.3; schedule b_migration/f_migration |
| Business asks to add SMS to the first release | Review the provisional +8 person-days / +JPY 600,000 impact on 16 October, including privacy, capacity, dates and operational changes. The current baseline remains in-app/email. | CR-01; ISSUE-03; RISK-04; WBS 1.2.3 and 1.6.2 |
| The same business specialist is committed elsewhere on 19–23 October | PM to arrange replacement or resequencing by 16 October; estimated shortfall is 3 person-days. The unchanged 26 October trial-test forecast still carries this risk. | ISSUE-04; schedule b_test/f_test; RACI verification responsibilities |
| Cross-window night exception contacts are not confirmed | Operations Lead to confirm primary and backup contacts and rehearse the handover by 20 October | ISSUE-05; operating-readiness work packages 1.5.1–1.5.3; RISK-05 and RISK-07 |
| Trial checks have 18 passed, 5 failed, 4 blocked and 3 unrun cases out of 30 | Quality to clear failures, blockers and unrun cases against the 26 October trial forecast, then carry evidence into formal acceptance | ISSUE-06; WBS 1.4.1; RACI-08 and RACI-09 |
| Four-role access cases passed on 11 October in the trial environment | Retain the trial evidence and obtain production-specific access, data-protection and release evidence separately | schedule b_access/a_access; WBS 1.4.2 |

The 80 candidates are neither 80 proven lost records nor evidence of a completed production migration. A mock can support independent UI work while the real API is blocked; it cannot close the real-endpoint acceptance condition.

## A complete release boundary

The [WBS](../examples/project-case/wbs.mmd) contains six delivery groups with three work packages each:

1. **1.1 Business and acceptance baseline:** business paths, access/SLA specification and the 30-case acceptance set.
2. **1.2 First-release business functions:** intake/assignment, service and approval history, and in-app/email SLA notices/reporting.
3. **1.3 Data migration and CRM integration:** mapping and traceability, real integration/replay control, duplicate-handling decisions and reconciliation.
4. **1.4 Independent quality and safety evidence:** integration/acceptance, production access/data protection, performance and recovery.
5. **1.5 Operations and adoption:** rollback procedures, night processing/monitoring, training and handover.
6. **1.6 Project governance:** decision rights, versioned baseline/change history, and issue/risk/decision records.

SMS, automated accounting execution and a whole-system replacement remain outside the current first-release boundary. The WBS describes deliverables and their acceptance evidence; its containment links are not task dependencies.

## Decision rights and evidence ownership

| Role used in every document | Responsibility to preserve |
| --- | --- |
| Sponsor | Final scope/budget/change and Go/No Go authority, subject to unmet data-safety and recovery blockers |
| Project Manager (PM) | Integrated planning, impact analysis, resource coordination, registers and escalation |
| Business Lead | Business scope, acceptance conditions, user adoption and resolving differences between service windows |
| Development Lead | Implementation, API retry/concurrency controls and technical evidence |
| Operations Lead | Night processing, monitoring, restore checks, contacts and authorized emergency rollback |
| Information Management Lead | Access, personal data, security exceptions and release-blocking conditions |
| Quality Lead | Independent verification, evidence review and defect retesting |
| CRM Vendor | Sandbox authentication, API specifications and joint investigation |

The [RACI](../examples/project-case/raci.json) keeps **14 activities × 8 roles**. Every activity has exactly one A assignment and at least one R; an A/R cell can fulfill both. Consultation is not shared accountability. The vendor does not replace the project's integration acceptance authority, and the PM does not become the final owner of every business acceptance.

## Read progress without moving the baseline

The [schedule](../examples/project-case/schedule.mmd) retains all six trial comparisons, four planned decision gates and thirty proposed implementation entries, including five milestones. Requirements finished on 10 October against an 8 October baseline; trial access finished on its 11 October baseline. The other reported finishes are forecasts.

On 14 October, the API is already overdue against 12 October. A 23 October migration forecast against 20 October predicts a miss while the baseline date is still ahead. Key-user training forecast for 22 October is not a completion record. Trial-test forecast for 26 October is exposed to the unresolved capacity gap even though the date has not moved.

The implementation proposal preserves its original calculated dates. Failed prerequisites require impact assessment and reapproval; a review milestone on the chart is not a record that approval occurred. Calendar-day durations describe the timeline, not person-day estimates or earned progress.

## Trace a request through its consequences

Follow **CR-01 → ISSUE-03 → RISK-04 → RACI-11 → WBS 1.2.3 / 1.6.2** and the [change-control sequence](../examples/project-case/change-control.mmd). The same SMS request has linked readings: proposed scope, an outstanding decision, the risk of uncontrolled impact, the person with decision authority, and the baseline/evidence that would need to change after authorization.

Before deciding, assess delivery/resource effects, personal information, operations and independent regression coverage. If a condition is unresolved, retain the blocker and a named follow-up. If the Sponsor rejects or defers the request, communicate and record that outcome; do not leave it as an implied implementation instruction. If authorized, activate the changed baseline only after its conditions are confirmed, then verify the change and obtain business acceptance before closing the record.

An already observed event goes in the [issue log](../examples/project-case/issues.json); its possible next consequence belongs in the [risk register](../examples/project-case/risk-register.json). The 401 is an issue. Another recovery delay, lost verification capacity or a cutover performed without accepted reconciliation is a risk requiring a trigger, owner and response.

## What permits release

The case uses explicit acceptance conditions: all 30 mandatory business cases pass, no unresolved major defect remains, all 20,000 source records trace to a target or an approved exclusion, and replay tests create no duplicate registrations. Those are required gates, not results already achieved. The common trial-case status is 18 passed, 5 failed, 4 blocked and 3 not run, totalling 30.

A release review also needs production access/data-protection evidence, restoration and batch-window results, business acceptance and operating-readiness records. The Sponsor makes the Go/No Go decision using those records. Unmet blockers require a hold or a new decision rather than a flow that always ends in release.

Operations can execute an emergency rollback under preauthorized triggers such as a batch-window overrun, critical reconciliation failure or major operational anomaly. Restore verification and business notification follow before service restarts. This is distinct from requesting a new scope or budget authorization.

## Check the case before rebuilding the figures

```sh
node examples/project-case/verify.mjs
node scripts/build-showcase.mjs
```

The [scenario](../examples/project-case/scenario.json) records common facts and roles. The [case manifest](../examples/project-case/case-manifest.json) identifies each source and its figure ID. Review source facts and cross-document references as well as render success: a readable diagram can still carry an incorrect approval, an invented actual finish or a risk with no actionable trigger.
