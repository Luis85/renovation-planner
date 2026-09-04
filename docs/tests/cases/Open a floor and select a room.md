---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 85
sources:
  - Plan editor foundation design spec §1 (M00, M01)
  - Plan editor foundation design spec §5 (M16)
  - Plan editor foundation design spec §6
  - Plan editor foundation design spec §7 (M02)
  - ADR-0016
  - ADR-0017
status: Ready
---

# Open a floor and select a room

The plan editor foundation increment's read path: a floor opens into the Standard Plan View
(M01) with Select already active and nothing selected, a room selects into the Room Inspector
(M00's frame with only the sections this build supports), the Add menu (M02) is the one door
into creating something, and the shell keeps the selection and the viewport intact as the leaf
narrows toward M16's constrained layout. `docs/superpowers/plans/2026-09-02-plan-editor-foundation-read-path.md`
is the plan this case's wave belongs to.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and at
least one project with a plan holding a Room-classified zone and at least one zone that is not
a Room. **Create sample renovation project** seeds exactly this if the vault is empty: three
Rooms (Kitchen, Bathroom, Living room) and two Areas (Terrace, Garden), no background — which
is also why step 9's Reference plan row is expected disabled.

## Why a human is the only instrument for four of these

`tests/presentation/editor/shell/**` and `tests/presentation/editor/add/**` drive the resolver,
the stores, the menu and every component named below through the real mounted tree and assert
what it did — the design spec's own §10 test table names each clause by name. Four things sit
outside all of that, because they are facts about the HOST rather than about this tree:

1. **Whether Obsidian's own keymap fires behind the open Add menu.** jsdom models no host
   keymap at all — the space bar and `Shift+1`/`Shift+2` in [[Canvas Navigation]] are the same
   gap from the canvas's side. `AddMenu`'s `@keydown.stop` never reaches Obsidian's `Scope`
   stack in a test, so whether `Ctrl+P` opens the command palette ON TOP OF an open menu —
   stacking a second interactive surface over the first, rather than being swallowed by it — is
   a fact only a real vault can answer. Step 11 is where it is recorded.
2. **Whether focus really returns to the rail button after the drawer or overlay closes, in
   Electron.** `OverlayPanel`'s `onBeforeUnmount`-adjacent close path calls `.focus()` on the
   button that opened it, and jsdom's `activeElement` proves the call was MADE — it cannot
   prove Electron's renderer honours it the same way, the identical gap
   [[Navigate into a project and back]]'s own header names for `FakeLeaf` being faster than the
   real thing. Step 9 is where it is checked by eye and by pressing Tab afterwards.
3. **Whether the leaf at a real sidebar's width actually lands in `constrained`.**
   `layoutMode.ts`'s `FULL_MIN_PX`/`CONSTRAINED_MIN_PX` are plain numbers over a
   `ResizeObserver` reading, and the suite can drive that function at any width it likes — it
   cannot say what width Obsidian's own leaf chrome leaves once the host's tab bar, the ribbon
   and the resize handle are all subtracted. Step 8 is where the real number is read.
4. **Whether `Focus this tab` actually reveals the leaf.** `PlanEditorContext.focusLeaf()` calls
   the one supported workspace API and nothing more; a fake here can only record that the call
   was made, not that Obsidian brought the tab to the front the way a user would judge "focus"
   to mean. Step 10 is where it is watched.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could
discharge it as written. [[Smoke Test the Editor]]'s *The triage column* section defines
the five values and what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | Run **Open plan editor** from the command palette and pick the sample flat's Ground floor | The editor opens on the Standard Plan View: the context bar reads "Sample renovation › Ground floor" with **Undo** and **Redo** present and both disabled; the **Select** button at the bottom of the canvas reads pressed, nothing is selected, and the Inspector shows a floor summary — **Rooms** 3, **Areas** 2, a **Total area** figure, and **Planned changes** and **Estimated cost** both reading *Not available yet* | The runtime failing to activate `select` the first time `ProjectStore.status` becomes `ready`, which used to leave a freshly opened editor in camera mode with no user-reachable way back into a tool (design spec §4); an `unavailable` aggregate leaking a stray zero or a blank cell instead of the word; and Undo or Redo reading enabled with nothing yet to undo or redo |
| 2 | `browser` | Move the pointer over the Kitchen on the canvas, without clicking | An outline appears around Kitchen and the cursor becomes a pointer/hand; moving off the room removes the outline and restores the default cursor | `renderState.hoveredObjectId` not being written from the resolver's body hit (design spec §6.2), or the `cursorClass` mechanism not reaching the actual pointer — jsdom resolves no styles, so nothing here can see a computed `cursor` |
| 3 | `suite` | Click the Kitchen on the canvas | The Inspector shows the Room Inspector for Kitchen: name "Kitchen", **Type** "Room", **Floor** "Ground floor", an **Area** in m²; below it, the Requirements panel, then **What's here** / **What will change** / **What needs doing** and **Costs** / **Documents** / **Photos** / **Notes**, every one of them reading *Not available yet* with no button, link or other control anywhere among the seven rows | `HomeownerQuestionNav`/`LinkedContentList` rendering a live control that does nothing (the slice 14 amendment this build still refuses), and the Inspector frame routing the wrong body for exactly one selected id |
| 4 | `desktop` | With Kitchen still selected and a screen reader running, press **Escape** | The Inspector returns to the floor summary, and the screen reader announces *"Select a room on the canvas or from the list to see its details."* exactly once — it does not announce again on an unrelated re-render a few seconds later | The `role="status"` guidance text (design spec §6.6) never reaching assistive technology at all, or firing twice because the timer that clears it after one tick did not run |
| 5 | `suite` | Click **Kitchen** inside the Rooms list in the floor summary, rather than on the canvas | Kitchen becomes selected — the same room the Room Inspector now shows, with its list row reading pressed — and the camera reframes to fit it with a margin | The list row calling `selection.select` without the matching `fitViewport` call (design spec §6.4), which would select a room the user cannot see without panning to find it |
| 6 | `browser` | Press Escape to clear the selection, then click **Add** | A menu opens below Add: **Room** is the first entry and already carries keyboard focus, showing the hint "Fastest way to start"; the other nine entries are visibly dimmed and each announces "Not available in this version yet." when focused; ArrowDown/ArrowUp/Home/End move that focus through all ten entries with none skipped; Escape closes the menu and returns focus to the Add button | An unsupported entry that LOOKS pressable — jsdom resolves no styles, so the class the suite can assert (`rp-add-menu__item--unsupported`) is not proof the keyword reaches the pixel — and a roving `tabindex` that strands on a filtered-out entry |
| 7 | `suite` | Open Add again, activate **Room**, then click three points on open canvas and click the first point again to close the shape | A banner appears across the top of the canvas reading "Adding a room" and "Click to place corners; click the first corner to finish.", with a Cancel button; closing the triangle creates a new room, which becomes the one the Room Inspector shows; the banner disappears and Select reads pressed again | The runtime not returning to Select on a successful close (design spec §7.3), which would leave a user who just finished drawing still holding the draw tool with no visible way back except the Add menu |
| 8 | `obsidian` | Drag this leaf's border, or drop its tab into a sidebar, until it is roughly as narrow as Obsidian's own sidebar | The layout switches to the rail: **Layers** and **Details** text buttons replace the side panels, while the canvas keeps showing the same scene — still framed on Kitchen from step 5, and Kitchen still selected | The layout-mode switch remounting `PlanCanvas` rather than moving panels around it, which would lose the viewport and the selection exactly where design spec §5.4 requires both to survive |
| 9 | `obsidian` | In the rail, click **Layers**, then press Escape; then reopen it and press Tab from its last control | An overlay opens over the canvas: "Floor — Ground floor", a disabled **Reference plan** row reading "No reference plan has been added to this floor." with a disabled **Set scale** button, and an enabled **Rooms** row. Escape closes it and focus visibly returns to the Layers rail button; on reopen, focus leaves the overlay onto the canvas and the overlay stays open (it does not trap focus — M16 as amended 2026-09-04) | Two overlays open at once (design spec §5.5's one-overlay rule), and focus left stranded on the canvas or the document body once the overlay is gone |
| 10 | `obsidian` | Narrow the pane further, below what a sidebar leaf can show, then press **Focus this tab** | The canvas is replaced entirely by a headline, "This pane is too narrow to edit the floor plan", a sentence naming the floor and its room count ("Ground floor has 3 rooms. Widen the pane or focus this tab to edit."), and the **Focus this tab** button; pressing it brings this leaf to the front and gives it more width (a one-room floor reads "has 1 room"; a floor with unreadable records says its count is unknown) | A canvas left mounted below a usable width (an unreadable, unusable Konva stage), and a `Focus this tab` button that calls an API and visibly does nothing |
| 11 | `obsidian` | With Add open, press `Ctrl+P` (`Cmd+P` on macOS) | Obsidian's command palette opens ON TOP of the menu (or the shortcut is swallowed — record which); dismissing the palette returns focus to the menu item that had it, and Escape then closes the menu with focus back on Add | The host keymap and `AddMenu`'s `@keydown.stop` disagreeing about who owns the key — jsdom models no `Scope` stack |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from the design spec, the actual component source and its English copy — never from memory of either. |

## Outcome

Written after the first walk: which steps passed, and anything only a live vault showed.
