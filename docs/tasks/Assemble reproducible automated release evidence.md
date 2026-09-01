---
type: Task
parent: "[[Produce auditable release evidence]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Assemble reproducible automated release evidence

## Evidence

Automated evidence must identify the build, command, fixture, and exact assertion it supports.

## Why it matters

A screenshot of a green summary cannot be reproduced or mapped to a release claim.

## Approach

Run the release gates and targeted room, recovery, health, accessibility, locale, responsive, and
performance checks. Record commit/build identity, commands, environments, outputs, and failures.

## Acceptance criteria

- Another reviewer can rerun every automated result.
- Targeted failures are not hidden by aggregate success.
- Evidence is attached to the same build assessed manually.

## Risks

Rerunning after a source change creates mixed-build evidence; invalidate the prior set.

## Outcome

Automated release evidence is reproducible and tied to one candidate.
