---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 100
sources:
  - Plan editor trust path design spec §8 (what reload pins)
  - Plan editor trust path design spec §2.10 (no schema change, no new write path)
  - M00-kitchen-selected-overview
  - VS-09, WP7 and Scenario C
status: Ready
---

# Reload a room

The other half of checkpoint C3: a room the renovator made is the same room when they come back.
Both reopen paths — closing the leaf and reopening the floor, and restarting Obsidian and letting
the workspace restore — reconstruct the room from its own Markdown note and the plan's geometry
sidecar, under one identity, with the area derived from the four points rather than stored beside
them. Nothing is written merely to display it, and no second note or sidecar object appears.
`docs/superpowers/specs/2026-09-04-plan-editor-trust-path-design.md` is the design and
`docs/superpowers/plans/2026-09-04-plan-editor-trust-path.md` the plan this case's wave belongs to.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a
project with a floor open in the Standard Plan View. **Create sample renovation project** seeds
one.

## Why a human is the only instrument for five of these

`tests/infrastructure/persistence/editorRoundTrip.test.ts` writes a room through the REAL
`CreateZoneCommand` and reads it back over the same `FakeVault` through a fresh index, a fresh
echo window and a fresh geometry store, which is as close to a reopen as an in-process test gets;
`tests/presentation/views/planEditorView.test.ts`'s two reopen cases mount `PlanEditorView` twice
over real in-memory repositories. Five things sit outside both:

1. **A restart is a new PROCESS, and neither test is one.** Both model a reopen with fresh
   objects over a vault that never left memory. Obsidian's own workspace restoration, its
   `MetadataCache` rebuilding from disk, and the plugin's index scan running from `onLayoutReady`
   are the three mechanisms this case exists for — and the last of them has already shipped one
   defect this suite caught (a restored Plan Editor saying *This plan no longer exists*, because
   leaves restore BEFORE the scan they hydrate against).
2. **The parse lag after a write.** `FakeVault.pendingParse` models it and the round-trip case has
   to drain the queue before its reopen scan; a real `MetadataCache` drains on its own schedule,
   and whether a reopen moments after a create reads the note or the echo of it is a question only
   a vault answers. Step 3.
3. **Whether reading writes.** "No write merely to display it" is a claim about the note's own
   `revision` frontmatter and about the save-state badge, and both are cheap to check on disk and
   impossible to check convincingly in a fixture that never left the process. Step 4.
4. **Whether a duplicate appears.** A second note or a second sidecar object under one id is
   exactly what a reopen that INSERTS where it should have read would produce, and it is visible
   only in the file explorer. Step 7.
5. **The derived area, read twice by an eye.** The Inspector prints it from `Zone.area()` over the
   stored points; the suite compares two numbers it computed the same way. Steps 1, 3 and 6 are
   three readings of one figure with a process boundary between the last two.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could
discharge it as written. [[Smoke Test the Editor]]'s *The triage column* section defines
the five values and what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `suite` | In the open floor, press **Add**, choose **Room**, drag a rectangle, name it `Reload test` and press **Create room**. Write down the name, the **Type**, the **Floor** and the **Area** exactly as the Room Inspector prints them | The room is created, selected and drawn, and the Inspector shows those four values | A creation that reports success without a complete room — this step is the baseline the two reopens are compared against, so its values have to be recorded rather than remembered |
| 2 | `obsidian` | In the file explorer, open the new note under the project's `Zones/` folder and write down its frontmatter `id` and `revision`. Then open `Geometry/<plan id>.rpgeo` and find the object under that same id | The note carries `zone-type: room`, the recorded id and a `revision`; the sidecar holds exactly one object under that id with four points. The note carries no `area`, `width` or `depth` key — the area is derived, never stored | Metadata and geometry drifting apart at the moment of writing, which every later comparison would then inherit; and an area persisted beside the points, which would let the two disagree after any edit |
| 3 | `obsidian` | Close the plan editor leaf. Run **Open plan editor** again and pick the same floor. Select `Reload test` | The same room is drawn and selects into the Inspector with the same name, Type, Floor and **Area** as step 1, and the note under `Zones/` still carries the id from step 2 | A reopen that reads a fixture rather than the vault, and the parse lag serving the plugin's own memory of its write instead of what is on disk — a distinction that only exists across a real `MetadataCache` |
| 4 | `obsidian` | Without touching anything else, re-open the room's note and read its `revision` again; look at the status bar | The `revision` is the **same** number step 2 recorded, and the save-state indicator has not moved — no *Saving*, no *Saved* transition, no badge | A read path that writes. Displaying a room must not bump its revision: a reopen that saves is a reopen that would eventually conflict with a synced copy of the same note, and it would do so silently |
| 5 | `obsidian` | Quit Obsidian entirely and start it again. Let the workspace restore on its own — do not run **Open plan editor** | The plan editor leaf comes back by itself, on the same floor, drawing its rooms. It opens in **Select** with nothing selected — a selection is not expected to survive a restart, and a room is | The restored-leaf-before-the-scan defect this suite has already caught once: leaves restore before `onLayoutReady`, so a view that acted on the empty index it first asked would say the plan is gone. It also catches a restore that opens in some other tool, which would put a destructive mode under the first click |
| 6 | `obsidian` | Select `Reload test` again and compare all four values with step 1 | Name, Type, Floor and **Area** are identical, and the id in the note is the one step 2 recorded | An identity change hidden behind visual similarity — two rooms of the same name and shape look the same on a canvas, and only the id says whether this is the room that was made |
| 7 | `obsidian` | Look at the project's `Zones/` folder and at `Geometry/<plan id>.rpgeo` again | There is exactly ONE note for `Reload test` and exactly ONE object under its id in the sidecar. No `Reload test 1`, no second object, and no notice about a write appeared during either reopen | A reopen taking an INSERT where an update was owed, which is what a duplicate note is; and a geometry store that re-writes the sidecar on read, which a second object under one id would show |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from the design spec, the persistence source and the Inspector's own English copy — never from memory of either. Record the Obsidian version, the platform and the date; step 5 is the only step in this suite that requires a full restart, so a run that skipped it is a run of six steps. |

## Outcome

Written after the first walk: which steps passed, and anything only a real restart showed.
