---
type: Task
parent: "[[Meet editor performance and cleanup budgets]]"
order: 10
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Instrument the proposed editor response budgets

## Evidence

The implementation plan proposes five response budgets for Phase 0/12 validation.

## Why it matters

Without common start/end marks, results from different machines and flows are incomparable.

## Approach

Define measurement boundaries and representative fixtures for usable render, pan/zoom frame rate,
selection, Inspector change, and long recalculation. Record machine, host, build, and fixture.

## Acceptance criteria

- Each proposed budget has an unambiguous measurement protocol.
- Instrumentation does not include unrelated Obsidian startup work.
- Results retain raw values rather than pass/fail alone.

## Risks

Instrumentation overhead can distort sub-100-ms paths; measure and disclose it.

## Outcome

Every proposed budget can be measured reproducibly.
