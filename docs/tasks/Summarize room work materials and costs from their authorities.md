---
type: Task
parent: "[[Turn a planned outcome into actionable work]]"
order: 60
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Summarize room work materials and costs from their authorities

## Evidence

M10 requires derived material and cost summaries, while this PBI explicitly limits the Inspector
to authority-owned summaries rather than owning procurement or cost workflows.

## Why it matters

Editor-calculated copies can disagree with canonical requirements, prices and overrides while
looking like current project totals.

## Approach

Query material and cost authorities for canonical work linked to the selected room. Present
aggregated summaries with provenance, staleness and unavailable or unreadable states, without
persisting editor totals.

## Acceptance criteria

- Material and cost values come from their authority-owned queries.
- Each summary identifies its scope and calculated or overridden provenance.
- Stale, unavailable and unreadable values are distinct from zero.
- Refreshing the room derives the summary again and writes no duplicate total.

## Risks

Aggregation may mix project currency, work outside the room or stale values without disclosure.

## Outcome

The room work view shows trustworthy material and cost consequences without becoming their owner.
