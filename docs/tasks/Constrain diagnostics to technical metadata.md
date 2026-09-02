---
type: Task
parent: "[[Detect and explain unhealthy vault data]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Constrain diagnostics to technical metadata

## Evidence

Release diagnostics must help support without exposing renovation content.

## Why it matters

Names, note bodies, paths, and free text can disclose a homeowner's property and plans.

## Approach

Define the report from closed technical fields only: versions, migration state, finding codes,
entity kinds, and validated IDs. Add compile-time and runtime checks that reject project-content
shapes.

## Acceptance criteria

- Reports contain no project, room, person, supplier, path, body, or free-text content.
- Unknown report fields cannot bypass the closed shape.
- Copying a report is deliberate and nothing transmits it automatically.

## Risks

A technically formatted error message can still contain user data; exclude messages and causes.

## Outcome

Diagnostics remain useful, local, and content-free by construction.
