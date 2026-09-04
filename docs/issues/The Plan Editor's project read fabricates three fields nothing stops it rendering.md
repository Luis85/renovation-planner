---
type: Issue
parent: "[[The project surface]]"
order: 20
status: New
started: ""
finished: ""
horizon: Now
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# The Plan Editor's project read fabricates three fields nothing stops it rendering

`createPlanEditorQueries.getProject` supplies `libraryOverlap`, `planCount` and `lastWorked`
itself, because the editor has no port that can answer them. The values are safe only while
that surface renders none of the three.

## The question

The Renovation Planner Home surface made `planCount` and `lastWorked` **required** on
`ProjectSummaryDto`, deliberately: an absent field and a zero read identically at the site that
renders them, which is the argument `libraryOverlap`'s own docblock already made. Required
fields mean every producer must answer. The Plan Editor is a producer and has nothing to answer
with. What happens the day it needs one?

## What is true today

`src/presentation/read-models/planEditorQueries.ts` states the position at its own call site:
`libraryOverlap` is `false`, and `planCount` and `lastWorked` are supplied because *"the Plan
Editor renders none of the three fields they feed"*. That is accurate — the three belong to the
Home surface and are read by `IndexProjectListFacts`, which this bundle does not carry.

The claim was measured when it was written and is true now. What it rests on is that **no Plan
Editor component reads any of the three**, and nothing enforces that. There is no test asserting
the editor does not render them, and no type distinguishing a fabricated `ProjectSummaryDto`
from a real one — the two are the same shape by construction, which is what makes the
substitution invisible.

## Why it matters

The trap does not fire for the author of this code. It fires for whoever next adds a fact to the
Plan Editor's project header — a plan count beside the project name is an entirely reasonable
thing to want there — and it fires **silently**, because a fabricated `planCount: 0` renders as
a plausible zero rather than as an error. The surface would report that a project with seven
plans has none.

This is the shape the required-field decision was taken to prevent, displaced one bundle over:
the compiler forced every producer to answer, and one of them answered with a constant.

## What closes it

A facts port on `PlanEditorQueryServices`, so the editor's `getProject` derives the three the
same way the Home surface does. That is the real fix and it was explicitly out of scope for the
merge that surfaced it — adding a port to a query bundle at the end of a branch is a change with
its own review.

The cheaper interim, if the port is not wanted yet: make the fabrication unrepresentable rather
than commented. A distinct return type for the editor's read — one that carries the fields the
editor actually uses and no others — turns "the editor renders none of these" from a sentence
into something the compiler holds.
