---
type: Feature
parent: "[[Plan editor]]"
order: 40
status: ""
started: ""
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
---

# Layers

§13 names the initial six: background, areas, construction sections, assets, work, annotation.
They are a feature rather than a rendering detail because a renovation plan becomes unreadable
about ten minutes after it becomes useful, and hiding everything except the thing being decided
is the only way back.

Layer state is sidecar data (§37) — it is a per-plan editor setting, not domain data, and it does
not belong in frontmatter a user reads.

## Outcome

A renovator can look at one aspect of a busy plan without deleting or moving anything.
