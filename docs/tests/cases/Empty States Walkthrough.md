---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 50
sources:
  - PRD §93
  - PRD §94
  - SDD §11
  - SDD §12
  - SDD §60
  - SDD §84
  - SDD §85
status: Approved
---
# Empty States Walkthrough

Design slice 14 in a real vault: both central views telling a user what to do next when they
legitimately have nothing to show. This file is the **canonical procedure**;
`docs/tasks/14-empty-states.md` records what the runs found and points here.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled. Steps 1
and 2 need a vault with **no** renovation projects, so run them before
`Create sample renovation project` — or move `Renovation/` aside and reload.

**Why a human still matters here, and it is the sharpest example in this suite.** The whole
slice turns on one decision: the Plan Editor's empty states are OVERLAYS over a canvas that
stays mounted, never a replacement for it. Nothing automated can see whether that was right,
because the two things it protects are both unreachable from the suite —
`create-sample-project` seeds a plan with **no background** and five zones, and the browser
harness refuses a background outright on SDD §55 grounds. Replace the region instead of
floating over it and both draw an empty state where the scene belongs, with every one of 1976
tests still green. Step 4 is the step that can tell.

The other reason is measurement. jsdom lays nothing out, so no gate here can see whether the
panel covers the thing it is explaining, whether it holds at a sidebar width, or whether it
reads against a themed vault's colours. Steps 3, 8 and 9 are the only places those are looked
at.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could
discharge it as written. [[Smoke Test the Editor]]'s *The triage column* section defines
the five values and what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `browser` | With no projects in the vault, open the Renovation project view (ribbon or command) | A centred panel reads "No renovation projects yet" with a sentence under it | The view's FIRST real content. It mounted an empty Vue app and drew nothing from slice 1 until this slice |
| 2 | `suite` | Look for a button on that panel | **Design slice 16 changed this row's answer.** At the time this walkthrough first ran (see Runs below), the panel carried NO button — Amendment 1's hand-off, slice 16's creation form, did not exist yet. Slice 16 has since built that form: the panel now DOES carry a "Create a project" button, and `docs/tests/cases/Create a Project.md` is the case that walks what it opens | The button existing is now the correct reading of Amendment 1, not a violation of it — its hand-off exists now. A rendered control that does nothing was the failure the amendment was refusing; a MISSING button here is what would need explaining today |
| 3 | `browser` | Drag the view into a sidebar and narrow it to roughly 400–500px | The panel keeps its side margins and the text wraps rather than overflowing or clipping | `max-width: 28em` against a real font at a real width. jsdom cannot measure it and the fixed captures use 1280 |
| 4 | `suite` | Run `Create sample renovation project`. When the editor opens, look at the canvas | The five zones are visible and nothing floats over them — no "No plan document yet" panel and no `FloorStart` panel either | **The row this slice's central decision moved out from under.** `PlanEditorRoot.vue`'s `overlay` computed nulls the `noBackground` key whenever `projectStore.zones.size > 0` (added by `e53bf9ac6`, "Implement floor start and reference plan setup", 2026-09-06), so the seeded plan's five zones (`sampleProject.ts`'s `SAMPLE_ZONES`) now suppress the panel outright — even though `selectPlanEditorEmptyState` still answers `'noBackground'` for it (`tests/presentation/emptyStates/selectors.test.ts` "still asks for a background when the plan already has zones"). Pinned in jsdom by `tests/presentation/editor/emptyStateOverlay.test.ts`'s "does not mistake rooms without a reference for an empty floor" and "keeps populated geometry visible without a reference, including after selection clears" — both mount a plan with `background: null` and non-empty zones and assert no overlay renders. What still needs a vault: that the real seeded scene (the real command, the real notes, the real paint) matches what those fixtures assert |
| 5 | `suite` | **Withdrawn.** Previously: read the panel step 4 used to show | There is no such panel over the seeded plan any more — see step 4 | The `noBackground` copy (`empty.plan.no-background.headline`/`.body` in `en.ts`) is untouched and the KEY still resolves to `'noBackground'` for this plan, but `PlanEditorRoot.vue`'s `overlay` computed never renders it while the plan has zones, since `e53bf9ac6`. There is nothing left for a reading step to do here |
| 6 | `suite` | **Withdrawn.** Previously: press **Add** over the canvas and choose **Room**, expecting the panel from step 4 to disappear | There is no panel showing to disappear | The yield-to-active-tool rule (`overlay`'s `tool !== null && tool !== 'select'` guard) is still real and does not care which key is active — pinned for the `noZones` panel by `emptyStateOverlay.test.ts`'s "yields to an active tool" (step 9/10's subject: a plan WITH a background and zero zones) and for `FloorStart` itself by `referenceWorkflow.e2e.test.ts` (its "rooms" route hides `FloorStart` once `activeToolId` becomes `'draw-room'`) — but neither of those is the seeded plan, which at HEAD carries no panel to test the rule against |
| 7 | `suite` | **Withdrawn.** Previously: press Escape (or switch back to Select), expecting the panel from step 4 to return | There is no panel to return, for the same reason as steps 5 and 6 | `overlay` is a plain Vue `computed` over `activeToolId`, so a cleared tool re-admitting the same key would follow from ordinary reactivity rather than special-cased code — but no test in the suite drives a tool back to `null`/`'select'` and re-checks the overlay's reappearance for either key, so that half is not claimed here |
| 8 | `suite` | With the room task running, drag a rectangle on the canvas and press **Create room**, then set a plan background via `Set plan background` | With a background AND rooms, no panel is drawn at all | The both-populated case — the normal render this slice must not disturb. The gesture is the Add Room increment's (2026-09-04): a drag sizes a DRAFT and nothing exists in the vault until Create, where "draw and close a polygon" used to write the zone on the closing click |
| 9 | `suite` | Delete every room on a plan that HAS a background | "No rooms yet" appears over the canvas, WITH an "Add a room" button | The third state, and the only one carrying an action. Its copy must differ from step 5's — the same wording for both would tell a user with a background to import a plan. The two labels are `empty.plan.no-zones.headline` and `.action`, which the Add Room increment retitled from "No zones yet" / "Draw a zone" — the KEYS did not move, because ADR-0016 makes Room a presentation projection over `Zone` |
| 10 | `suite` | Press that "Add a room" button | The room task starts and the panel disappears in one click; the banner names it and the Inspector is replaced by the New room form | The one wired hand-off in the slice. It arms a tool rather than dispatching a command, because a room cannot be created with no geometry — and since the Add Room increment it does so through `activateCreationEntry('room', runtime)`, the same ONE door the Add menu's Room item takes, so this button and that menu item cannot drift apart. **"Drawing works immediately" was the old answer and is no longer one**: the drag now sizes a draft, and `Create room` is what writes the Zone |
| 11 | `judgement` | Switch the vault to the other colour scheme (Settings → Appearance) and revisit any empty state | The panel is still clearly distinguishable from the page behind it, and no colour looks hard-coded | SDD §84. The build refuses a literal colour, but only a themed vault shows whether the Obsidian variables chosen were the right ones |
| 12 | `obsidian` | Set Obsidian's language to German and reopen the Renovation project view | Every line of the panel is German | The registry holds `StringKey`s, never copy, and `de.ts` answers all seven of this slice's keys |
| 13 | `browser` | Pan and zoom the canvas while an empty-state panel is showing | The camera responds normally; the panel does not swallow the gesture | `pointer-events: none` on the overlay with `auto` on its button alone. Setting it on the card would make the panel a pointer trap over a canvas the user is trying to draw on |
| 14 | `obsidian` | Open the same plan in two tabs (split the leaf) while an empty state shows, then add a room in one (Add ▸ Room, drag, **Create room**) | Both tabs agree — the panel clears in both once the plan has rooms | The empty state is derived from store state that plan-change events refresh in every leaf, not from a one-off read. The event is published by the create command, which the Add Room increment moved behind Create rather than the closing click of a polygon |

## Deliberately NOT checked

- **A dangling plan reference.** A Plan Editor whose stored plan id no longer resolves shows
  the pre-existing "this plan no longer exists" message, not an empty state — that distinction
  is the slice's `Ok(null)`-is-a-broken-reference rule, and what that case should eventually
  render is slice 17's.
- **A failed read.** An unreadable vault must never render as an empty state, but forcing a
  persistence failure by hand is not a step anyone can follow reliably. It is asserted in the
  suite instead, at the store.
- **The icon slot.** `EmptyState` has one and no registry entry fills it; there is nothing to
  look at until the first `setIcon` caller exists.
- **A populated Renovation project view.** There was no project list at the time this slice
  shipped — this slice defined only what renders in its place, and step 1's panel was the
  whole surface. Design slice 16 built that list (`ProjectList.vue`); walking it is
  `docs/tests/cases/Create a Project.md`'s job, not this file's.

## Runs

| Date | Result | Findings |
| --- | --- | --- |
| 2026-08-27 | Pass | None. The first walkthrough of a slice touching a rendered surface to find nothing — worth recording against slice 5's four-in-a-row, and the reason step 4 exists is that it was the one thing 1976 green tests could not have told anybody |
