---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 88
sources:
  - First-beta readiness limitation L-46, and owner ruling 6 ("One Tab stop", 2026-09-25)
  - AD18-R23 (the lock's state is its accessible name; no `aria-pressed`)
  - ADR-0027 (the lock is a non-canvas route that locks or unlocks one zone)
status: Ready
---

# Walk the room lists from the keyboard

The Plan editor draws its rooms as lists in two places — the Floor inspector's **Rooms** and
**Areas** lists, and the Layers panel's **Rooms and areas** list — all through one component,
`RoomSummaryList.vue`. Since L-46 each list is **one Tab stop**: Tab enters the list once,
ArrowDown and ArrowUp move between rooms, ArrowRight reaches that row's lock and ArrowLeft comes
back. Every lock sits outside the Tab order, so a floor of forty rooms no longer costs eighty
Tab presses to cross. This case walks that in a real vault, and records the two things no
automated run here sees: whether the focus ring is visible, and what a screen reader makes of a
list whose arrows it is not told about.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, on a
desktop. **Create sample renovation project** seeds what the steps need — three Rooms and two
Areas on one floor, none locked — and opens the editor on it. Leave the **Select** tool active
and nothing selected, so the Inspector shows the floor. If the pane is narrow and a **Details**
rail button shows, press it first, so the Floor inspector is on screen. The steps name rows by
position, not by room, because the list's order is not part of this case: record the names you
see.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could discharge it as
written. [[Smoke Test the Editor]]'s *The triage column* section defines the five values and what
they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `browser` | Click the **Kind** label in the Floor inspector, above the Rooms, Areas and Total area figures. That puts focus on the Kind select without opening it, and it is the last control before the Rooms list. Then press `Tab` once | Focus lands on the **first** row of the **Rooms** list | The list's Tab stop sitting on some row other than the first on a fresh open, or the list not being in the Tab order at all |
| 2 | `browser` | Press `Tab` once more | Focus leaves the Rooms list: with the sample's Areas it lands on the **first row of the Areas list** — the inspector's second stop, see *Limits* — and never on the second Rooms row or on any lock | The one-stop rule itself. Before L-46 every row AND every lock was its own stop, so this press reached the first row's lock |
| 3 | `suite` | Press `Shift+Tab` to return to the Rooms list's first row, then `ArrowDown` twice, then `ArrowDown` once more, then `ArrowUp` once | `ArrowDown` twice moves focus to the third row; the third `ArrowDown` leaves it on the third (the last — the list does not wrap); `ArrowUp` moves it to the second row. Moving focus selects nothing | The arrows moving focus without moving the Tab stop with it, and a wrap from the last row to the first |
| 4 | `browser` | With focus on the second row, press `Tab` to leave the list, then `Shift+Tab` | Focus comes back to the **second** row — the row you left from — and not to the first | The Tab stop following the first row rather than the last focused one. A stop that resets on every exit makes a long list useless from the keyboard |
| 5 | `suite` | Press `ArrowRight` | Focus moves to that row's **lock** button, an open padlock. Its accessible name — read with a screen reader, or from the button's `aria-label` in the developer tools — is "Lock *room*", with that row's room name | The lock being unreachable from the keyboard once it left the Tab order. The canvas context menu offers no lock, so this key is the ruling's whole keyboard route |
| 6 | `browser` | Press `Enter` | The padlock closes, the button's accessible name becomes "Unlock *room*", and focus **stays on the lock**. The room's note now carries `locked: true`. The button has no `aria-pressed` attribute at all | The key not activating the lock, focus jumping back to the row or out of the list once the record re-renders, and a pressed state announced on top of a name that already says the state (AD18-R23) |
| 7 | `browser` | Press `Space` | The padlock opens again, the name returns to "Lock *room*", `locked` is gone from the room's note, and focus is still on the lock | `Space` behaving differently from `Enter` on the same button |
| 8 | `suite` | Press `ArrowLeft`, then `ArrowDown` | `ArrowLeft` returns focus to the lock's own row; `ArrowDown` then moves to the next row | The way back from the lock, and the arrows moving from a stale row rather than the one the lock belongs to |
| 9 | `browser` | Move to the Layers panel's **Rooms and areas** list (at full width, where the Layers panel sits beside the canvas). `Tab` into it from the control just above it, press `Tab` once more, then `Shift+Tab` back; walk it with `ArrowDown`, and press `ArrowRight` on any row | `Tab` enters on one row and the next `Tab` leaves the list; `Shift+Tab` returns to that row; `ArrowDown` walks all five records, Rooms and Areas in the one list; `ArrowRight` reaches that row's lock | The second consumer of the same component. Only the Floor inspector's list is driven in real Obsidian |
| 10 | `browser` | Throughout steps 1 to 9, watch whichever control holds focus | A focus ring is visible on every row and every lock while it holds focus, in the default light and dark themes | A focus that moves correctly and cannot be seen — no automated run here measures a focus ring's visibility |
| 11 | `desktop` | With a screen reader running (NVDA or Narrator on Windows, VoiceOver on macOS), repeat steps 1, 3, 5 and 6 | Record what is announced on entering the list, on each arrow, on reaching the lock and after `Enter`, and whether the arrows moved focus or the screen reader's own reading cursor. The lock should be announced by its name alone ("Lock *room*" / "Unlock *room*"), never with "pressed" | What no automated run here can hear. The list carries no composite role (see *Limits*), so a screen reader in its reading mode may take the arrow keys for itself |

## Limits

These are the trade-offs disclosed for L-46. They are part of what was built, not failures to
record against the steps above.

- **No composite role.** The rows stay plain buttons in a plain list, because a `listbox` option
  may not contain the lock button. So nothing tells a screen reader in focus or forms mode that the
  arrows move between rows. How a screen reader's reading (browse) mode treats the rows and locks
  is not verified; step 11 records it.
- **No `Home` or `End`.** Only the four arrow keys are handled. Getting to the far end of a long
  list takes repeated `ArrowDown`.
- **The Tab stop follows focus, not the canvas selection.** Selecting a room on the canvas does not
  move the list's stop to that room. The stop stays on the row the keyboard last left.
- **The Floor inspector costs two stops**, one for its Rooms list and one for its Areas list (step
  2), because each list is its own component. The Layers panel's single list costs one.

## Automated

| Steps | Covered by | What it does not see |
| --- | --- | --- |
| 1–4 | `tests/e2e/nextActionWalk.e2e.ts` › "the Rooms list keyboard (L-46)" › *is one Tab stop, the arrows move between rooms, and Shift+Tab returns to the same row*, in real Obsidian on the Floor inspector's Rooms list | It enters the list from whichever focusable control comes just before it, found by document order rather than by clicking the **Kind** label as step 1 does, and after the `Tab` out it checks only that focus left the list, not where it landed. It does not press `ArrowDown` past the last row or `ArrowUp`; `roomSummaryList.test.ts` covers the no-wrap clamp in jsdom |
| 5, 6, 8 | the same `describe` › *reaches a room's lock with ArrowRight, toggles it with Enter, and returns with ArrowLeft* — reads the lock's `aria-label` before and after and `aria-pressed` as absent, and polls the zone note for `locked: true` | `Space` (step 7), and step 8's `ArrowDown` from the lock (`roomSummaryList.test.ts` has that in jsdom) |
| 3, 5, 8 | `tests/presentation/editor/shell/roomSummaryList.test.ts` › "RoomSummaryList keyboard (one Tab stop)", in jsdom | Anything a real engine does: real `Tab` order, `Enter` or `Space` turning into a click, a visible ring |
| 2, 9 | `tests/harness/roomsKnob.test.ts` › *?rooms=40 costs one Tab stop per rooms list, not two per row*, in jsdom over the harness's Plan editor mount: every `.rp-room-list`, Layers and Floor inspector alike, has exactly one control at `tabIndex >= 0`, its first row | A real `Tab` press, real Obsidian, and the arrows and lock in the Layers list |
| 10, 11 | none | Focus-ring visibility and a screen reader are outside every automated run here |

The E2E file's own header says it was written from source and that CI's E2E workflow was its
first run; no outcome of that run is recorded in this case.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from `RoomSummaryList.vue`, `ZoneLockToggle.vue`, `FloorSpatialLists.vue`, `PropertyLayerPanel.vue`, their English copy and the tests named in *Automated* — not from a walk. |

## Outcome

Written after the first walk: which steps passed, what the screen reader announced, and anything
only a live vault showed.
