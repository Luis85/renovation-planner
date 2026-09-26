---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 83
sources:
  - SDD §12
  - ADR-0015
  - C11
  - C12
  - AD13-R1
status: Ready
---
# Take an asset from the library into a plan

The asset designer expansion's WORKFLOW half, walked end to end in a real vault: the impact
scope the library draws before a definition is diverged (**Used in plans**, AD13 item 3, C11's
*"show impact scope"*); **Duplicate as new asset** and the proof C11 actually asks for, that the
original and everything placing it are untouched; the designer's forward door, **Use in plan**,
which arms placement with this asset on arrival in the Plan Editor; **Open in designer** back the
other way from a placed asset; and the platform gate C12 insists on preserving, which keeps both
surfaces' commands out of a mobile palette.

[[Browse the asset library]] and [[Open the Asset Library]] own the catalogue's shelves, its
search and its lifecycle, and [[Place an asset on a plan]] owns placement itself. This file is
about the three DOORS between the three surfaces and about nothing either of those already
walks.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and:

- a project with at least TWO plans, one of them holding **two placements of the same asset** —
  call it `Oven` — and the other holding one placement of it, both made by [[Place an asset on a
  plan]]'s own procedure;
- a SECOND asset, `Shelf`, in the library and placed on no plan at all;
- a THIRD asset with no footprint (created from **New asset** with Width and Depth left blank),
  and a FOURTH traced over `editor-background-png-test.png` and never calibrated;
- a device that runs Obsidian's MOBILE build, or Obsidian's mobile emulation, for steps 24 to 27.

**Why a human still matters here.** Four things put this material out of every gate's reach.
**RETRACTED 2026-09-26 (AD18-R28).** A fifth used to open this list: *"'A duplicate does not
change the original' is a claim about the VAULT, not about a component. `DuplicateAssetCommand`
gets it by touching no plan, and the panel's own sentence asserts it to the user. The only
instrument that can confirm it is opening the plan afterwards and looking at what is drawn there
— step 10."* That was true when written and stopped being true once W24-A's
`assetHandoffMore.e2e.ts` *shows no plan scope until Duplicate, moves no placement by duplicating,
and counts a plan it cannot read* began comparing every plan's `.rpgeo` file byte-for-byte before
and after Duplicate (`expect(planSidecars(vault)).toEqual(before)`) and asserting every
placement's `assetId` stayed the original's — an automated instrument that opens the plan
afterwards for you. Step 10 is `e2e` now, below, and nothing left in it needs a human.

- **The hand-off crosses two views and a modal.** `FakeLeaf` records what `setViewState` was
  asked for and runs no view factory, so the suite can see that an origin carrying an `assetId`
  was built and never that a real Plan Editor arrived, armed, and placed the right object.
- **The mobile gate has two halves and only one of them is a command.** `Platform.isMobile`
  keeps both commands out of the palette; the VIEWS' own refusals are what answer a leaf
  restored from a workspace layout, where no command runs at all. A synced layout is the only
  way to reach the second.
- **One destination, two labels.** The library's door to the designer reads **Edit shape**
  (`view.asset-library.open-designer`) and the plan's reads **Open in designer**
  (`editor.asset.open-designer`). Whether that reads as two different things is a judgement —
  step 23.
- **The designer's own usage scope does not exist yet.** `grep -rn "listPlansUsingAsset\|
  UsageScope\|used-in" src/presentation/designer/` prints no lines. Ruling AD13-R1 says the
  criterion is not met until it lands, and step 28 is the step that records the gap rather than
  a step that would pass over it.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could discharge it as
written. [[Smoke Test the Editor]]'s *The triage column* section defines the five values and
what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `e2e` | Run `Open asset library` from the command palette and select `Oven` | The inspector draws its name, **Used in**, its fields, its shape and a row of actions — and there is **no "Used in plans" section anywhere on it yet** | Where the scope actually lives. `AssetUsageScope` is drawn INSIDE `AssetUsageDuplicate`, which the inspector draws only once Duplicate has been pressed, so the plan scope is a property of that gesture rather than of the selection. Ruling AD13-R1 records this asymmetry as an accident of which card reached which file, and step 28 is its other end |
| 2 | `suite` | Press **Duplicate** | A panel appears headed "Duplicate as new asset", with a sentence reading "The copy is a new definition with its own geometry. Plans that place this asset keep the original.", a field labelled "Name of the copy" prefilled `Oven (copy)`, and two buttons, **Create copy** and **Cancel** | The prefill, which is what stops the submit needing a `:disabled`: an emptied name reaches `Asset.create` and comes back as a refusal the panel renders, where a dead button would tell the user nothing. `assetUsageDuplicate.test.ts` "is drawn for a readable asset and opens a panel prefilled with a copy name" |
| 3 | `suite` | Read the **Used in plans** section inside that panel | A heading "Used in plans" and one row per plan, each reading *plan name* (*project name*) — *n* placement(s): the plan holding two reads "2 placement(s)" and the other "1 placement(s)" | The count being per PLAN rather than a total, so the scope says where the blast radius is and not only how big it is. `assetUsageDuplicate.test.ts` "shows which plans place the definition before anything is dispatched". **The project in parentheses is NEW as of 2026-09-22 (W19-B) and this row's expectation was rewritten with it** — before that the row named the plan alone, so two plans both called `Kitchen` in different projects drew as two identical lines. A walker following the old text would report this pass as a failure, which is the hazard this pass has already paid for once. **Read the guarantee narrowly**: the project NAME disambiguates two differently-named projects and nothing more, so two `Kitchen` plans in two projects that are BOTH named `Flat renovation` still draw identically — `ListPlansUsingAsset.ts`'s own header names that residual arm, and the neighbouring `withPathsWhereAmbiguous` is what escalates to a path for it |
| 4 | `suite` | Cancel, select `Shelf`, and press Duplicate | The Used in plans section reads "No plan places this asset" — not an empty list, and not a refusal | The difference between *nobody uses this* and *I could not find out who uses this*, which is the difference between a safe change and a blind one. **This is the one arm of this section with no automated case:** `assetUsageDuplicate.test.ts` drives loading, refused, ready-with-rows and ready-but-incomplete, and not the empty ready answer |
| 5 | `e2e` | Break one of the two plan notes so it cannot be parsed (corrupt its frontmatter in another editor), reopen the library, select `Oven` and press Duplicate | The list still names the plan it COULD read, and a further line reads "1 note(s) could not be read, so this list may be incomplete" | C08's *"a failed read is not 'asset missing'"* at the one surface whose whole job is to state a blast radius. Folding an incomplete answer into either a refusal or a clean scope would make a partial answer look total. `assetUsageDuplicate.test.ts` "says the scope is incomplete when some plans could not be read" |
| 6 | `e2e` | Repair the note. Then quit and restart Obsidian, and press Duplicate on `Oven` as fast as you can after the window appears — before the initial index scan has finished | The section reads "The plans that place this asset could not be read, so the scope below is unknown." rather than "No plan places this asset" | The read being GATED on `indexScanCompleted()`. Both repositories the query walks enumerate through the index and answer `ok` over an EMPTY one, so the ungated answer before the scan is *no plan places this asset* — over a vault full of plans that place it. Only a real startup can produce the window. `assetUsageDuplicate.test.ts` "says the scope is unknown rather than empty when the index has not been scanned" drives the gate; nothing can drive the timing |
| 7 | `suite` | With the panel open, look at the action row above it | The **Duplicate** button is gone while its own panel is open | One gesture being unable to open two panels, and by withdrawing the control rather than disabling it. `assetUsageDuplicate.test.ts` "is withdrawn while its own panel is open, so one gesture cannot open two" |
| 8 | `suite` | Press **Cancel** | The panel disappears, the Duplicate button returns, and nothing at all is written — no new note, no new row on the shelves | AD13 criterion 4's *"no asset ID, reference or quantity link points to an orphan after cancel"*, true here by construction rather than by cleanup. `assetUsageDuplicate.test.ts` "dispatches nothing on cancel and leaves the panel gone" |
| 9 | `e2e` | Press Duplicate again on `Oven` and press **Create copy** with the prefilled name | A note named `Oven (copy)` appears in the library folder in Obsidian's file explorer, a row for it joins the shelves, the panel closes, and the inspector is still showing `Oven` — the selection did not move to the copy | The copy reaching the catalogue through the existing change-and-hydrate path. Selecting the new id before that refresh lands would resolve against a listing that has never seen it and draw the panel's *asset is gone* state over a duplicate that worked. `assetUsageDuplicate.test.ts` "dispatches the real command with the subject and the typed name" and "closes on success, leaving the selection where it was" (the panel-closes clause; the e2e table below covers the note and the selection). The shelf row itself was UNRECORDED until Task 8's `tests/presentation/library/assetLibraryDuplicateRow.test.ts` *adds the copy's row to the shelves once the catalogue change is announced* — the existing `assetLibraryRootDoors.test.ts` re-hydrate cases only ever counted a call, never read a row |
| 10 | `e2e` | Open the plan that held two placements of `Oven`, select each placement, and read its Inspector; then open `Oven` in the designer | Both placements still name `Oven`, at the same size and the same position; neither is `Oven (copy)`; no third placement has appeared anywhere; and `Oven`'s own geometry in the designer is exactly what it was | **The step this half of the case exists for.** C11's *"a duplicate does not change the original"*, which the panel ASSERTS to the user in its own sentence. `DuplicateAssetCommand` earns it by touching no plan. **No longer a step only a person can confirm**: `assetHandoffMore.e2e.ts` *shows no plan scope until Duplicate, moves no placement by duplicating, and counts a plan it cannot read* compares every plan's `.rpgeo` file byte-for-byte before and after Duplicate, and `assetHandoff.e2e.ts` *duplicates an asset into a new note without touching the original or its placements* reads `Oven`'s own sidecar in the designer back against the original |
| 11 | `suite` | Reopen the Duplicate panel, then click a different asset's row while it is open | The panel closes rather than staying open under a new name; reopening it prefills the NEW asset's name | A name prefilled from the previous asset being carried into a note for this one. `assetUsageDuplicate.test.ts` "closes when the selection moves, so no name is carried from the previous asset" |
| 12 | `suite` | Open `Oven` in the designer (from the library's own action, or from the Renovation project view) and look at the Inspector's asset block | A button reads exactly "Use in plan", beside the library door | AD13's forward door, drawn beside the way back because the two are this surface's only navigations. `designerUsePlan.test.ts` "is drawn, and labelled, for a placeable asset behind a bound door" **AMENDED 2026-09-20 (AD18 item 2): both buttons are in the designer’s HEADER now, not in the Inspector’s asset block.** Ruling AD18-R1 moved the asset name to a restrained header and both doors went with it, so that one gesture is not drawn in two places. Look at the header bar across the top of the leaf. The pairing the step is about — the way forward beside the way back — is preserved and is the reason they moved together. **AMENDED AGAIN 2026-09-23 (AD18-R16 Task 2): the library door's own text changed to "← Back to library"** (an arrow-left icon before the words), and below a sidebar width (35rem) the words clip off-screen and only the icon shows — the button's accessible name is unchanged either way. The pairing itself did not move again |
| 13 | `suite` | Open the designer on the THIRD asset (no footprint) and on the FOURTH (traced over an uncalibrated sheet) | Neither draws a **Use in plan** button at all — not a dimmed one | `assetShapeAnswer`'s placeable arm asked of this surface's own DTO, so the button is absent exactly where placement would refuse with `editor.asset.no-shape` or `editor.asset.unscaled`. Both refused states are one gesture from placeable — Set dimensions, or calibrate — and both of those controls are on the same panel. `designerUsePlan.test.ts` drives both states as an `it.each` of "an asset with no footprint" and "a footprint still in background pixels" |
| 14 | `e2e` | With exactly ONE Plan Editor open anywhere in the workspace, press **Use in plan** on `Oven` | No picker appears at all. That Plan Editor comes forward with a banner reading "Click the plan to place a copy; near a wall it turns to face the room. Esc stops placing." — and clicking the plan places an `Oven`, not whatever the Add menu last used | The whole channel, end to end: the closure-scoped slot in `assetDesignerUsePlan`, the `{ planId, assetId }` origin, and `editorArrival`'s asset arm arming the placement tool through the same door the Add menu's picker arms it through. `vue-tsc` cannot see a dropped argument here — `() => void` is assignable to `(assetId: string) => void`. `tests/plugin/assetDesignerUsePlan.test.ts` "continues into the one Plan Editor already open, asking nothing" covers the arrival; the "not whatever the Add menu last used" half was UNRECORDED until Task 8's `tests/presentation/editor/editorArrivalAssetOverride.test.ts` *replaces an asset the Add menu already armed with the one the hand-off names* armed the Add menu first and asserted the hand-off wins |
| 15 | `e2e` | Open a SECOND Plan Editor on a different plan, then press Use in plan again | A fuzzy picker asks which plan; choosing one opens it with the same armed banner and the same asset | Two open plans being genuinely ambiguous where one is not. `tests/plugin/assetDesignerUsePlan.test.ts` "asks which plan when two different ones are open" and "treats two leaves showing the same plan as that one plan" cover the picker; "choosing one opens it with the same armed banner and the same asset" was UNRECORDED until Task 8's `tests/plugin/assetDesignerUsePlanChoice.test.ts` *reveals the plan chosen — not the other one — armed with the same asset*, which wires two already-open leaves, chooses the second, and asserts only that leaf's state carries the hand-off's `{ planId, assetId }` origin |
| 16 | `e2e` | Close every Plan Editor, press Use in plan, and dismiss the picker with Escape | Nothing opens and nothing is armed; pressing Use in plan again asks the same question rather than going quiet | The slot being cleared on read, so a dismissed pick cannot leave an asset armed for whatever opens next. "Nothing opens" is the e2e table below (`assetHandoff.e2e.ts`'s dismiss-then-recheck); "asks again" is `tests/plugin/assetDesignerUsePlan.test.ts` "asks again after a picker is dismissed", confirmed by the same e2e re-press. **Correction**: this row used to also cite that file's *creates and reveals nothing when the pick is dismissed* for "nothing opens" — its body never dismisses anything, it asserts state while the picker is still open, so that citation was wrong (independent review, `.superpowers/sdd/audit/review.md`). "Nothing is armed" — that an already-open Plan Editor stays unarmed after a dismissal — was UNRECORDED until Task 8's `arms neither already-open Plan Editor when the picker is dismissed` (same new file as step 15), which wires two open leaves, dismisses, and asserts both leaves' `.state` are the exact pre-dismissal object references |
| 17 | `e2e` | Double-click **Use in plan** as fast as you can | Exactly one picker opens, or exactly one Plan Editor comes forward — never two | The in-flight guard, which is the same class of defect as the double ribbon click that once gave two tabs of the singleton view. `tests/plugin/assetDesignerUsePlan.test.ts` "opens one picker for two presses in the same tick" |
| 18 | `e2e` | In a vault that has assets but no plans at all, press Use in plan | A notice reads "This vault has no renovation plans yet." and no empty picker opens | `open-plan-editor`'s own lesson applied here: a picker over nothing is a dead end, and a sentence naming the missing thing is not. `tests/plugin/assetDesignerUsePlan.test.ts` "says so rather than opening an empty picker, in a vault with no plans" — and the notice's appearance is the half no harness can draw, since the vendored `obsidian.css` declares no `.notice` rule at all |
| 19 | `e2e` | After placing through the hand-off, open the Renovation project view | The **Continue** group now offers that project and that plan | The hand-off recording a Continue context for a plan it picked, so the workflow's last step feeds the launcher the next session starts from. `tests/plugin/assetDesignerUsePlan.test.ts` "records the Continue context for the plan it picked" and "records nothing when the reveal fails" |
| 20 | `e2e` | On the plan, select one of the `Oven` placements and read its Inspector | It shows the placement's size as *width* × *depth* m and offers **Open in designer**, **Replace asset…** and **Add as material** | The door back, at the surface where a user notices the shape is wrong. This is also the label the ruling AD13-R1 had to be corrected against: its first version called it "Edit shared asset", a string `grep` finds nowhere in `src/`. Only the designer door was ever named in this case's own Automated table (below); the size and the other two doors were UNRECORDED — all three are in fact `tests/presentation/editor/assetPlacementInspector.test.ts`: *shows dimensions, opens the designer and hides the outline editor* (the size), *explains a missing asset and replaces it in one undoable step* (Replace asset…) and *adds a placement-count material for the room pre-filled, counting the placement* (Add as material) |
| 21 | `e2e` | Press **Open in designer** | A designer leaf opens on `Oven` with its footprint drawn | The two-hop round trip — library to plan to designer — closing on the same definition it started from. The leaf's own id was always covered by `assetHandoff.e2e.ts`; "with its footprint drawn" was UNRECORDED until Task 8's `tests/plugin/assetDesignerHandoffFootprint.test.ts` *draws the asset's footprint on the canvas the hand-off's designer leaf opens*, which drives the real `AssetDesignerView` lifecycle (`setState` then `onOpen`, the same two calls the hand-off's activation makes) and reads the Konva scene for `footprintLayer.ts`'s own node |
| 22 | `e2e` | Go back to the plan, right-click the same placement on the canvas, and press **Open in designer** from the menu; then do it twice in quick succession | The menu offers it under the plans group, it opens the SAME single designer leaf the Inspector button opened rather than a second one, and two presses in one tick still give exactly one leaf | CLAUDE.md's "one action, every input": there are two doors to this destination and both must call the one reveal function, which holds an in-flight map keyed by the view type plus the state that would be set. `tests/plugin/assetDesignerCommands.test.ts` "opens one leaf for two activations of the same asset in the same tick" and "opens two leaves for two different assets" cover the shared-leaf and double-press halves; "under the plans group" was UNRECORDED until Task 8's `tests/presentation/editor/canvasMenuAssetDesignerGroup.test.ts` *lists "Open in designer" first among the canvas menu's items, under the plans group*, which reads `CanvasMenuList`'s real composed `items` prop rather than the DOM text and asserts `group: 'plans'` directly |
| 23 | `judgement` | Put the library inspector and a selected plan placement side by side and read the two buttons that open the designer: **Edit shape** in the library, **Open in designer** on the plan | Record how it reads. Both open the same surface on the same definition, under two different names. There is no pass condition and no instrument that can supply one | Exactly the shape [[Browse the asset library]] already records as an expected failure one surface over — *a category named two ways on two surfaces of one pane*. Two names for one destination is either a useful distinction (one edits geometry, one navigates) or a pair that drifted; nothing but a reader can say which |
| 24 | `e2e` | On the MOBILE device, open the command palette and search for `asset` | Neither **Open asset library** nor **Open asset designer** is listed | C12's *"preserve the actual platform gate until a separate mobile decision is accepted"*, and `Platform.isMobile` being exactly the kind of precondition a `checkCallback` may take — nothing a user does in a vault can change it, so gating on it hides the command only where the surface behind it would refuse anyway. `tests/plugin/assetDesignerCommands.test.ts` "stays out of the palette on mobile, opening no picker" and `tests/plugin/assetLibraryCommandGate.test.ts` "hides from the palette on mobile" |
| 25 | `e2e` | On the same device, open the Renovation project view and press its **Open library** button | A leaf opens saying this surface needs a desktop, rather than a blank pane or a broken one | The deliberately UNGATED half. `AssetLibraryView.onOpen`'s own refusal is the load-bearing one — that button is ungated by decision, and making it disappear is the project view's own change — so the honest outcome is a leaf that refuses rather than a button that does nothing. `tests/presentation/library/assetLibraryMobile.test.ts` drives the view's refusal; nothing drives that button reaching it |
| 26 | `e2e` | Leave an Asset designer leaf and an Asset library leaf open on the desktop, sync the vault, and open it on the mobile device | Both restored leaves draw the desktop-only refusal rather than mounting anything | The half no command can answer. Obsidian restores leaves from its own workspace layout with no command running at all, which is why the refusal lives in `sync`/`onOpen` as well as in the two `checkCallback`s — and `sync` is reached by `setState` as well as by `onOpen` |
| 27 | `e2e` | Back on the desktop, open the command palette and search `asset` again | Both commands are listed, named exactly "Open asset library" and "Open asset designer" | A gate that hid the commands everywhere. `tests/plugin/assetDesignerCommands.test.ts` "appears in the palette in a vault with no assets" and "carries an unprefixed id and a translated name"; `tests/plugin/assetLibraryCommandGate.test.ts` "answers the palette's question off mobile without opening anything" |
| 28 | `suite` | In the designer, with `Oven` open, read the Inspector's asset block from top to bottom | There is **nothing** naming the plans that place this asset — not a list, not a count, not a loading line. **This is a recorded gap, not a defect to report** | Ruling AD13-R1: the designer is where a shared definition is actually EDITED and it discloses nothing, while the library's scope stands in front of Duplicate — the one gesture that provably changes nothing downstream. Criterion 3 is NOT met until a scope lands here, and this row exists so that the next walkthrough reports the gap as still open rather than rediscovering it. `grep -rn "listPlansUsingAsset\|UsageScope\|used-in" src/presentation/designer/` printing no lines is the measurement |

## Deliberately NOT checked

- **Placement itself** — the banner, the wall snap, the facing turn, Escape, the form's metres.
  [[Place an asset on a plan]] owns all of it, and step 14 stops at *a copy of the right asset
  appeared where I clicked*.
- **The library's shelves, search, marks and widths.** [[Browse the asset library]] and
  [[Open the Asset Library]] own those, including the five expected failures the first of them
  already predicts.
- **Deleting an asset that is in use.** That is the inspector's `Delete` and its refusal reason,
  which is the `Used in` (requirements) section's subject rather than `Used in plans`'.
- **Whether a duplicate's GEOMETRY is a deep copy.** `duplicateAsset.test.ts` owns that; step 10
  checks the consequence a user can see, which is that nothing downstream moved.
- **A designer-side usage scope.** It does not exist at this commit — step 28 records the
  absence. When it lands it will be a second consumer of the same `ListPlansUsingAsset` with
  `AssetUsageScope`'s own four states, and the steps for it belong to the change that builds it.
- **Colour contrast and hit-target size.** The standing exception every case in this suite
  carries.

## Automated in Obsidian

**Added 2026-09-25.** `tests/e2e/assetHandoff.e2e.ts` — the desktop leg for the doors, the
mobile-emulation leg for the gate.

| Step | Clause | Discharged by |
| --- | --- | --- |
| 9 | a note `Oven (copy)` appears in the library folder; the selection stays on Oven | *duplicates an asset into a new note without touching the original or its placements* |
| 9 | the panel closes | `assetUsageDuplicate.test.ts` *closes on success, leaving the selection where it was* — **correction**: this row used to cite the e2e case above for this clause too, but `AssetInspector.vue` always renders `.rp-al-inspector__name` regardless of `duplicating`, so that case's final name check proves nothing about the panel (OVERCLAIM, `.superpowers/sdd/audit/take.md`) |
| 10 | Oven's own geometry is exactly what it was | *duplicates an asset into a new note without touching the original or its placements* (same e2e case as the row above the panel-closes split) — the original's `.rpgeo` compared whole; the copy's shape equals it under the copy's id |
| 10 | both placements still name Oven, at the same size and position | none — this vault places nothing before duplicating |
| 14 | no picker; the one Plan Editor comes forward with the banner; a click places THIS asset | *arms the one open plan without asking, asks between two, and records where it went* — the plan's own `.rpgeo` names the asset after the click |
| 15 | two open plans: a picker naming both | same case |
| 16 | Escape arms nothing; the next press asks again | same case |
| 17 | two presses in one tick open exactly one picker | same case |
| 18 | no plans: "This vault has no renovation plans yet." and no empty picker | *says so rather than opening an empty picker, in a vault with assets and no plans* |
| 19 | the Continue group offers that project and that plan | *arms the one open plan…* |
| 20 | a selected placement's Inspector offers Open in designer | *opens the designer from a placed asset, and gives two fast presses one leaf* |
| 21 | it opens a designer leaf on Oven | same case |
| 22 | two presses in one tick give one leaf | same case, through the Inspector button; the canvas menu is not driven |
| 24 | neither command is listed on mobile | *keeps both commands out of the palette on mobile* — each command's `checkCallback(true)` answers false |
| 25 | the project view's library button opens a leaf that refuses | *opens a library leaf that refuses, from the project view button, rather than nothing* |
| 27 | both commands listed on the desktop, by name | *lists both commands in the palette on the desktop* |

**Added 2026-09-26 (Task 8), closing the D clauses this case's audit found
(`.superpowers/sdd/audit/take.md`).** All six are vitests, not e2e — each still discharges its
step only alongside an e2e clause named above or below, which is why the step's own tier stays
`e2e` rather than dropping to `suite`.

| Step | Clause | Discharged by |
| --- | --- | --- |
| 9 | a row for it joins the shelves | `tests/presentation/library/assetLibraryDuplicateRow.test.ts` *adds the copy's row to the shelves once the catalogue change is announced* — drives the real `AssetLibraryRoot` change subscription and reads the DOM row, where the pre-existing `assetLibraryRootDoors.test.ts` re-hydrate cases only ever counted a call |
| 14 | places `Oven`, not whatever the Add menu last used | `tests/presentation/editor/editorArrivalAssetOverride.test.ts` *replaces an asset the Add menu already armed with the one the hand-off names* |
| 15 | choosing one opens it, with the same armed banner and the same asset | `tests/plugin/assetDesignerUsePlanChoice.test.ts` *reveals the plan chosen — not the other one — armed with the same asset* |
| 16 | nothing is armed | same file, *arms neither already-open Plan Editor when the picker is dismissed* |
| 20 | shows the placement's size, offers Replace asset…, offers Add as material | `tests/presentation/editor/assetPlacementInspector.test.ts` — pre-existing, not new this round; *shows dimensions, opens the designer and hides the outline editor*, *explains a missing asset and replaces it in one undoable step*, *adds a placement-count material for the room pre-filled, counting the placement*. These three were UNRECORDED here even though the test already existed |
| 21 | with its footprint drawn | `tests/plugin/assetDesignerHandoffFootprint.test.ts` *draws the asset's footprint on the canvas the hand-off's designer leaf opens* |

**Added later on 2026-09-25 (W24-A).** `tests/e2e/assetHandoffMore.e2e.ts`. Each case was watched red
against a one-clause mutation of `src/` except step 10's, which holds by construction
(`DuplicateAssetCommand` has no plan port) and whose one planned perturbation was refused.

| Step | Clause | Discharged by |
| --- | --- | --- |
| 1 | the inspector draws name, Used in, fields, shape and actions, and no "Used in plans" before Duplicate | *shows no plan scope until Duplicate, moves no placement by duplicating, and counts a plan it cannot read* |
| 5 | the list still names the readable plan and says "1 note(s) could not be read, so this list may be incomplete" | same case — a plan note given `layers: 'broken'` through `processFrontMatter` |
| 6 | pre-scan, Duplicate reads "…scope below is unknown." | none — **unreachable** through a plugin load: Duplicate exists only once the catalogue lists the asset, which is after the scan (first drawn ~103 ms in, polled every frame) |
| 6 | never "No plan places this asset" over a vault that places it | *offers Duplicate only once the scan has landed after a load, so the scope is never a confident empty* |
| 10 | both placements still name Oven, at the same size and position; no third placement | *shows no plan scope until Duplicate…* — every plan `.rpgeo` byte-identical after Create copy; not watched red (see above) |
| 22 | the canvas menu offers Open in designer and opens the one leaf the Inspector opened | *opens the designer from the canvas menu into the one leaf the Inspector opened, and one leaf for two presses* |
| 22 | "under the plans group" | `tests/presentation/editor/canvasMenuAssetDesignerGroup.test.ts` (Task 8) *lists "Open in designer" first among the canvas menu's items, under the plans group* — reads `CanvasMenuList`'s composed `items` prop and asserts `group: 'plans'` directly, since the menu's DOM carries no group name for an e2e test to read |
| 22 | two presses in one tick give one leaf | *opens the designer from the canvas menu into the one leaf the Inspector opened, and one leaf for two presses* (same e2e case as the row above the plans-group split) |
| 23 | Edit shape vs Open in designer, read side by side | none — `judgement` |
| 26 | restored designer and library leaves both draw the desktop-only refusal and mount nothing | *refuses both restored leaves on mobile rather than mounting either* — mobile-emulation leg, the leaves restored by `reloadObsidian` from this device's own layout; the desktop-to-phone sync itself is not reproduced |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| 2026-09-25 | W24-A — `npm run test:e2e` over `assetHandoffMore.e2e.ts`, Obsidian 1.13.7, Windows 11 | **3 passed on the desktop leg, 1 on mobile emulation.** Steps 1, 5, 6 (its second clause), 10, 22 and 26 per the table above. Step 6's pre-scan window cannot be reached through a plugin load. Step 22's canvas-menu door reveals the existing designer tab but leaves the Plan Editor as the active leaf — the row does not speak to focus, so this is an observation. |
| 2026-09-25 | `npm run test:e2e` on this branch — Obsidian 1.13.7 driven by WebdriverIO, Windows 11, `--lang=en` | **Steps 9, 10 (in part), 14, 15, 16, 17, 18, 19, 20, 21, 22 (the Inspector door), 24, 25 and 27 are in `tests/e2e/assetHandoff.e2e.ts`**, clause by clause below; 24 and 25 run on the mobile-emulation leg. Step 10 is walked against an original with NO placements — the duplicate's own sidecar is a copy under its own id and the original's is byte-identical, but "both placements still name Oven" is not read. Step 22's context-menu door and step 26's synced restore are not walked. |
| — | — | SUPERSEDED as a whole-case statement by the row below, which records a human vault walk on 2026-09-19; it stands for the per-step rows, none of which that walk individually confirmed. Originally: every row above is an expectation derived from the code, from `docs/tasks/asset-designer-expansion/contracts/DECISIONS.md` (ruling AD13-R1) and from the AD13 task reports under `docs/tasks/asset-designer-expansion/reports/`, rather than from a walk. Nothing in this case has been opened in Obsidian, and no step here has ever been run on a mobile device. |
| 2026-09-19 | live Obsidian vault, `npm run test-build` of `ecae21ab2` | **Walked in a live Obsidian vault by the repository owner (a human, not an agent), on the `npm run test-build` build of `ecae21ab2`.** Their overall verdict, recorded verbatim because it is the whole of what was given at that level: *"looks good to me"*. **No per-step outcome was recorded and none is claimed here.** The walk was not driven step-by-step against this table, so no individual `obsidian` step in this case is marked passed by it; what the run discharges is runbook §10's *"an actual Obsidian session"* condition, not this case's rows. One defect was reported from the walk and it is not in any case here: *"the preview images for presets look strange as they are inside buttons and overlapping them"* — reproduced, measured and fixed (`.rp-preset-choice` never overrode Obsidian's own `button` rule, so a 48px thumbnail hung 9px out of a 30px button top and bottom and shrank to as little as 0px wide against a `nowrap` label). **Step 23's judgement was not put to them and is NOT answered** — how **Edit shape** in the library and **Open in designer** on the plan read side by side, two names for one destination, remains unrecorded. No step here was run on a mobile device, so steps 24 through 26 are untouched by this run. Asked separately whether the Asset designer was usable at a sidebar leaf's width, they answered **usable**. |
