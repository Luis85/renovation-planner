---
type: Task
parent: "[[Produce auditable release evidence]]"
order: 80
status: New
horizon: "MVP"
release: "[[MVP]]"
dependsOn: "[[Confirm merged main carries the verified editor state]]"
---

# Run the six additional editor interaction drivers

## Evidence

`remaining-plan.md`, in `docs/user-experience/renovation-planner-editor-specs/implementation/`,
names six scripts under *Zusätzliche Prüfabläufe* that add to the nine journeys and eighteen
comparisons without replacing them:

- `scripts/editor-object-rotation-check.mjs`
- `scripts/editor-room-edge-check.mjs`
- `scripts/editor-group-check.mjs`
- `scripts/editor-curves-check.mjs`
- `scripts/editor-stairs-arrows-check.mjs`
- `scripts/editor-modal-placement-check.mjs`

All six exist on `main`. None is named in `scripts/editor-visual-final-check.mjs`, so the matrix
pass at `22772267` ran none of them, and the integration record holds no separate run. One was
read rather than run: its assertion of thirteen Add catalogue entries served as independent
evidence when another capture script's count was corrected.

## Why it matters

These drivers exercise what the stack added after the matrix was designed: hover, drag and click
rotation; groups and enclosure; room edges and curves; stairs and arrows; opening movement; and
modal placement. A green matrix says nothing about any of them.

## Approach

Run each driver unmodified on `main`, one at a time and never beside another heavy check, with the
pinned Chromium that `scripts/chromium.mjs` resolves. Record each exit code and look at every state
it writes.

## Acceptance criteria

1. Each of the six runs unmodified on `main` with the pinned Chromium. A browser named through
   `RP_CHROMIUM_EXECUTABLE` instead is recorded, and its captures are read as approximate.
2. Each exit code is recorded, and every state the script generated has been looked at.
3. The plan's done condition holds in every scenario: hover, drag and click rotation; groups and
   enclosure; edges and curves; stairs and arrows; opening movement; modals.
4. A failure is triaged before anything changes. An expectation is corrected only against
   independent evidence that the new value is intended; no assertion is weakened; a product defect
   stops the run and is reported.
5. The drivers run one at a time, never beside `npm run check` or another capture.

## Risks

- A capture running beside a gate produces a wrong red rather than a slow one.
- A driver that exits 0 has asserted only what it asserts; the states it wrote still need eyes.

## Outcome

The interactions the stack added have current browser evidence on the merged build, with every
failure classified.
