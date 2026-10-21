#!/usr/bin/env node
/** Business-contract checks for the fictional case; no browser is used. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseTable} from '../../src/document-renderer.mjs';
import {parseGanttStatus} from '../../src/gantt-status.mjs';
import {validateFrozenSource} from '../../src/source-policy.mjs';
import {createDiagramProfile} from '../../src/profile.mjs';

const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const json = async file => JSON.parse(await read(file));
const sha = value => createHash('sha256').update(value).digest('hex');
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const scenario = await json('scenario.json');
const manifest = await json('case-manifest.json');
const roleOrder = ['sponsor', 'pm', 'business', 'dev', 'ops', 'info', 'quality', 'vendor'];
assert.equal(scenario.fictional, true);
assert.equal(scenario.asOf, '2026-10-14');
assert.equal(manifest.caseId, scenario.id);
assert.equal(manifest.asOf, scenario.asOf);
createDiagramProfile(manifest.profileOptions);
assert.deepEqual(scenario.roles.map(role => role.id), roleOrder);
assert.deepEqual({desks: scenario.scope.serviceDesks, users: scenario.scope.users, records: scenario.scope.sourceRecords, accessRoles: scenario.scope.accessRoles}, {desks: 3, users: 40, records: 20000, accessRoles: 4});
assert.equal(scenario.scope.mandatoryAcceptanceCases, 30);
assert.deepEqual(scenario.facts.trialCaseStatus, {passed: 18, failed: 5, blocked: 4, notRun: 3, total: 30});
assert.equal(Object.entries(scenario.facts.trialCaseStatus).filter(([key]) => key !== 'total').reduce((sum, [, value]) => sum + value, 0), 30);
assert.equal(scenario.facts.duplicateCandidates, 80);
assert.equal(scenario.facts.resourceConflict.estimatedGapPersonDays, 3);
assert.equal(scenario.facts.resourceConflict.resolved, false);
assert.equal(scenario.facts.trialAccess.actualDate, '2026-10-11');
assert.match(scenario.facts.trialAccess.scope, /Trial environment only/);

const expectedDocuments = ['wbs', 'workflow', 'gantt', 'raci', 'risk', 'issues'];
assert.deepEqual(manifest.documents.map(document => document.id), expectedDocuments);
const sources = new Map();
for (const document of manifest.documents) {
  assert.match(document.file, /^[a-z-]+\.(?:mmd|json)$/);
  assert.ok(document.question && document.description, `${document.id} must answer a real project question`);
  const source = await read(document.file);
  sources.set(document.id, source);
  if (document.kind === 'mermaid') validateFrozenSource(source);
  else {
    const table = parseTable(source);
    assert.equal(table.caseId, scenario.id);
    assert.equal(table.asOf, scenario.asOf);
    assert.match(table.title, /fictional, as of 2026-10-14/);
  }
  for (const label of document.detail.focusLabels) assert.ok(source.includes(label), `${document.id} detail label must refer to real source content: ${label}`);
}

const wbs = sources.get('wbs');
const groupIds = [...wbs.matchAll(/^\s*subgraph (G\d)\[/gm)].map(match => match[1]);
const leaves = [...wbs.matchAll(/^\s*(WP\d{3})\["([^\n]+)"\]/gm)];
assert.deepEqual(groupIds, scenario.workBreakdown.groups.map(group => group.id));
assert.equal(groupIds.length, 6);
assert.equal(leaves.length, 18);
assert.equal(new Set(leaves.map(match => match[1])).size, 18);
assert.deepEqual(leaves.map(match => match[1]), scenario.workBreakdown.groups.flatMap(group => group.packages));
for (const [, id, label] of leaves) {
  assert.match(label, /Evidence:/, `${id} requires a checkable acceptance condition`);
  assert.ok(label.split('<br/>').length >= 3, `${id} must explain its deliverable and acceptance evidence`);
}
assert.doesNotMatch(wbs, /-->/, 'WBS containment is not a dependency network');
for (const condition of ['zero duplicate registrations', '20,000 source records', '80 duplicate-key', 'all 30 mandatory cases', 'production permissions', 'restore checks']) assert.ok(wbs.includes(condition), `Missing acceptance evidence: ${condition}`);

const raci = parseTable(sources.get('raci'));
assert.equal(raci.rows.length, 14);
assert.deepEqual(raci.columns.slice(1).map(column => column.key), roleOrder);
assert.equal(raci.columns.length - 1, 8);
const matrix = raci.rows.map(row => roleOrder.map(role => row[role]));
// This signature freezes all 112 original assignments, beyond a count-only test.
const originalAssignmentSHA256 = '20715bedfd4a9b01ead2f2def99d5e88ab99366a06bde6780672b83eb1589cbb';
assert.equal(sha(JSON.stringify(matrix)), originalAssignmentSHA256);
assert.equal(scenario.contracts.raciAssignmentSHA256, originalAssignmentSHA256);
for (const [index, row] of raci.rows.entries()) {
  const codes = roleOrder.map(role => row[role].split('/'));
  assert.equal(codes.filter(code => code.includes('A')).length, 1, `${row.id} must have one accountable role`);
  assert.ok(codes.some(code => code.includes('R')), `${row.id} must name a responsible role`);
  assert.equal(row.id, `RACI-${String(index + 1).padStart(2, '0')}`);
  assert.ok(row.work.startsWith(row.id));
}
assert.equal(raci.rows[10].sponsor, 'A', 'Sponsor decides SMS scope/cost');
assert.equal(raci.rows[11].sponsor, 'A', 'Sponsor owns Go / No Go');
assert.equal(raci.rows[12].ops, 'A/R', 'Operations owns preauthorized rollback');
assert.equal(raci.rows[12].sponsor, 'I', 'Emergency rollback is not a new scope decision');
assert.equal(raci.rows[7].quality, 'A/R', 'Independent verification stays with Quality');

const schedule = sources.get('gantt');
const status = parseGanttStatus(schedule);
assert.equal(status.asOf, scenario.asOf);
assert.equal(status.calendar, 'calendar-days');
assert.equal(status.items.length, 6);
assert.deepEqual(status.plannedTasks, scenario.schedule.plannedTasks);
const rawStatus = JSON.parse(schedule.match(/%% taskobo-gantt-status (\{[^\n]+\})/)[1]);
assert.deepEqual(rawStatus.items, scenario.schedule.trialPairs);
const tasks = [...schedule.matchAll(/:\s*((?:(?:done|active|crit|milestone),\s*)*)([A-Za-z_][\w-]*),\s*(2026-\d\d-\d\d),\s*(2026-\d\d-\d\d|0d)\s*$/gm)].map(match => ({id: match[2], start: match[3], end: match[4], tags: match[1].split(',').map(value => value.trim()).filter(Boolean)}));
assert.equal(tasks.length, 47);
assert.equal(new Set(tasks.map(task => task.id)).size, 47);
assert.deepEqual(tasks, scenario.schedule.tasks, 'Translation must preserve every original task ID, date and tag');
const taskById = new Map(tasks.map(task => [task.id, task]));
assert.equal(taskById.get('status_date').start, scenario.asOf);
assert.deepEqual(tasks.filter(task => task.tags.includes('done')).map(task => task.id), ['a_requirements', 'a_access']);
for (const task of tasks) {
  assert.ok(date(task.start));
  assert.ok(task.end === '0d' || (date(task.end) && task.end >= task.start));
  if (task.tags.includes('done')) assert.ok(task.end <= scenario.asOf, `${task.id} cannot be completed in the future`);
}
const proposals = tasks.filter(task => task.id.startsWith('p_'));
assert.equal(proposals.length, 30);
assert.equal(proposals.filter(task=>task.tags.includes('milestone')).length, 5);
assert.ok(raci.columns.find(column=>column.key==='dev').width>=170);
assert.ok(raci.columns.find(column=>column.key==='ops').width>=160);
assert.equal(scenario.schedule.implementationProposal.approved, false);
for (const task of proposals) {
  assert.ok(task.start >= '2026-10-19');
  assert.ok(!task.tags.includes('done') && !task.tags.includes('active'), `${task.id} is an unapproved proposal`);
}
assert.equal(status.items.find(item => item.current === 'f_api').status, 'overdue');
assert.equal(status.items.find(item => item.current === 'f_api').varianceDays, 6);
assert.equal(status.items.find(item => item.current === 'f_migration').varianceDays, 3);
assert.equal(status.items.find(item => item.current === 'f_test').risk, true);
for (const decision of scenario.decisions) {
  assert.ok(roleOrder.includes(decision.ownerRole));
  assert.equal(taskById.get(decision.taskId)?.start, decision.date);
  assert.ok(taskById.get(decision.taskId)?.tags.includes('milestone'));
  assert.notEqual(decision.status, 'approved');
}

const issues = parseTable(sources.get('issues')).rows;
const risks = parseTable(sources.get('risk')).rows;
assert.equal(issues.length, 6);
assert.equal(risks.length, 7);
assert.deepEqual(issues.map(row => row.id), scenario.contracts.sourceIssueIds);
assert.deepEqual(risks.map(row => row.id), scenario.contracts.sourceRiskIds);
const issueIds = new Set(issues.map(row => row.id)), riskIds = new Set(risks.map(row => row.id));
for (const issue of issues) {
  const fact = scenario.facts.observedIssues.find(item => item.id === issue.id);
  assert.equal(issue.ownerRole, fact.ownerRole);
  assert.equal(issue.status, fact.status);
  assert.notEqual(issue.status, 'closed');
  assert.ok(roleOrder.includes(issue.ownerRole));
  for (const role of issue.supportingRoles) assert.ok(roleOrder.includes(role));
  assert.deepEqual(issue.dueDates, fact.dueDates);
  for (const due of issue.dueDates) assert.ok(date(due) && due >= scenario.asOf);
  if (issue.forecastDate) assert.equal(issue.forecastDate, fact.forecastDate);
  for (const id of issue.scheduleRefs) assert.ok(taskById.has(id), `${issue.id} cites a real schedule entry`);
  assert.ok(issue.issue.startsWith(issue.id));
  assert.match(issue.close, /^Closure requires /);
}
assert.match(issues[0].issue, /authentication returns 401/);
assert.equal(issues[0].forecastDate, taskById.get('f_api').end);
assert.ok(taskById.get('b_api').end < scenario.asOf && scenario.asOf < issues[0].forecastDate);
assert.equal(issues[1].forecastDate, taskById.get('f_migration').end);
assert.match(issues[1].issue, /80 duplicate-key candidates among 20,000/);
assert.match(issues[2].close, /independent verification and business acceptance/);
assert.equal(issues[3].estimatedGapPersonDays, scenario.facts.resourceConflict.estimatedGapPersonDays);
assert.equal(issues[3].conflictStart, scenario.facts.resourceConflict.start);
assert.equal(issues[3].conflictEnd, scenario.facts.resourceConflict.end);
assert.match(issues[5].issue, /30 cases: 18 passed, 5 failed, 4 blocked, 3 not run/);
for (const risk of risks) {
  assert.equal(risk.future, true);
  assert.match(risk.risk, /could /, `${risk.id} describes a future consequence`);
  assert.ok(roleOrder.includes(risk.ownerRole));
  for (const id of risk.issueRefs) assert.ok(issueIds.has(id));
  for (const review of risk.reviewDates) assert.ok(date(review) && review >= scenario.asOf);
  assert.match(risk.evidence, /^Required: /);
  assert.ok(risk.trigger && risk.response && risk.residual);
}
assert.doesNotMatch(risks[0].risk, /401/, 'An observed 401 is an issue; further delay is its risk');
assert.deepEqual(risks[0].issueRefs, ['ISSUE-01']);
assert.match(risks[5].response, /trial-environment access pass is not a production release approval/);

const change = scenario.changeRequests[0];
assert.equal(change.id, 'CR-01');
assert.equal(change.approved, false);
assert.equal(change.estimate.personDays, 8);
assert.equal(change.estimate.amount, 600000);
assert.equal(change.estimate.currency, 'JPY');
assert.equal(change.decisionDate, taskById.get('decision_oct16').start);
assert.equal(change.issueRef, 'ISSUE-03');
assert.equal(change.riskRef, 'RISK-04');
const workflow = sources.get('workflow');
assert.doesNotMatch(workflow, /;/, 'Sequence-diagram text must not introduce statement separators');
for (const phrase of ['+8 person-days / +JPY 600,000', '2026-10-16', 'Return for missing evidence', 'Sponsor cannot waive', 'Version the baseline', 'Reject the request', 'Defer SMS beyond the first release', 'Business returns remaining differences', 'CR-01 remains open, escalation is not acceptance']) assert.ok(workflow.includes(phrase), `Change control must retain ${phrase}`);
for (const source of sources.values()) {
  for (const [id] of source.matchAll(/\bISSUE-\d{2}\b/g)) assert.ok(issueIds.has(id), `Unknown issue reference ${id}`);
  for (const [id] of source.matchAll(/\bRISK-\d{2}\b/g)) assert.ok(riskIds.has(id), `Unknown risk reference ${id}`);
}

console.log(JSON.stringify({ok: true, caseId: scenario.id, asOf: scenario.asOf, documents: expectedDocuments, businessContracts: {
  scope: '3 desks / 40 users / 20,000 records', workPackages: 18, deliverableGroups: 6,
  scheduleEntries: 47, trialComparisons: 6, implementationProposalEntries: 30,
  raciRows: 14, raciRoles: 8, originalAssignmentsPreserved: 112,
  futureRisks: 7, observedIssues: 6, trialCaseTotal: 30, pendingSmsChange: '8 person-days / JPY 600,000',
}}, null, 2));
