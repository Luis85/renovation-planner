---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 40
sources:
  - SDD §52
  - SDD §59
  - SDD §63
  - SDD §64
  - SDD §90
  - SDD §91
status: Ready
---
# Assign an Asset and Delete a Referenced Zone

Design slice 10's end-to-end loop — `Zone Geometry → Area → Requirement → Cost` — and the
delete-with-references decision that slice 15 built two dialogs for and left without a
caller. This file is the **canonical procedure**;
`docs/tasks/10-assets-requirements-and-the-end-to-end-loop.md` records what the runs found
and points here.

Run [[Editor Walkthrough]] first, or at least its steps 1–2, so a plan is open with the
sample project's five zones on it. Run [[Calibrate a Plan]] too if you want the areas to
mean anything: an uncalibrated plan reports background pixels relabelled as millimetres, so
every figure below will be arithmetically consistent and physically absurd. **That is not a
failure of this case** — consistency is what it checks.

**There is no Asset creation UI in this slice, and that is deliberate** (slice 16 owns the
forms). `create-sample-project` seeds the catalog the picker reads. If the Assign picker is
empty, the sample project is what is missing, not the panel.

**What no gate here can see, and why a human is the instrument.** Every figure below is
asserted by 1600-odd automated tests against in-memory repositories, and the whole
Requirements panel is asserted against jsdom — which lays nothing out, resolves no `var()`
to a colour, and has no Obsidian keymap. So the three things this case is actually for are
**layout** (the panel is 17rem wide and holds two labelled inputs and four buttons per row;
no gate has ever seen a populated row rendered), **the dialog over a full canvas** (SDD
§64's decision panel is centred in a pane that is entirely canvas), and **persistence across
a real reload**.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could
discharge it as written. [[Smoke Test the Editor]]'s *The triage column* section defines
the five values and what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `suite` | Select a zone with the Select tool | The Inspector shows its name, its area, and a **Requirements** heading saying no requirements reference it yet | The panel existing at all, and its empty state reading as a sentence rather than a blank gap |
| 2 | `suite` | Look at the Assign asset control | A `<select>` lists the sample project's assets by name | The picker's options coming from `ListAssets` for THIS plan's project. An empty list with a seeded project means the query is wired to the wrong project id |
| 3 | `suite` | Pick one and press Assign | A row appears **without reselecting the zone or reopening the view**, showing the asset name, a quantity in the asset's unit and a cost in EUR | Slice 8's `withEditorStateRefresh` re-querying the panel in the same queued step as the write. A row that only appears after a reselect is the stale-panel defect this step exists for |
| 4 | `suite` | Read the quantity against the zone's area | It is the area × (1 + the asset's waste factor) — 10% on the seeded assets | The waste factor being applied at creation, without a subsequent zone edit. `AssignAssetCommand` recalculates inline precisely so this is true on the first render |
| 5 | `browser` | Look at the row's layout | Both override fields are labelled, each label sits on its own line above its input, and nothing is clipped by the panel's right edge | The width. jsdom lays nothing out and the browser harness draws this panel EMPTY, so this is the first time a populated row has been rendered anywhere |
| 6 | `suite` | Reshape the zone (slice 8's Draw/vertex handles) so its area changes, and commit | The still-open Inspector shows the **recalculated** quantity and cost, with no reselect | The `ZoneGeometryChanged → RequirementInvalidated → RequirementRecalculated` cascade running to completion INSIDE the dispatch, so one post-command re-query is enough |
| 7 | `suite` | Press Undo | The zone's geometry AND the requirement's figures both go back, as one history entry | The recalculation riding the zone command's undo rather than pushing an entry of its own |
| 8 | `browser` | Type a number into the cost override field and press Apply | The row shows your figure with an **Overridden** badge, and the calculated figure is still visible beside it | §52's two independently overridable values. A badge with the calculated figure hidden is the half-implementation |
| 9 | `suite` | Press Undo | The override is gone and the calculated figure is back, unbadged | The override adapter restoring the whole pre-edit requirement, not just the one field |
| 10 | `suite` | Re-apply the override, then press **Reset to calculated** | The badge disappears | `null` being a VALUE in this seam rather than an absence |
| 11 | `suite` | Press Undo once more | Your overridden figure comes **back** | The one case an adapter treating `null` as "nothing to restore" fails while passing steps 9 and 10 |
| 12 | `obsidian` | Disable and re-enable the plugin, reopen the plan, reselect the zone | The requirement is still there with the same figures, and an override you left in place is still badged | The Markdown round trip — including the decimal, which must not have become a YAML float |
| 13 | `suite` | Press the Inspector's **Delete** on a zone with at least one requirement | A dialog appears listing `Requirements: <n>` with four buttons: Cancel, Remove references, Reassign, Delete anyway | Slice 15's dialog finally having a caller. The count comes from `ListRequirementsReferencing`; a dialog reading 0 over a zone with rows means the query is not wired. **The button reads "Delete", not "Delete zone"** — the Add Room increment (2026-09-04) took the noun out of `editor.inspector.delete-zone` rather than saying "room", because `RoomInspector` renders for any `ZoneType` and the Inspector around the button already names the type. The KEY is unchanged |
| 14 | `browser` | Look at what the dialog covers | The question is answerable **from the dialog's own words** — it names the zone and the count without needing the panel behind it | The content rule slice 15 states: the panel is centred in a pane full of canvas, so whatever it hides must not be what the question is about |
| 15 | `suite` | Press Cancel | The dialog closes; the zone and every requirement are untouched | A cancel that dispatched anything |
| 16 | `suite` | Delete again, choose **Delete anyway** | The zone is gone; the requirement notes survive in `Requirements/` with `recalculation-status: stale` | PRD §64's fourth action. Note that this slice builds **no surface that lists them** — check the vault files, not the plugin |
| 17 | `suite` | Press Undo | The zone comes back **and** its requirements go back to `current` with their old figures | The compensated multi-entity undo. Restoring the zone alone would leave the requirements stale and is the defect this step exists for |
| 18 | `suite` | Delete again, choose **Reassign**, and pick another zone | A second dialog lists the project's other zones; picking one deletes the first zone and repoints its requirements at the target, recalculated against the TARGET's area | The Reassign branch opening sequentially rather than stacking, and the recalculation the repoint owes |
| 19 | `suite` | Delete a zone that nothing references | It is deleted with **no dialog at all** | The zero branch dispatching the absent-resolution form. A dialog here means a zero count is being turned into a resolution |
| 20 | `obsidian` | With the plan open in **two leaves**, delete a referenced zone in one | The other leaf stops drawing it | `ZoneDeleted` reaching every leaf showing that plan |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from the automated suite and the design, not an observation |

Fill this table in on the first walkthrough, and treat anything it finds as a defect of
slice 10 rather than of this case — with a test that fails without the fix, per the suite's
own rule.
