---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 98
sources:
  - Plan drafting tools design spec §5 (tools), §6 (rendering), §7 (submenu and editing)
status: Ready
---

# Draw drafting marks

The plan drafting tools increment: right-click › Drafting starts a dimension chain, section line, view marker,
hatched area, text, boundary line or grid point at the clicked spot. `docs/superpowers/specs/2026-09-13-plan-drafting-tools-design.md`
is the design and `docs/superpowers/plans/2026-09-13-plan-drafting-tools.md` the plan.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a floor with a room and
its walls drawn. **Create sample renovation project** seeds one.

## Why a human is the only instrument for three of these

Every write, refusal and menu entry below is driven in `tests/presentation/editor/draftingCreation.test.ts`,
`draftingTaskForm.test.ts`, `draftingInspector.test.ts` and `draftingMenu.test.ts`; the layout in
`draftingMarks.test.ts`. Outside all of it:

1. **Whether the marks read as an architect's plan on a themed vault.** jsdom draws nothing; the harness captures
   use Obsidian's default colours only.
2. **Whether the seven `rp-` icons render in the host's context menu.** They are registered artwork.
3. **Whether a chain's points land on a room's corners and a window's jambs under a real hand.**

## Steps

| # | Do | Expect |
| --- | --- | --- |
| 1 | Right-click the empty canvas. Open Drafting. | Seven items with icons: Dimension chain, Section line, View marker, Hatched area, Text, Boundary line, Grid point. |
| 2 | Choose Dimension chain on a room's top-left corner. Click the next corners along the wall. Finish. Move the pointer above the wall and click. | Ticks on every point, a length over every segment, the line where you clicked. |
| 3 | Right-click across the floor, Drafting › Section line, click the other side. | A dash-dot line with filled triangles at both ends and `S-01` beside each. |
| 4 | Select the section. Choose Flip direction. Undo. | The triangles move to the other side of the line, then back. |
| 5 | Drafting › Text inside a room. Type `Wintergarten`. Finish. | The words centred where you clicked; the text field had the keyboard as soon as you clicked. |
| 6 | Drafting › Hatched area. Click four corners outside the floor. Finish. | A cross-hatched area, drawn under any wall it touches. |
| 7 | Drafting › Grid point twice more. | Circles numbered `1`, `2`, `3`; the tool stays on until Escape. |
| 8 | Select the dimension chain. Edit, set Offset to `-1`, apply. | The line moves one metre from the wall; the lengths do not change. |
| 9 | Reopen the plan's geometry sidecar in a text editor. | `"schemaVersion": 12`; the chain carries `"offset"`, the section `"flipped"`. |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row is an expectation derived from the spec and the suite. |

## Outcome

Written after the first walk.
