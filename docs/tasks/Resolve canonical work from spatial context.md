---
type: Task
parent: "[[Link planned outcomes to canonical work]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Create canonical work from a planned outcome]]"
---

# Resolve canonical work from spatial context

## Evidence

M10 requires list and spatial routes to reach the same work record, and the editor-tree PBI
depends on a domain query that distinguishes empty from failed.

## Why it matters

If the editor owns its own list, a task edited in Markdown can remain stale or disagree with its
planned outcome.

## Approach

Provide authority-owned queries by Planned outcome and spatial target, preserve unreadable
results, and return stable task identities rather than editor summaries as canonical data.

## Acceptance criteria

- Outcome and spatial-target queries resolve the same canonical task ID.
- A hand edit is visible on the next query without rewriting Planned state.
- Empty, unreadable and failed results are distinct.
- Querying performs no write and copies no task lifecycle state into the spatial record.

## Risks

Broad project scans could make contextual viewing slow; use the accepted index/reference path
without introducing an editor cache as authority.

## Outcome

Not started.
