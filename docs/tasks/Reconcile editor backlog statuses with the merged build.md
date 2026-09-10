---
type: Task
parent: "[[Trace release criteria to named evidence]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn:
  - "[[Manually accept the eighteen editor reference comparisons]]"
  - "[[Reconcile SDD sections 17, 60 and 96 with the built editor]]"
---

# Reconcile editor backlog statuses with the merged build

## Evidence

Measured on 2026-09-10 on `main` at `5dcc1f20`, reading each note's frontmatter. Twelve editor PBIs
whose capability the merged stack implements all read `status: New`, and so do nearly all of their
Tasks:

| PBI | Its Tasks |
| --- | --- |
| [[Walls and hosted openings]] | 3 Done |
| [[Draw connected walls and create an enclosed room]] | 1 Done, 5 New |
| [[Inspect a selected wall]] | 4 New |
| [[Edit a selected wall precisely]] | 4 New |
| [[Describe what exists in a selected room]] | 7 New |
| [[Define and compare an intended room state]] | 8 New |
| [[Turn a planned outcome into actionable work]] | 1 In Progress, 7 New |
| [[Manage materials from spatial context]] | 6 New |
| [[Understand room costs and follow them to their authority]] | 1 In Progress, 8 New |
| [[Capture and retrieve evidence from spatial context]] | 7 New |
| [[Review renovation readiness spatially]] | 6 New |
| [[Switch editor perspectives without losing context]] | 5 New |

One of the eight New Tasks under room costs is
[[Amend the cost-group totals sentence to the single-row reading]], added the same day.

Three notes carry `In Progress`, which `Product Backlog.base` does not configure: the Tasks
[[Assign DIY or Trade responsibility from room work]] and
[[Open quote comparison from a room cost]], and the Issue [[Vertex editing has no keyboard path]].

## Why it matters

A backlog that reads New over built work points the next planner at building it again. A status
outside the base's vocabulary is outside what `docs/README.md` reads out of it, so no census counts
it.

## Approach

Re-measure first. Move a Task only with a cited evidence link, and let parents follow their
children.

## Acceptance criteria

1. Statuses are re-measured on `main` at the time of the pass, not taken from this table.
2. A Task moves to `Done` only with a cited evidence link — a test name, a capture, or a verdict
   from [[Manually accept the eighteen editor reference comparisons]]. It moves to `Active` where
   the capability is built but not yet accepted, and stays unchanged otherwise.
3. The three `In Progress` values are replaced with configured values.
4. Parent PBI and Feature statuses follow their children.

## Risks

- Built is not accepted. A status moved on the strength of the code alone claims an acceptance
  nobody gave.
- Until [[Reconcile SDD sections 17, 60 and 96 with the built editor]] lands, the SDD still
  describes several of these capabilities as not existing, which is why it is a dependency.

## Outcome

The editor's backlog statuses say what the merged build has and what has been accepted, each move
backed by named evidence.
