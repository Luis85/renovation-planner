---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 97
sources:
  - Structural posts and beams design spec §5 (drawing), §6 (rendering and inspector), §7 (deletion)
status: Ready
---

# Draw posts and beams

The structural posts and beams increment: Add → Post places one post per click at a typed section and stays on
for the next; Add → Beam saves on its second click at a typed width. Both carry a Load-bearing switch, and deleting
a load-bearing one says so in the confirmation. `docs/superpowers/specs/2026-09-13-structural-posts-and-beams-design.md`
is the design and `docs/superpowers/plans/2026-09-13-structural-posts-and-beams.md` the plan.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a floor with one wall
drawn. **Create sample renovation project** seeds a floor; draw a wall on it first.

## Why a human is the only instrument for three of these

Every write and warning below is driven in `tests/presentation/editor/structuralCreation.test.ts`,
`structuralInspector.test.ts` and `structuralDeletion.test.ts`. Of step 3, only the load-bearing toggle and
one undo are (on a beam, in `structuralInspector.test.ts`) — no test there drives a redo, and none renders or
asserts the filled ↔ outline-only swap itself, only the underlying `loadBearing` boolean. Outside all of it:

1. **Whether the post and beam symbols read as structure on a themed plan.** jsdom draws nothing; the harness
   shots use Obsidian's default colours only.
2. **Whether the `rp-post` and `rp-beam` icons render in the host's Add menu.** They are registered artwork,
   and only a vault shows `addIcon` honouring them.
3. **Whether a post snaps to the wall's centre line under a real hand.**

## Steps

| # | Do | Expect |
| --- | --- | --- |
| 1 | Add → Post. Click three points along the wall's centre line. | Three filled squares with diagonals, centred on the wall; the tool stays on after each. |
| 2 | Escape. Select one post. | The Inspector's sublines read "Post" and "0.14 × 0.14 m", with Load-bearing ticked. |
| 3 | Untick Load-bearing. Undo. Redo. | The square turns outline-only, back to filled, and outline-only again. |
| 4 | Add → Beam. Click either side of the room, crossing the wall. | Two dashed parallel lines; the Inspector shows its length and "0.16 m wide". |
| 5 | Edit the beam, set width 0.24, apply. | The dashed band widens. |
| 6 | Delete a load-bearing post. | The confirmation ends "Load-bearing: Post. Remove only after a structural check." Confirm removes it; Undo restores it. |
| 7 | Select two posts and the beam, press Delete, then Cancel. | One confirmation naming every load-bearing item; Cancel leaves all three in place. |
| 8 | Reopen the plan note's geometry sidecar in a text editor. | `"schemaVersion": 11`, each post with `"loadBearing"`, the beam with `"width"`. |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row is an expectation derived from the spec and the suite. |

## Outcome

Written after the first walk.
