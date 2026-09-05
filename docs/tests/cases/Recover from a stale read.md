---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 95
sources:
  - Plan editor trust path design spec §2.2 (the gate), §2.3 (retry is the refresh), §2.4 (a retry that fails again)
  - Plan editor trust path design spec §2.5 (Saved · refresh needed), §2.6 (Open source note)
  - Plan editor trust path design spec §2.9 (which controls pause, and how each says why)
  - Plan editor trust path design spec §11 (the residues, including the doors the gate cannot see)
  - M15-stale-data-warning
  - VS-10 and Scenario D
status: Ready
---

# Recover from a stale read

The trust path — the vertical-slice plan's checkpoint C3, and Scenario D of its §8: *the write
succeeded, the read-back failed*. A room is written, the floor cannot be re-read, and the editor
keeps drawing the scene it can still vouch for while saying so: a warning strip above the canvas,
`Saved · refresh needed` on the status bar, every write control paused with one shared reason,
Undo and Redo still live, **Try again** re-reading and nothing else, and **Open source note** as
the door to the floor's own Markdown. `docs/superpowers/specs/2026-09-04-plan-editor-trust-path-design.md`
is the design and `docs/superpowers/plans/2026-09-04-plan-editor-trust-path.md` the plan this
case's wave belongs to.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a
project with a floor holding at least two rooms. **Create sample renovation project** seeds
exactly that — three Rooms and two Areas on a backgroundless Ground floor — which is also why
step 4's Reference plan row is expected disabled for its own pre-existing reason as well as this
increment's.

## Why a human is the only instrument for eight of these

`tests/presentation/editor/stalePath.e2e.test.ts` drives the whole of Scenario D through the real
mounted editor and counts the repository's writes; `tests/presentation/editor/pausedSurfaces.test.ts`
asserts every row of design spec §2.9's table; `tests/harness/accessibilityTrustPath.test.ts`
scans the strip, the paused Room Inspector and the constrained drawer for semantic violations, and
`npm run harness-shot`'s `plan-editor-stale` and `plan-editor-stale-narrow` have already been read
by eye in the pinned Chromium. Eight things sit outside all of it, and every one is a fact about
the HOST or about the vault rather than about this tree:

1. **Whether a real vault fault produces the stale state at all, rather than the failure panel.**
   The suite injects the failure at the query bundle; a vault produces it by a note ceasing to
   parse, and TWO reads race for it — the post-command `refreshProjection` (which keeps the
   previous scene) and the plain `hydrate()` the root subscribes to `onPlanChanged` (which does
   not, and blanks the floor). The store's ticket is what makes the later read win, and nothing
   here can drive two real vault reads against each other. Steps 2 and 3 are where it is watched.
2. **Whether the write really landed while the read really failed.** Every count in the suite is
   taken at an in-memory repository. Step 9 counts what is on disk.
3. **Whether the paused controls are visibly paused.** `aria-disabled` is what the suite can
   assert and what the captures show under the vendored default palette; whether a THEMED vault
   dims them is a fact about the theme's own `button[aria-disabled="true"]` rule. Step 4.
4. **Whether the shared reason sentence is actually announced.** It is a visually-hidden `<p>`
   pointed at by every paused control's `aria-describedby`; jsdom proves the wiring and axe proves
   the semantics, and neither proves a screen reader reads it. Step 4.
5. **The doors the gate cannot see.** Design spec §11 records that `withStaleGate` covers the one
   per-leaf dispatcher and nothing else: the plugin's own palette commands
   (**Set plan background**, **Create sample renovation project**) never enter that chain, and
   `notifyFault`'s raw ports sit outside it. The PBI asks that "unsafe menu, command, keyboard and
   pointer paths remain disabled"; step 4 is where that clause is checked against the doors that
   actually exist, and step 4a is where the one known hole is looked at rather than assumed.
6. **Whether `Open source note` opens the floor's note in Obsidian's workspace.** `FakeLeaf`
   records what `openFile` was asked for and runs no view factory. Step 7.
7. **Whether the strip's live region announces the message CHANGE.** The region is on the
   container and the row keeps its DOM node across a failed retry, which is what the suite pins;
   whether that reaches assistive technology once rather than twice or not at all needs a real
   screen reader. Steps 5 and 6.
8. **The wrap at a sidebar's width.** `plan-editor-stale-narrow` was captured at 460 px in a
   headless Chromium, not in Obsidian's own leaf chrome — and it found the residual step 4b
   exists to look at: the status bar CLIPS its hint text at that width, so the paused hint is not
   visible in a narrow leaf while the strip and the save-state label still say it.

## The fault setup

**Record which one you used, in the Runs table.** The step below names a primary and two
alternatives, and they are not interchangeable — which read fails decides whether you get the
stale state or something else:

- **Primary — break the PROJECT note's schema version.** `ProjectStore.hydrate` reads three
  things (the floor's plan note, its project note, then its zones) and any one of them failing is
  what sets `stale`. `CreateZoneCommand` reads the PLAN and never the project, so a project note
  this build refuses to parse leaves the room write free to land while the read-back after it
  cannot complete. The refusal is the fail-closed schema gate — a note from a build this one
  predates is refused rather than parsed — so setting `schema-version: 99` in the project note's
  frontmatter is a controlled, documented, one-keystroke-reversible fault.
- **Alternative — rename or lock the floor's own `Plan.md`.** This is the fault the PBI's own
  task describes, and it has a trap worth recording: applied BEFORE the draw it refuses the WRITE
  (`CreateZoneCommand` loads the plan first), so the room is never created and there is nothing
  stale — an ordinary refusal, not Scenario D. If you use it, apply it in the window between the
  Create press and the read-back, and expect that to be hard by hand.
- **Alternative — make the project note read-only at the OS.** A read-only file still READS, so
  this produces no failed read at all; it is listed because it is the obvious first guess and it
  is the wrong one.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could
discharge it as written. [[Smoke Test the Editor]]'s *The triage column* section defines
the five values and what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | Run **Open plan editor** from the command palette, pick the sample flat's Ground floor, and wait until the canvas draws its rooms | The Standard Plan View opens with **Select** pressed and nothing selected; there is **no** warning strip above the canvas, the status bar carries the pan hint and no *Editing paused* hint, and the save-state label does not read *refresh needed* | A stale flag that survives a mount, or a strip drawn from a store field rather than from the read that just succeeded. `ProjectStore.stale` is cleared by every successful hydration, so a strip here means the clearing is not on the success arm |
| 2 | `obsidian` | In a second leaf, open the sample project's `Project.md` and change its frontmatter `schema-version` value to `99`. Save it. Record this in the Runs table as the fault setup | The plan editor leaf is **unchanged** — same canvas, same viewport, same selection, no warning strip and no failure panel | A hand edit to a note reaching the editor's plain `hydrate()` and blanking a floor nobody asked to reload. `planChangeSource` deliberately does not subscribe to `ProjectIndexEntryChanged`, so a note edit is not a plan change; a failure panel here is that filter having been widened |
| 3 | `suite` | Press **Add**, choose **Room**, drag a rectangle on open canvas, type the name `Stale test`, and press **Create room** | A warning strip appears above the canvas reading *Warning — This plan could not be re-read after the last change; what you see may be out of date.* with two buttons, **Try again** and **Open source note**; the status bar's save state reads **Saved · refresh needed**; and the canvas still draws the rooms it had before the press, without the new one. Record what the Inspector shows — the Inspector refreshes through a different read from the canvas's, and which of the two it agrees with is the thing this step is finding out | The failure panel instead of the strip, which is the race step 2's own note names: the plain `onPlanChanged` hydrate calls `fail()` and blanks the floor, and only the store's ticket makes the later keep-on-failure read the one that settles. It also catches the opposite — a strip drawn over a canvas that ALSO redrew, which would mean the failed read wrote its own emptiness through |
| 4 | `obsidian` | With the strip up, open **Add**; then select a room and look at the Room Inspector; then open the **Layers** panel; then read the status bar. With a screen reader running, move focus onto the paused **Delete** button. This sample floor has no background, so **Set scale** reads disabled for that pre-existing reason rather than for the paused one — repeat this observation on a floor that HAS a reference plan, narrowed to a sidebar's width (~460 px), and read the paused reason rendered inline under **Set scale** in the Layers panel: no capture has ever shown this string, since the harness's own plan carries `background: null` | Every Add entry is dimmed and announces *Editing is paused: the floor could not be re-read after the last change. Retry from the warning above.*; the menu still opens and Escape still closes it; the Room Inspector's **Delete** and **Assign** are dimmed and announce the same sentence; the Layers panel's **Set scale** is disabled; the status bar carries *Editing paused until the floor is re-read* beside the pan hint. On the calibrated floor, the same sentence renders inline under **Set scale** and reads legibly in the narrowed panel. Nothing anywhere is `:disabled` — every paused control still takes focus | A paused control implemented as `:disabled`, which takes it out of the tab order and takes its own reason with it; a reason sentence rendered more than once or pointed at by nothing; the whole shared-reason mechanism failing to reach a screen reader, which no gate here can hear; and the inline paused reason under **Set scale** clipping or overlapping in a narrow panel, which no capture has ever been positioned to show |
| 4a | `obsidian` | With the strip still up, run **Set plan background** from the command palette and pick any image | The background is set. **This is the recorded hole, not a failure** — design spec §11 says so: that command is a plugin command, not a dispatch through this leaf's one gated dispatcher, so nothing pauses it. Record what it did | The hole silently closing or silently widening. A step that asserted this command was refused would be asserting a guarantee the code does not make; a step that ignored it would let the PBI's "unsafe menu and command paths" clause read as fully met |
| 4b | `obsidian` | Drag the leaf narrow enough to reach the rail layout, then read the status bar | Expected to FAIL as written: the status bar clips its hint text at a sidebar's width, so *Editing paused until the floor is re-read* is not visible there. The strip above the canvas and the **Saved · refresh needed** label still say it, which is why this is a residual rather than a defect of the pause. Record whether the clip is what you see | The residual being fixed without anyone noticing, and the residual being met cold by a later reader as a new defect. It belongs to the Active task [[Build full and compact editor status bars]] and was found by reading `plan-editor-stale-narrow` in the pinned Chromium |
| 5 | `obsidian` | Press **Undo** in the context bar | The `Stale test` room is removed from the vault — Undo is live while stale, because its inverse comes from the history's own record and not from the screen — and the strip's message changes to *Re-reading failed again; what you see may still be out of date.* The strip does not gain a second row, and no toast appears | Undo being gated with the writes it is not. The message move is the non-obvious half and it is expected: the inverse re-reads through the same keep-on-failure path, so the Undo is itself a failed retry, which is exactly why `stalePath.e2e.test.ts` drives its Try again pair BEFORE the Undo — the swap would otherwise have been true of a build whose button did nothing |
| 6 | `obsidian` | Press **Try again**, with the fault still in place | The button and the row read busy while the read is in flight and then settle; everything is still on screen — the same rooms, the same selection, the same strip row, still saying *Re-reading failed again* — and no second warning row and no toast appear. The room count in the vault does not change | A retry that replays the write. `refreshProjection` takes no command parameter at all, which `type-safety.test-d.ts` holds as a compile-time fact; what this step adds is that the vault agrees. It also catches a strip that unmounts and remounts its row, which would re-announce and lose the busy state |
| 7 | `obsidian` | Press **Open source note** | The floor's own `Plan.md` opens in the workspace. If it opens in this same leaf, the editor is gone — record which leaf it opened in | `openPlanNote` resolving the wrong entity, or the coalescing that makes a double click one tab collapsing the plan's note with the project's. It is deliberately BEFORE the healing retry: the strip's stale row is the only door to this button, and a successful retry retires the row |
| 8 | `obsidian` | Set the project note's `schema-version` back to its original value, return to the editor leaf, and press **Try again** | In one move: the strip disappears, the save state stops reading *refresh needed*, the status bar's paused hint goes, and every Add entry, **Delete**, **Assign** and **Set scale** is live again. The canvas now draws the five original rooms — the Undo's removal becomes visible here, because this is the first read that succeeded since it | A partial clear: any one of the strip, the label, the hint or a paused control surviving a successful read. They are all derived from one `stale` field, so a survivor means something cached it |
| 9 | `obsidian` | In the file explorer, look at the project's `Zones/` folder and open its `Geometry/<plan id>.rpgeo` | There is **no** note for `Stale test` and **no** object under its id in the sidecar; the folder holds exactly the five zones the sample seeds, and the `.rpgeo` exactly five objects. Nothing was written twice — the whole walk is one create and one delete | The successful write occurring more than once, which is the PBI's own first criterion for this journey, and an orphan sidecar object left behind by an Undo that removed only the note. Three retries ran between the create and this count; each of them reading rather than writing is what the count proves on disk |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from the design spec, the component source and its English copy — never from memory of either. Steps 3, 4 and 4b's layout clauses have been read once in a headless Chromium (`npm run harness-shot`'s `plan-editor-stale` at 1280 and `plan-editor-stale-narrow` at 460, both taken with the pinned browser), which is where the clipped status-bar hint step 4b names was found. Record the fault setup used, and the Obsidian version and platform. |

## Outcome

Written after the first walk: which steps passed, which fault setup produced Scenario D, and
anything only a live vault showed.
