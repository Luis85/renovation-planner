---
type: Task
parent: "[[Meet editor performance and cleanup budgets]]"
order: 20
status: New
horizon: "MVP"
release: "[[MVP]]"
---

# Benchmark representative floors and interactions

## Evidence

Phase 12 calls out large floors, many markers, images, and rapid pan/zoom.

## Why it matters

A tiny test scene cannot validate the floor complexity where interaction degrades.

## Approach

Run the measurement protocol on typical and large documented fixtures in a release build and live
Obsidian. Validate under 1.5-second usable render, 60-fps target/30-fps minimum, under 100-ms
selection, under 200-ms Inspector change, and status above 300-ms recalculation.

## Acceptance criteria

- Every target has raw results for named fixtures and environments.
- Any failed proposed budget has a defect or explicit target-revision decision.
- Pointer previews never wait for vault I/O.

## Risks

One fast development machine can hide the supported floor; retain hardware details.

## Outcome

The release decision uses measured homeowner-scale performance.
