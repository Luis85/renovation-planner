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

**Why a human still matters here.** Five things put this material out of every gate's reach:

- **"A duplicate does not change the original" is a claim about the VAULT, not about a
  component.** `DuplicateAssetCommand` gets it by touching no plan, and the panel's own sentence
  asserts it to the user. The only instrument that can confirm it is opening the plan afterwards
  and looking at what is drawn there — step 10.
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
| 1 | `obsidian` | Run `Open asset library` from the command palette and select `Oven` | The inspector draws its name, **Used in**, its fields, its shape and a row of actions — and there is **no "Used in plans" section anywhere on it yet** | Where the scope actually lives. `AssetUsageScope` is drawn INSIDE `AssetUsageDuplicate`, which the inspector draws only once Duplicate has been pressed, so the plan scope is a property of that gesture rather than of the selection. Ruling AD13-R1 records this asymmetry as an accident of which card reached which file, and step 28 is its other end |
| 2 | `suite` | Press **Duplicate** | A panel appears headed "Duplicate as new asset", with a sentence reading "The copy is a new definition with its own geometry. Plans that place this asset keep the original.", a field labelled "Name of the copy" prefilled `Oven (copy)`, and two buttons, **Create copy** and **Cancel** | The prefill, which is what stops the submit needing a `:disabled`: an emptied name reaches `Asset.create` and comes back as a refusal the panel renders, where a dead button would tell the user nothing. `assetUsageDuplicate.test.ts` "is drawn for a readable asset and opens a panel prefilled with a copy name" |
| 3 | `suite` | Read the **Used in plans** section inside that panel | A heading "Used in plans" and one row per plan, each reading *plan name* — *n* placement(s): the plan holding two reads "2 placement(s)" and the other "1 placement(s)" | The count being per PLAN rather than a total, so the scope says where the blast radius is and not only how big it is. `assetUsageDuplicate.test.ts` "shows which plans place the definition before anything is dispatched" |
| 4 | `suite` | Cancel, select `Shelf`, and press Duplicate | The Used in plans section reads "No plan places this asset" — not an empty list, and not a refusal | The difference between *nobody uses this* and *I could not find out who uses this*, which is the difference between a safe change and a blind one. **This is the one arm of this section with no automated case:** `assetUsageDuplicate.test.ts` drives loading, refused, ready-with-rows and ready-but-incomplete, and not the empty ready answer |
| 5 | `obsidian` | Break one of the two plan notes so it cannot be parsed (corrupt its frontmatter in another editor), reopen the library, select `Oven` and press Duplicate | The list still names the plan it COULD read, and a further line reads "1 note(s) could not be read, so this list may be incomplete" | C08's *"a failed read is not 'asset missing'"* at the one surface whose whole job is to state a blast radius. Folding an incomplete answer into either a refusal or a clean scope would make a partial answer look total. `assetUsageDuplicate.test.ts` "says the scope is incomplete when some plans could not be read" |
| 6 | `obsidian` | Repair the note. Then quit and restart Obsidian, and press Duplicate on `Oven` as fast as you can after the window appears — before the initial index scan has finished | The section reads "The plans that place this asset could not be read, so the scope below is unknown." rather than "No plan places this asset" | The read being GATED on `indexScanCompleted()`. Both repositories the query walks enumerate through the index and answer `ok` over an EMPTY one, so the ungated answer before the scan is *no plan places this asset* — over a vault full of plans that place it. Only a real startup can produce the window. `assetUsageDuplicate.test.ts` "says the scope is unknown rather than empty when the index has not been scanned" drives the gate; nothing can drive the timing |
| 7 | `suite` | With the panel open, look at the action row above it | The **Duplicate** button is gone while its own panel is open | One gesture being unable to open two panels, and by withdrawing the control rather than disabling it. `assetUsageDuplicate.test.ts` "is withdrawn while its own panel is open, so one gesture cannot open two" |
| 8 | `suite` | Press **Cancel** | The panel disappears, the Duplicate button returns, and nothing at all is written — no new note, no new row on the shelves | AD13 criterion 4's *"no asset ID, reference or quantity link points to an orphan after cancel"*, true here by construction rather than by cleanup. `assetUsageDuplicate.test.ts` "dispatches nothing on cancel and leaves the panel gone" |
| 9 | `obsidian` | Press Duplicate again on `Oven` and press **Create copy** with the prefilled name | A note named `Oven (copy)` appears in the library folder in Obsidian's file explorer, a row for it joins the shelves, the panel closes, and the inspector is still showing `Oven` — the selection did not move to the copy | The copy reaching the catalogue through the existing change-and-hydrate path. Selecting the new id before that refresh lands would resolve against a listing that has never seen it and draw the panel's *asset is gone* state over a duplicate that worked. `assetUsageDuplicate.test.ts` "dispatches the real command with the subject and the typed name" and "closes on success, leaving the selection where it was" |
| 10 | `obsidian` | Open the plan that held two placements of `Oven`, select each placement, and read its Inspector; then open `Oven` in the designer | Both placements still name `Oven`, at the same size and the same position; neither is `Oven (copy)`; no third placement has appeared anywhere; and `Oven`'s own geometry in the designer is exactly what it was | **The step this half of the case exists for.** C11's *"a duplicate does not change the original"*, which the panel ASSERTS to the user in its own sentence. `DuplicateAssetCommand` earns it by touching no plan, and the only instrument that can confirm that is a plan a person opens afterwards |
| 11 | `suite` | Reopen the Duplicate panel, then click a different asset's row while it is open | The panel closes rather than staying open under a new name; reopening it prefills the NEW asset's name | A name prefilled from the previous asset being carried into a note for this one. `assetUsageDuplicate.test.ts` "closes when the selection moves, so no name is carried from the previous asset" |
| 12 | `suite` | Open `Oven` in the designer (from the library's own action, or from the Renovation project view) and look at the Inspector's asset block | A button reads exactly "Use in plan", beside "Open the asset library" | AD13's forward door, drawn beside the way back because the two are this surface's only navigations. `designerUsePlan.test.ts` "is drawn, and labelled, for a placeable asset behind a bound door" |
| 13 | `suite` | Open the designer on the THIRD asset (no footprint) and on the FOURTH (traced over an uncalibrated sheet) | Neither draws a **Use in plan** button at all — not a dimmed one | `assetShapeAnswer`'s placeable arm asked of this surface's own DTO, so the button is absent exactly where placement would refuse with `editor.asset.no-shape` or `editor.asset.unscaled`. Both refused states are one gesture from placeable — Set dimensions, or calibrate — and both of those controls are on the same panel. `designerUsePlan.test.ts` drives both states as an `it.each` of "an asset with no footprint" and "a footprint still in background pixels" |
| 14 | `obsidian` | With exactly ONE Plan Editor open anywhere in the workspace, press **Use in plan** on `Oven` | No picker appears at all. That Plan Editor comes forward with a banner reading "Click the plan to place a copy; near a wall it turns to face the room. Esc stops placing." — and clicking the plan places an `Oven`, not whatever the Add menu last used | The whole channel, end to end: the closure-scoped slot in `assetDesignerUsePlan`, the `{ planId, assetId }` origin, and `editorArrival`'s asset arm arming the placement tool through the same door the Add menu's picker arms it through. `vue-tsc` cannot see a dropped argument here — `() => void` is assignable to `(assetId: string) => void` — so the only instruments are `tests/plugin/assetDesignerUsePlan.test.ts` ("continues into the one Plan Editor already open, asking nothing") and this step |
| 15 | `obsidian` | Open a SECOND Plan Editor on a different plan, then press Use in plan again | A fuzzy picker asks which plan; choosing one opens it with the same armed banner and the same asset | Two open plans being genuinely ambiguous where one is not. `tests/plugin/assetDesignerUsePlan.test.ts` "asks which plan when two different ones are open" and "treats two leaves showing the same plan as that one plan" |
| 16 | `obsidian` | Close every Plan Editor, press Use in plan, and dismiss the picker with Escape | Nothing opens and nothing is armed; pressing Use in plan again asks the same question rather than going quiet | The slot being cleared on read, so a dismissed pick cannot leave an asset armed for whatever opens next. `tests/plugin/assetDesignerUsePlan.test.ts` "creates and reveals nothing when the pick is dismissed" and "asks again after a picker is dismissed" |
| 17 | `obsidian` | Double-click **Use in plan** as fast as you can | Exactly one picker opens, or exactly one Plan Editor comes forward — never two | The in-flight guard, which is the same class of defect as the double ribbon click that once gave two tabs of the singleton view. `tests/plugin/assetDesignerUsePlan.test.ts` "opens one picker for two presses in the same tick" |
| 18 | `obsidian` | In a vault that has assets but no plans at all, press Use in plan | A notice reads "This vault has no renovation plans yet." and no empty picker opens | `open-plan-editor`'s own lesson applied here: a picker over nothing is a dead end, and a sentence naming the missing thing is not. `tests/plugin/assetDesignerUsePlan.test.ts` "says so rather than opening an empty picker, in a vault with no plans" — and the notice's appearance is the half no harness can draw, since the vendored `obsidian.css` declares no `.notice` rule at all |
| 19 | `obsidian` | After placing through the hand-off, open the Renovation project view | The **Continue** group now offers that project and that plan | The hand-off recording a Continue context for a plan it picked, so the workflow's last step feeds the launcher the next session starts from. `tests/plugin/assetDesignerUsePlan.test.ts` "records the Continue context for the plan it picked" and "records nothing when the reveal fails" |
| 20 | `obsidian` | On the plan, select one of the `Oven` placements and read its Inspector | It shows the placement's size as *width* × *depth* m and offers **Open in designer**, **Replace asset…** and **Add as material** | The door back, at the surface where a user notices the shape is wrong. This is also the label the ruling AD13-R1 had to be corrected against: its first version called it "Edit shared asset", a string `grep` finds nowhere in `src/` |
| 21 | `obsidian` | Press **Open in designer** | A designer leaf opens on `Oven` with its footprint drawn | The two-hop round trip — library to plan to designer — closing on the same definition it started from |
| 22 | `obsidian` | Go back to the plan, right-click the same placement on the canvas, and press **Open in designer** from the menu; then do it twice in quick succession | The menu offers it under the plans group, it opens the SAME single designer leaf the Inspector button opened rather than a second one, and two presses in one tick still give exactly one leaf | CLAUDE.md's "one action, every input": there are two doors to this destination and both must call the one reveal function, which holds an in-flight map keyed by the view type plus the state that would be set. `tests/plugin/assetDesignerCommands.test.ts` "opens one leaf for two activations of the same asset in the same tick" and "opens two leaves for two different assets" |
| 23 | `judgement` | Put the library inspector and a selected plan placement side by side and read the two buttons that open the designer: **Edit shape** in the library, **Open in designer** on the plan | Record how it reads. Both open the same surface on the same definition, under two different names. There is no pass condition and no instrument that can supply one | Exactly the shape [[Browse the asset library]] already records as an expected failure one surface over — *a category named two ways on two surfaces of one pane*. Two names for one destination is either a useful distinction (one edits geometry, one navigates) or a pair that drifted; nothing but a reader can say which |
| 24 | `obsidian` | On the MOBILE device, open the command palette and search for `asset` | Neither **Open asset library** nor **Open asset designer** is listed | C12's *"preserve the actual platform gate until a separate mobile decision is accepted"*, and `Platform.isMobile` being exactly the kind of precondition a `checkCallback` may take — nothing a user does in a vault can change it, so gating on it hides the command only where the surface behind it would refuse anyway. `tests/plugin/assetDesignerCommands.test.ts` "stays out of the palette on mobile, opening no picker" and `tests/plugin/assetLibraryCommandGate.test.ts` "hides from the palette on mobile" |
| 25 | `obsidian` | On the same device, open the Renovation project view and press its **Open library** button | A leaf opens saying this surface needs a desktop, rather than a blank pane or a broken one | The deliberately UNGATED half. `AssetLibraryView.onOpen`'s own refusal is the load-bearing one — that button is ungated by decision, and making it disappear is the project view's own change — so the honest outcome is a leaf that refuses rather than a button that does nothing. `tests/presentation/library/assetLibraryMobile.test.ts` drives the view's refusal; nothing drives that button reaching it |
| 26 | `obsidian` | Leave an Asset designer leaf and an Asset library leaf open on the desktop, sync the vault, and open it on the mobile device | Both restored leaves draw the desktop-only refusal rather than mounting anything | The half no command can answer. Obsidian restores leaves from its own workspace layout with no command running at all, which is why the refusal lives in `sync`/`onOpen` as well as in the two `checkCallback`s — and `sync` is reached by `setState` as well as by `onOpen` |
| 27 | `obsidian` | Back on the desktop, open the command palette and search `asset` again | Both commands are listed, named exactly "Open asset library" and "Open asset designer" | A gate that hid the commands everywhere. `tests/plugin/assetDesignerCommands.test.ts` "appears in the palette in a vault with no assets" and "carries an unprefixed id and a translated name"; `tests/plugin/assetLibraryCommandGate.test.ts` "answers the palette's question off mobile without opening anything" |
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

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | Not yet run in a vault. Every row above is an expectation derived from the code, from `docs/tasks/asset-designer-expansion/contracts/DECISIONS.md` (ruling AD13-R1) and from the AD13 task reports under `docs/tasks/asset-designer-expansion/reports/`, rather than from a walk. Nothing in this case has been opened in Obsidian, and no step here has ever been run on a mobile device. |
