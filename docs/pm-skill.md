# Less project administration after every meeting

[English](pm-skill.md) · [日本語](pm-skill.ja.md) · [简体中文](pm-skill.zh-CN.md)

**Give your AI the current plan and this week's notes. Get back an update you can review and keep maintaining.**

Taskobo Diagrams helps AI organize and maintain project material, so PMs can focus on judgment, communication and delivery. It is an open-source initiative from [Taskobo](https://taskobo.com/).

This guide and the diagram gallery are in English. The installable Skill, bundled teaching material and review interface currently remain a **Chinese Alpha**; this documentation does not change their output language.

## What it helps a PM do

| Common pain | What the Skill helps prepare |
|---|---|
| Every meeting creates another round of manual follow-up | Decisions, actions and plan changes with their supporting notes |
| Dates or owners disagree across documents | WBS, RACI and schedule diagrams generated from one project state |
| AI changes a lot, but the reasons are unclear | Before/after values, verbatim quotations and source-file hashes |
| Tasks repeat and older decisions get lost between weeks | Stable identifiers and applied-update records for ongoing maintenance |

A forecast is still a forecast. Discussion is not approval, and reported completion is not acceptance. The PM can review AI's proposals before saving a new version under the actual authorization.

## Download and install

[Download Taskobo Diagrams (Chinese Alpha)](https://github.com/dfzzq719/taskobo-diagrams/raw/refs/heads/main/docs/downloads/taskobo-diagrams-zh-CN.zip)

1. Unzip the package and open `taskobo-diagrams/assets/demo/review.html` to view the offline Chinese example. Viewing it needs no development environment.
2. To run the workflow with AI, put the complete `taskobo-diagrams` folder in your AI software's supported Skill directory. Codex can use `~/.agents/skills/taskobo-diagrams/`, with `SKILL.md` directly inside it.
3. Reload or restart the AI session. Validation and rendering require **Node 22.12+ and an installed Chrome or Edge**. The AI software must support local files and command execution.
4. Invoke `$taskobo-diagrams` from your own project directory, with the current project state and new notes. Keep real project material outside the installation folder.

Installation paths and permissions vary by AI software. A chat interface that cannot run local tools cannot execute these scripts directly.

## A prompt you can use

> Use $taskobo-diagrams to organize an update from this project's project.json and this week's meeting notes. First show before/after changes, actions, decisions I need to make and updated diagrams. Preserve the approved baseline and keep forecasts separate from commitments.

If the existing plan is in Word or PDF, AI software with document-reading capabilities can first extract a text snapshot and draft an initial state. These scripts accept structured project JSON and text sources; they do not include OCR, audio transcription or Word/PDF parsers.

## Start with your own plan

Use `pm.mjs init --from plan.md --out draft` with Markdown or UTF-8 CSV; export Excel to CSV first. The draft preserves source text, hashes and open questions. AI then helps establish the project state after gaps are resolved. Dates, responsibility assignments and baseline approval are never filled in automatically.

Projects support **up to 300 work packages and 32 roles**. Views are paged by group, with 12 tasks and 8 RACI roles per page by default; each WBS figure shows at most 4 work packages. Dependency diagrams include cross-group predecessors. Full acceptance text stays in the review page and project snapshot.

Use `--force` to refresh an unchanged generated output directory. Errors identify the chart and stage, preserving sources and valid SVGs. Expired forecasts retain their dates and are flagged for review. `--format sources` exports material without a browser. See the [command and diagnostic reference](../skills/taskobo-diagrams/references/rendering.md) (Chinese).

## Follow two consecutive updates

The [Chinese teaching sources](../examples/pm-update-zh-CN/) include an initial state, two meeting notes and their update packages. The status date advances from 14 October 2026 to 16 and 21 October, with 18 work packages and 8 roles.

This is an **independent fictional teaching branch** showing “plan → first update → second update.” Its later events are separate from the original CRM gallery case. GitHub displays the [result HTML](assets/pm-update-zh-CN/final/review.html) as source; download the package to open the offline preview. For English images and editable sources, use the [English gallery](gallery.md).

## Who does the work after installation?

You keep using your current AI. One main agent reads the Skill and organizes the work; local scripts validate and render it. Where the host supports subagents and the material warrants it, separate agents may analyze evidence, dates or responsibilities, with the main agent consolidating their findings.

**You do not need a separate agent for every step.** The Skill includes no model or key and starts no permanent agents. Model calls and material processing follow the AI software you already use.

## Current scope

This version supports local project updates, evidence checks, selective application of changes, paged WBS/RACI/schedule diagrams, dependency diagrams and a static review page. Before and after states remain separate files. Candidate changes without confirmation or existing authorization remain pending.

It does not automatically connect to external task systems, revise approved baselines or guarantee a complete dependency-impact analysis. Estimates, tradeoffs, acceptance and project commitments remain the team's responsibility.

[Checks and current limits](quality.md)

<details>
<summary>Skill instructions and data format</summary>

[Skill entry](../skills/taskobo-diagrams/SKILL.md) · [Update workflow](../skills/taskobo-diagrams/references/workflow.md) · [Project format](../skills/taskobo-diagrams/references/project-format.md) (current instructions are in Chinese)

Rendering uses the shared core and styles in this repository; users do not need to write Mermaid themselves. The bundled runtime is pinned. To update, download and replace the complete Skill while keeping your project directory.

</details>
