---
type: Task
parent: "[[Open a floor plan in the Obsidian editor shell]]"
order: 50
status: Active
horizon: "MVP"
release: "[[MVP]]"
---

# Build full and compact editor status bars

## Evidence

M00 and M05 require an editor status region, M16 names a compact variant, and the component
library defines zoom, grid, snapping, scale, save state and optional gesture hints with
lower-priority controls moving into View at constrained widths.

## Why it matters

Users need persistent orientation and save truth without sacrificing the canvas or losing
controls when an Obsidian leaf becomes narrow.

## Approach

Compose one status model into full and compact presentations. Keep zoom, snapping, scale and
save state visible in the compact form, move lower-priority controls to the existing View menu,
and isolate meaningful announcements from continuously changing pointer or measurement readouts.

## Acceptance criteria

- The full bar exposes zoom, grid, snapping, scale, save state and applicable gesture hints.
- The compact bar retains zoom, snapping, scale and save state.
- Controls omitted from compact layout remain keyboard reachable through View.
- Full/compact changes preserve floor identity, viewport, selection and active temporary task.
- Save, stale and uncalibrated states remain distinct and are not communicated by color alone.
- Live regions announce meaningful state changes without announcing every pointer movement.

## Risks

Forked variants can drift in state semantics, while one indiscriminate live region can make
ordinary canvas movement unusably noisy.

## Outcome

The editor communicates its essential state truthfully at full and constrained leaf widths.

## Amendments

**2026-09-03** — spec §5.7 scoped "compact" to one thing, and this increment built exactly that:
the constrained bar drops the pointer readout and keeps zoom, save state and the NEW scale state,
so a plan still drawn at the placeholder scale says so. `tests/presentation/editor/shell/statusBar.test.ts`
holds all of it — 'says the scale is not set for an uncalibrated plan', 'withdraws the pointer
readout under the constrained layout, and keeps zoom, scale and save state', 'keeps the pointer
readout in the full layout' — and criterion 5's not-by-colour half is that the scale state is a
WORD, beside the save indicator's own mark-and-word (design slice 13). Criterion 6 is the
guidance region's announce-once case in
`tests/presentation/editor/shell/floorInspector.test.ts` plus the pointer readout being a plain
`computed` that announces nothing.

**2026-09-04** — criterion 5 evidence gains: the scale sentence is withheld while loading,
missing or failed (`statusBar.test.ts`, 2026-09-04).

What remains: grid and snapping appear in neither bar, because neither exists as a setting
(spec §5.6), so criterion 1 is unmet by decision; criterion 3 has no subject, because there is no
View menu to keep an omitted control reachable through, and spec §5.6 says why — nothing would be
in it; and criterion 4's 'active temporary task' half is asserted by no case across a
full/compact change.
