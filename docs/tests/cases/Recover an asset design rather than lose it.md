---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 87
sources:
  - C08 (persistence, history and failures) — the four defined write outcomes, and the no-silent-overwrite rule
  - C12 (UX, themes and evidence) — "a browser harness result is not a real Obsidian navigation test"
  - AD15 §2 scenario U05 — recover rather than lose work
  - AD15 §5 — the four things only real Obsidian validates, of which per-leaf subject restoration is this file's close/reopen clause
  - ADR-0014 (an asset is two resources, and where its sidecar lives)
  - ADR-0015 (the designer is a per-asset view type, keyed by an assetId in Obsidian's own view state)
  - ADR-0004 (one isolated Vue app per view, and therefore one Pinia per leaf)
  - SDD §65 and §66 (a refusal resolves, a fault throws, and each is reported once)
status: Ready
---

# Recover an asset design rather than lose it

AD15 scenario U05 walked in a real vault: what the asset designer shows when a write fails, when a
re-read fails with work still on screen, when Undo is pressed before the previous write has
settled, when a leaf is closed and reopened, and when the asset's note is moved or deleted from
underneath it. Contract **C08** is the authority for every expectation here, and two of its
sentences are this file's spine — *"A write is complete only according to a defined outcome:
written and refreshed, written but stale, refused/conflicted, or failed. Saved must not imply that
a stale canvas is current"*, and *"External edits, moved/deleted notes, plugin unload and two
leaves editing one asset must not cause silent overwrite."*

**The two-leaf half of U05 is [[Two designers on one asset]]** (matrix row T12), which walks
opening one asset in two leaves and making conflicting changes in them. **This file does not repeat
any of it** and works in one leaf throughout, except where a step says otherwise. The one place the
two nearly meet is step 17, whose foreign write comes from a text editor rather than a second leaf,
because a hand edit is the version of that fault a single walker can produce reliably. Walk one or
the other, not both; [[Two designers on one asset]]'s own step 11 says the same from its end and
prefers this one, since it needs no pair, no second device and no timing.

[[Design an Asset]] is the canonical procedure for this surface; nothing below re-walks drawing,
calibrating or placing.

**C08 names plugin unload and U05's own sentence does not. It is IN scope here**, as one step
(25), for two reasons: AD15 §5 lists "plugin remount/unload" among the four things only real
Obsidian validates, so there is no other instrument for it; and a designer leaf is open anyway at
that point in the walk, so the cost is one disable/enable. It is deliberately one step and not a
section — a full unload/reload audit is its own case.

## Preconditions

`npm run test-build`, this folder open as a vault, the plugin enabled, the default
**Library folder** (`Renovation/Library`, so the sidecars below are at
`Renovation/Library/Geometry/<asset id>.rpgeo`), and a text editor that is **not** Obsidian —
Notepad, VS Code, anything that can open a `.rpgeo` and save it. Several steps edit that file
directly and some of them make it invalid on purpose; work on a vault you are willing to break.

Three assets, all made from the Renovation project view's **New asset** button:

- **Asset A** — **Set dimensions** 800 × 400, then **Start from preset → Toilet**. Everything is
  measured. This is the subject of steps 1 to 18, minus 12a to 12d.
- **Asset B** — `editor-background-png-test.png` chosen as its background and calibrated against
  the fixture's 1000 mm scale bar, with a footprint traced on it and a clearance generated from
  the Inspector's four-field helper. Used by steps 12a to 12d and 19 to 20, all of which need a
  gesture that writes the note *and* the sidecar — and the first four of which need a clearance
  to put the overflow needle in.
- **Asset C** — **Set dimensions** 600 × 600 and one rectangle drawn on it. It is destroyed by
  steps 26 to 30; nothing else uses it.

Note each asset's id as you go — it is the `.rpgeo` filename, and step 31 compares it against what
the file declares.

## Why a human is the only instrument for most of this

Nine things sit outside every gate this repository has, and every one of them is a fact about the
HOST or about a real filesystem rather than about this tree:

1. **Whether an OS read-only bit reaches Obsidian's vault adapter as a rejected write at all.**
   Every failed write in the suite is injected at a fake repository. `AssetGeometryStore.writeText`
   catches whatever `Vault.modify` throws and turns it into `asset-geometry.write-failed`; whether
   Windows' read-only attribute makes it throw is the thing steps 2 and 3 are finding out, and
   nothing here can answer it.
2. **Whether an out-of-band write to a `.rpgeo` reaches the plugin.** The chain is Obsidian's own
   file watcher → `VaultChangeAdapter.onModify` → the 500 ms debounce → `announceSidecar` →
   `GeometrySidecarChanged` → this leaf's `refresh()`. Every link but the first is driven in the
   suite. The first is Obsidian deciding to raise `modify` for a file whose extension is not
   Markdown, which steps 8 and 17 are the only instruments for.
3. **Whether the leaf really comes back on the same asset.** `AssetDesignerView.getState` writes
   `{ assetId }` and `assetDesignerView.test.ts` asserts it, but `FakeLeaf` records asks rather
   than behaving — no test in this repository has ever watched Obsidian restore a workspace.
   Steps 21 to 24.
4. **What a plugin unload leaves behind.** Step 25, and it is the only place the Konva global
   `onunload` exists to release is ever observed being released.
5. **Whether an external note delete really reaches the index within a human's patience.** The
   pipeline debounces 500 ms and the designer then re-reads; the suite publishes the event
   directly. Step 27.
6. **The orphaned sidecar.** `ObsidianAssetRepository.delete` removes the note and the `.rpgeo`
   together through its `alsoRemove`; `VaultChangeAdapter` writes no files at all and only mutates
   the index, so a note deleted in the file explorer leaves the `.rpgeo` behind with nothing to
   say so. That is **this case's own derivation from those two modules — no docblock in either of
   them states it**, and no test asserts it. Step 30 is the first time anyone looks in the folder.
7. **Whether a notice is even visible.** The browser harness declares no `.notice` and no
   `.notice-container` rule, so every toast this case expects (steps 5, 12, 17) is outside
   `npm run harness-shot` as well as outside the suite. [[Notices and save state]] records the same
   limitation.
8. **Whether two words are enough.** Step 20 is a judgement, and it is the only honest verdict for
   the question U05's last clause actually asks.
9. **Whether a write really lands over a read-back that cannot.** Steps 12a to 12d are reasoned
   from four separately verified links and have never been executed as a sequence. The `.rpgeo`'s
   own `revision` is what settles it, which is why step 12c is a disk check rather than a look at
   the screen.

## The fault setups

Four faults are applied by hand below, and **three more are listed as refused alternatives because
each is the obvious first guess and each produces a different outcome, not a cheaper route to the
same one.** Record in the Runs table which you used.

### Fault 1 — a write that fails (steps 2 to 4)

**Primary: set the OS read-only attribute on `Renovation/Library/Geometry/<asset A>.rpgeo`.** On
Windows, right-click → Properties → Read-only. A read-only file still READS, which is exactly what
this fault needs and exactly why the model case for the plan editor
([[Recover from a stale read]]) lists it as the wrong guess for a failed READ. Here the asymmetry
works for us: `AssetGeometryStore.write` opens by calling `readUnlocked`, which succeeds; the
version comparison succeeds; and only `writeText`'s `Vault.modify` refuses. The refusal is
`asset-geometry.write-failed`, category `Persistence`, and it is a resolved `Result` rather than a
throw — `writeText` has its own `catch`.

**Alternative, with the trap recorded: corrupt the JSON** (delete the closing brace). It produces
the same category and nearly the same picture (`asset-geometry.corrupt`, also `Persistence`), and
it is listed second rather than first because it breaks every READ of the file as well: the canvas
can no longer be re-read, so it folds this clause into the next one instead of keeping them apart,
which is the one thing U05's word *separately* asks for.

**Alternative that is the obvious guess and is WRONG for this clause: set `"schemaVersion": 99`.**
It does refuse the write — `AssetGeometrySchema` knows versions 1 to 4 — but it refuses it as
`asset-geometry.schema-invalid`, whose category is **`Validation`**, and `affectsSaveState` treats
`Validation` as pre-write. So it raises **no `Save error` at all**: a toast instead, reading the
category fallback sentence, and the indicator **reverts to whatever it read before that gesture**
rather than being cleared or raised. Steps 5 and 11 walk it twice, against the two different
words the indicator can be reverting to.

**That variant is also fault 2's own setup, so applying it applies both faults at once.** Saving
`"schemaVersion": 99` from a text editor reaches `GeometrySidecarChanged` and provokes the re-read
that produces the stale notice, whether or not you then touch the canvas. Steps 5 and 11 both say
so where they apply it; the notice is step 7's subject and neither of them claims it.

**A third guess worth naming: deleting the asset note.** That refuses even earlier, in
`updateAssetShape`'s own asset-first read, as `asset.not-found` — category `Reference`, also
pre-write, and a toast reading *"That asset no longer exists."* So "fail a write" is at least
three different pictures on this surface depending on which resource you break. Steps 3, 5 and 27
walk all three.

### Fault 2 — a re-read that fails with work still on screen (steps 5 to 13)

**Every fault that is about a RESOURCE fails first, which is why the real one is not obvious.**

- `GetAssetDesign.execute` reads exactly two resources: `assets.getById(assetId)` and
  `geometry.read(assetId)`.
- Every geometry write reads **both of them first**. `updateAssetShape` opens with
  `assets.getById` (its asset-first existence check, shared with `CalibrateAsset`), and
  `AssetGeometryStore.write` opens with `readUnlocked` inside its own queue —
  `assetGeometrySidecar.test.ts`'s *"refuses to overwrite a sidecar it cannot read"* is that
  second half pinned.
- So no fault applied to either FILE can break the read-back alone: it refuses the write that
  precedes it, and what you get is fault 1 again. There is no window between the two to reach
  into either, `withStateRefresh` making a write and its read-back one queued unit.

**But the read-back does something the write never does: it DERIVES.** `GetAssetDesign` calls
`dimensionsOf` on the footprint and again on the clearance. `validateAssetShape` calls it **zero
times** — grep `dimensionsOf` in `src/domain/asset/AssetShape.ts` and the only hit is its own
definition — and `validateClearance` guards only `createCurvedPolygon` and `enclosesArea`, which
tests `Number.isFinite` on the shoelace AREA. **So a clearance can have a finite area and a span
that is not representable**, pass every gate on the write path, and refuse on the read path.
`GetAssetDesign`'s own comment says that is exactly what its guarded call exists for.

That asymmetry is the door, and steps 12a to 12d walk it. The fixture is not invented:
`tests/application/queries/getAssetDesign.test.ts`'s *"refuses a clearance whose span overflows
rather than reporting Infinity"* seeds it, and its docblock names the trap an improvised version
falls into — an axis-aligned rectangle spanning ±1e308 trips `asset.degenerate-clearance` one
guard earlier and never reaches `dimensionsOf` at all.

**The simpler half of the clause — a re-read that fails with work still on screen, no write of
ours involved — is reachable on its own through the other caller of the same `refresh()`.**
`createAssetDesignChangeSource` subscribes this leaf to `GeometrySidecarChanged`, which
`VaultChangeAdapter` publishes for a `.rpgeo` written by anything that is not this plugin. So a
hand edit that makes the sidecar unreadable provokes a re-read with a valid design already drawn,
`keepPreviousOnFailure` holds it, and `AssetDesignStore` sets `stale`. Steps 7 to 12 walk that
half; steps 12a to 12d then add the write.

**So: edit `Renovation/Library/Geometry/<asset A>.rpgeo` outside Obsidian and change
`"schemaVersion": 4` to `"schemaVersion": 99`.** Corrupting the JSON works identically
(`asset-geometry.corrupt` rather than `asset-geometry.schema-invalid`); the notice is keyed on
`stale` and not on the code, so either produces it. Use the schema version, because it is one
character to put back.

**The alternative that does NOT work, and it is worth knowing why: making the `.rpgeo` read-only
does not fail any read.** It is fault 1 and nothing else. The two faults in this case are
deliberately the two halves of that one file attribute.

### Fault 3 — a compensation that could not be run (steps 19 and 20)

**Set the read-only attribute on asset B's `.rpgeo` AFTER the forward gesture and before the
Undo.** `ReversibleAssetBackgroundEdit.undo` reads the sidecar (succeeds — read-only still reads),
restores the NOTE (succeeds — a different file), and then writes the sidecar (refuses). Its own
docblock names that half-undone state and marks it `markUncompensated` rather than swallowing it.
Ordering is the whole recipe: applied before the forward gesture, the gesture itself refuses and
there is nothing to undo.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could discharge it as
written. [[Smoke Test the Editor]]'s *The triage column* section defines the five values and what
they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `suite` | Open asset A's designer and read the header, then the foot of the shell below the canvas and Inspector | The toilet draws; the header carries a save-state word reading **Saved**; there is no notice paragraph anywhere below the canvas and no strip above it. **Saved before anything has been written is correct, not a defect** — `useSaveStateStore` starts at `'saved'` and only a dispatch moves it | A stale flag surviving a mount, and a notice drawn from a store field rather than from the read that just succeeded. `assetDesignStore.stale` is cleared on every successful hydration, so a notice here would mean the clearing is not on the success arm. `assetDesignerRoot.test.ts` "draws the save-state indicator in its header region, and not in the status one" is where the indicator's placement is pinned |
| 2 | `obsidian` | Apply **fault 1**: set the read-only attribute on `Renovation/Library/Geometry/<asset A>.rpgeo`. Leave the designer open and watch it for a few seconds | The designer is **unchanged** — same canvas, same selection, no notice, header still **Saved** | An attribute change being read as a content change. Setting read-only writes no bytes, so either Obsidian raises no `modify` at all or `EchoWindow.wroteFile`'s `mtime:size` comparison absorbs it; a notice here means one of those is not holding and the next steps are measuring the wrong thing |
| 3 | `obsidian` | Click **Select**, then drag the toilet's bowl a visible distance and release | The bowl **springs back** to where it was, and the header's save-state word reads **Save error**. Nothing else changes: no toast, no notice paragraph, no panel, and every tool is still live | The whole of C08's "failed" outcome on this surface. The spring-back is the load-bearing half: a refused write triggers no re-read at all (`designerRefresh.test.ts` "does not re-read after a refusal, which wrote nothing"), so the canvas redraws from the design it still holds — a bowl that stayed put would mean the store had accepted a write the vault refused. It is also the first time an OS-level write refusal has ever been in front of this code |
| 4 | `suite` | Count the toasts that appeared during step 3 | There were none | One failure reported through two widgets that can drift apart — design slice 17's decision, and `reportDispatchFailure` is where it is made once for both editing surfaces. `designerRefresh.test.ts` "leaves a write-boundary refusal to the indicator rather than toasting it twice" pins the arm, using `vault.unexpected-failure`; the code arriving here is `asset-geometry.write-failed`, the same `Persistence` category down the same branch |
| 5 | `obsidian` | Clear the read-only attribute. Now open the same `.rpgeo` in a text editor, change `"schemaVersion": 4` to `"schemaVersion": 99`, and save. Wait about two seconds — **a one-line notice appears at the foot before you touch anything; that is fault 2 arriving early and step 7 is where it is the subject, so ignore it here.** Now drag the bowl again | The bowl springs back; a **toast** appears reading *"This data is not in the expected form."*; and the header is **UNCHANGED — still reading Save error from step 3.** It was neither cleared nor re-raised | The guarantee `save-state-store.ts` states in its own words: *"Only a write that actually succeeded may clear a save error."* `asset-geometry.schema-invalid` is category `Validation`, which `affectsSaveState` treats as pre-write — correctly, since the refusal comes from the read that opens the write — so `withSaveStateTracking` takes `resolveNeutral`, and `settle()` puts back the word the batch opened on. **A build that reported `Saved` here would be telling the user step 3's failed write is now safe**, which is the victim that docblock names. It also catches the opposite over-correction, a `Save error` raised by a refusal that wrote nothing. `saveStateAgreement.test.ts` "separates a plain persistence refusal from a plain validation one" is the predicate half; the revert is what this row adds |
| 6 | `obsidian` | Put `"schemaVersion"` back to `4` and save. Wait about two seconds, then drag the bowl once more | The notice disappears on its own before you drag; then the bowl moves and stays moved, and the header reads **Saved** — the **first** thing in this walk to clear the save error | The other half of step 5's rule: a write that really landed is the one event that clears the badge. It also proves steps 3 and 5 were the fault rather than a wedged write chain — `createSerialQueue` is shared precisely so a rejected step cannot block the ones behind it — and it resets the indicator to `Saved`, which is what makes step 11 mean something different from step 5 |
| 7 | `obsidian` | Note the bowl's position, then apply **fault 2** deliberately this time: with the designer still open, set `"schemaVersion": 99` again in the text editor and save. Wait about two seconds | A one-line paragraph appears at the foot of the shell reading *"This asset could not be re-read after the last change; what you see may be out of date."* The canvas is **unchanged** — the same toilet, the same bowl position, the same selection. There is **no** failure panel and the Inspector still shows the asset's fields | C08's "written but stale" outcome, and both halves of it. A failure panel here would mean the keep-previous arm was not taken and a valid design was blanked over a read that established nothing; no notice at all would mean the leaf silently went on presenting a canvas the vault has moved past. `assetDesignerRoot.test.ts` "draws an additive stale strip rather than replacing the design it cannot re-read" drives the same state at the store and asserts both |
| 8 | `obsidian` | Confirm the notice arrived **without you pressing anything** | It did — within about a second of the save, unprompted | The whole publishing chain, which exists only for this: an out-of-band `.rpgeo` write reaching a leaf that made no command. `createAssetDesignChangeSource`'s fourth arm (`GeometrySidecarChanged`) is the subscription and `VaultChangeAdapter.announceSidecar` the publisher, and the link no test can reach is the first one — whether Obsidian raises `modify` for a non-Markdown file edited outside it |
| 9 | `obsidian` | **A hole that was recorded here and has since been CLOSED — this step is now a regression guard.** With the notice showing, read the header's save-state word | It reads **Saved · refresh needed**, not the bare word. If it reads **Saved**, that is the old defect back | **This row asserted the opposite until 2026-09-22 and the reversal is the point.** It used to read *"It reads **Saved**. This is what the build does, not a failure of the walk — record it"*, and it went further: it said a step asserting *Saved · refresh needed* here *"would be wrong about the build rather than finding a defect in it — that label cannot be produced by this surface at all"*. **That sentence is now false, deliberately.** W18-C gave `SaveStateIndicator` an optional `stale` prop and `AssetDesignerRoot` passes the same `staleAfterRefresh` that draws the notice you are looking at, so the label and the paragraph now move together and cannot disagree. The reason it could not be produced before is worth keeping: the component derived its qualifier from `useProjectStore().stale` and `usePlanningReadState()`, and `AssetDesignerView` gives the designer its own Pinia where neither is ever hydrated. **Step 11 remains the sharper instance and this is still the quiet one** — the pair stays deliberate, because a build that qualified the word only when a toast was also up would pass step 11 and fail here |
| 10 | `suite` | Look for a **Try again** button, an **Open source note** button, a warning strip with controls, or any dimmed control anywhere in the designer | **There is now exactly ONE control: a `Try again` button, a SIBLING of the notice rather than a child of it.** There is still no `Open source note`, no warning strip, and **nothing dimmed** — every tool, every Inspector field and both history buttons are live. Press it: on success the notice, the button and the header's `Saved · refresh needed` all disappear together. On failure all three STAY and the sentence changes to `Re-reading this asset failed again; what is drawn may be out of date.` | The designer's stale gate being strictly weaker than the plan editor's, which is a decision rather than an omission: `runtime.ts` builds the tool framework with `writesBlocked: () => false`, pinned by `designerRefresh.test.ts` "answers false for writesBlocked, which this surface builds but never asks". **The false premise this step used to name is FIXED as of 2026-09-22 (W18-C), and the behaviour it describes is unchanged.** That option's comment claimed this surface has *"no re-read that can go stale"*, which `assetDesignStore.stale` and the notice you are looking at contradicted; it now says a re-read here CAN go stale and that nothing blocks a write on that account, which is the true form of the same decision. What that left open was stated as three things rather than one — whether this surface SHOULD block writes while stale, whether it owes a retry action, and whether it owes the pause disclosure the plan editor's strip carries — and **all three were settled on 2026-09-22 by ruling AD18-R13**, separately rather than together, which is what the next paragraph records. **THIS ROW'S EXPECTATION CHANGED ON 2026-09-22 (W20-A) AND THE OLD TEXT WOULD NOW FAIL A PASSING BUILD.** It used to read *"There are none"*, and a walker following it would report the new button as a defect. Ruling **AD18-R13** settled the three questions this paragraph used to leave open, and it settled them SEPARATELY: the surface owes a retry, and it owes neither the write block nor the pause disclosure. The deciding fact is that `stale` is set only by a failed RE-READ and never by a failed write, so blocking would freeze a canvas whose in-memory design is perfectly good because of a vault-side fault — and any successful hydration clears `stale`, which is what makes the retry C08's *"reconcile before repeating"* rather than a second attempt at the same write. **`writesBlocked: () => false` is unchanged and is now a ruling rather than an accident**, still pinned by `designerRefresh.test.ts`. The button is a sibling because four test files read `.rp-designer-notice`'s whole text as EQUAL to the sentence, so a child control would have made that class mean two things |
| 11 | `obsidian` | With the notice still showing, drag the bowl anyway, and then read all three of the header, the foot of the shell and whatever toast appeared — **together, in one look** | The bowl springs back; a **toast** appears reading *"This data is not in the expected form."*; the notice paragraph is **still there**, unchanged, with no second copy; and the header reads **Saved · refresh needed**. Three widgets, three accounts of one vault state — and since 2026-09-22 the most prominent of them **agrees with the other two** instead of reassuring over them | **This was the sharpest instance of the hole step 9 recorded, and it is the sharpest evidence that the hole is CLOSED.** Before W18-C, `Saved` stood here beside a sentence saying the canvas may be out of date AND a toast saying the file is not in the expected form, and it was still the word a glance landed on — straight against C08's *"Saved must not imply that a stale canvas is current"*. The label now carries the qualifier, so all three widgets describe one vault state. **If the bare word `Saved` appears here, C08 is being broken again and this walk has found it.** The mechanism is step 5's, reverting to a different word: `settle()` puts back what the batch opened on, and step 6 left that at `saved`. **The clause that needs Obsidian rather than jsdom is that ONE fault produces all three**: the suite injects a failed read at the query bundle and a failed write at a fake repository, two independent probes, so no case in it can show a single broken file doing both. The write refusing rather than overwriting is the guarantee underneath — `AssetGeometryStore.write` opens by reading the file you broke |
| 12 | `obsidian` | Put `"schemaVersion"` back to `4` in the text editor and save. Do **not** press anything in Obsidian | Within about a second the notice disappears **by itself** and the canvas is current again | The only event that retires this warning being a read that succeeded. It heals unprompted because the repair is itself a sidecar change, so the same subscription that reported the problem reports the fix. A notice that needed a press to clear would be one a user has no control to give. **That sentence was the reason this row gave until 2026-09-22, and it is now false in its second half**: W20-A added a `Try again` under ruling AD18-R13. **The row's expectation is unchanged and still correct**, and the distinction is the point — the notice still heals UNPROMPTED here, because the repair is itself a sidecar change and the same subscription that reported the problem reports the fix. The retry is a door for the case where nothing heals on its own, not a press this step needs. **If you have to press `Try again` to clear this one, that is a defect and this walk has found it** |
| 12a | `obsidian` | Open **asset B**'s designer. In the text editor, replace the clearance vertex list in its `.rpgeo` with the overflow needle from **fault 2b**, keeping the file schema-valid, and save. Wait about two seconds | The stale notice appears at the foot; the canvas is unchanged; the header reads **Saved · refresh needed** (qualified since W18-C, 2026-09-22 — it read the bare word when this row was written). Same picture as step 7, from a different cause — the file parses and validates, and it is the read's own DERIVATION that refuses | The half of this that is already familiar, set up so that the next step is the unfamiliar half. It also proves the needle got past the schema and past `validateAssetShape`: a refusal on either of those would have been `asset-geometry.schema-invalid` and this case would be walking step 7 again under a new name |
| 12b | `obsidian` | Press **Remove reference**. **Use this gesture and not a drag** — the fault-2b setup says why, and a drag is refused here rather than written | Record what you see, against this expectation: the canvas does **not** change, the notice is still there, and the header reads **Saved · refresh needed** — qualified since W18-C (2026-09-22); it read the bare word when this row was written. The background is still drawn even though the asset no longer references one, because the read that would have removed it is the read that failed | **C08's "written but stale" outcome, and U05's *"fail post-write refresh"* verbatim** — our own write landed, our own read-back failed. It is also the purest instance in this file of *"Saved must not imply that a stale canvas is current"*, and the one the qualifier was most needed for: unlike steps 9 and 11, the word `Saved` here is **true** — a write really did land — and the canvas is nonetheless showing something the vault no longer holds. **That is exactly the state C08 names as "written but stale", and it is why the fix qualifies the word rather than replacing it.** Before W18-C nothing on screen distinguished this from a leaf that wrote nothing at all |
| 12c | `obsidian` | **This is what settles step 12b.** In the text editor, reopen asset B's `.rpgeo` and read its `revision`; then open asset B's note and read its frontmatter | The `revision` has gone **up by one** since 12a, the needle is still in the file, and the note's background key is **gone**. If the revision did not move, the write did not land — **record that instead; it is the finding, and it would mean this clause is not walkable after all** | The one link nobody has executed. Three things could each falsify it: `validateClearance` refusing the needle after all, `checkExpectedVersion` refusing the write, or `SetAssetBackground` dropping the clearance it carried. The file answers all three at once, which is why the check is here rather than in an argument |
| 12d | `obsidian` | Press **Undo**. Then repair the `.rpgeo` by hand — put the original clearance back — and wait about two seconds | The undo restores the background and the calibration on disk, and the canvas still does **not** redraw, because its read-back overflows exactly as before. Only the hand repair clears the notice, and the canvas then agrees with the vault for the first time since 12a. Asset B is back as the preconditions describe it, ready for step 19 | An undo inheriting the same stale-read state its forward gesture did — two writes that both landed with a canvas that never saw either. It is also the cleanup: step 19 needs asset B to have its reference back, and an undo is the cheapest way to get it without recalibrating |
| 13 | `suite` | Consider the case where the asset is not merely unreadable but GONE, and read the row rather than walking it — step 27 walks it against a real deleted note | An authoritative `asset.not-found` does **not** produce the notice: it blanks the design and fails, because the keep-previous argument is "over data the vault has" and a deleted note is the case where it has none. `designerRefresh.test.ts` "fails rather than keeping the design of an asset the vault no longer has" is that arm, paired in the same file with "keeps the design on screen when a peer-provoked re-read fails, and marks it stale" so that neither passes a build that treats every failure the same way | A stale notice drawn over an asset that is not there, which would leave a canvas the user goes on drawing on while every write refuses |
| 14 | `suite` | Make two drags of the bowl in quick succession, with no pause between them, and click **Undo** while the second is still being written | The **second** drag is the one undone — the bowl ends one step over, not back where it started — and the header settles on **Saved** | Undo being QUEUED rather than gated. `runtime.ts` wraps undo and redo in `chain.enqueue`, and `createWriteChain` runs one step at a time including its read-back, so an Undo pressed mid-write waits for that write and then undoes it. `designerWriteChain.test.ts` "undo clicked while a second drag is still being written undoes THAT drag, not the one before it" is the assertion, and its own docblock records what an unqueued Undo did instead: popped the entry the FIRST drag pushed, undoing a gesture the user was not looking at |
| 15 | `suite` | Repeat step 14 and watch the toolbar's Undo button and the header while the write is in flight | Undo never dims — it gates on stack depth alone — and the header reads **Saving** until the queue drains | An Undo that looked disabled while it was merely waiting, which would teach a user to press it twice. The pair is the point: the button is live and the ACTION is sequenced, which is a different design from pausing the control. Both clauses are jsdom state rather than paint — `DesignerToolbar.vue` binds `:disabled="!runtime.canUndo.value"` to a ref, and the word is `useSaveStateStore().state`, which `designerWriteChain.test.ts` reads directly at the end of every case in it. **No case asserts the mid-flight reading of either**, which is the gap this row records rather than a test it stands on |
| 16 | `suite` | Start a second drag by pressing and holding on a part while an earlier write is still unsettled, hold until the header stops reading Saving, then release. Repeat, but press Escape before releasing | The held press is replayed against what the earlier write left, so the two gestures compose rather than the second being refused; and the Escape'd one is abandoned and never replayed | A press buffered against a design that has since moved. `DesignerSelectTool.hold` is the buffer, and the two arms are `designerWriteChain.test.ts` "compose a second drag with the first: the bowl ends two STEPs over, and nothing is refused" and "is abandoned by Escape, and never replayed". Its neighbour "builds a drag held behind a write on a peer write that landed during the hold" is deliberately NOT the citation for the composing clause: in that case the held drag is rebuilt on a FOREIGN write and the first one is refused, which is a different outcome from two of the user's own gestures composing. Replay is also still CONDITIONAL — the same file's "stays conditional on the design it was replayed on" — so a replay cannot become the silent overwrite C08 forbids |
| 17 | `obsidian` | Drag the bowl once and let it settle (call this G1). Now open the `.rpgeo` in the text editor, change one footprint coordinate by a few units — keep the JSON **valid** and leave `schemaVersion` at 4 — and save. Wait about two seconds, then drag the bowl again and let that settle (G2). Now press **Undo** twice | The first Undo succeeds and reverses G2. The **second Undo refuses**, with a toast reading *"This change was edited elsewhere after this step, so undoing it would discard that edit. Reload and undo again if you still want it reversed."* Your hand-edited coordinate is still in the file afterwards | C08's *"Do not blindly restore old snapshots over a newer external edit during undo"*, at the one door where it can be reached by hand. G1's inverse is a whole-document snapshot taken before your edit, so applying it would delete your edit with nothing reporting anything. `WriteLedger.observe` is what notices — G2's pre-read disagrees with what this history last wrote, so the generation moves and every inverse below it is refused. `reversibleAssetDesignWindows.test.ts` "refuses the first gesture undo rather than restoring a document that predates a peer" is that case; the sandwich ordering is load-bearing and its docblock explains why a single-gesture version of this step would prove nothing |
| 18 | `suite` | Read what the refusal in step 17 actually offered, against what a conflicted WRITE offers | `undo.superseded` is the one refusal on this surface that carries real recovery copy — it names the consequence and tells the user what to do. A conflicted or failed **write** carries none: `asset-geometry.external-modification` maps to *"This entry was edited outside the plugin. Reload and try again."* in the locale table, and that sentence never reaches the user, because `reportDispatchFailure` routes a write-boundary refusal to `AUTOSAVE_SINKS`, whose `saveState` door is a no-op. Two words, **Save error**, is the whole of it | The difference between the two being invisible. `undo.superseded` is `Validation` and deliberately NOT a write-boundary code — `WriteLedger`'s own docblock says so, because it wrote nothing — which is why it takes the toast door while the write refusals take the badge. `tests/presentation/errors/saveStateAgreement.test.ts` "separates a plain persistence refusal from a plain validation one" and "reports a write-boundary code as affecting in EVERY category" are the two halves of that split, driven at the predicate. This row asserts nothing new about it; it is where U05's "recovery instructions" clause is measured, and the measurement is that one of the two paths has them |
| 19 | `obsidian` | On **asset B**, press **Remove reference**, let it settle, then apply **fault 3**: set the read-only attribute on asset B's `.rpgeo`. Now press **Undo** | The background **comes back** on the canvas and the header reads **Save error**. The calibration does **not** come back — the Reference section's Scale row still reads "Not calibrated". Nothing anywhere names the half-restored state | **The second recorded hole**, and the only place in this case where the vault is left genuinely incoherent. `ReversibleAssetBackgroundEdit.undo` restores the note and then the sidecar; the note restore lands and the sidecar restore refuses, so it returns `markUncompensated`, which sets `unrecoveredWrite` on the save-state store. **That flag is drawn by nothing on this surface, and it is drawn on two others.** `grep -rl unrecoveredWrite src/`, minus the store itself, prints eight modules: six in `presentation/editor/`, and `views/work/ProjectWorkState.vue`, which renders it as a `<p role="alert">` carrying `schedule.unrecovered`, beside `views/work/projectWorkActions.ts`, which PAUSES that surface on it. So the designer is the one surface that sets the flag and neither announces nor pauses for it. Record exactly what you see; do not assert a warning the code does not produce here |
| 20 | `judgement` | Answer the question step 19 collected the evidence for: **from what is on screen, would a user know that the undo half-succeeded and that the vault is now inconsistent?** | Record the answer in prose, with what you concluded on first glance and whether it changed once you had opened the Reference section. There is no pass condition here and no instrument that can supply one | The one thing about this state that no gate, no capture and no assertion can settle, and the direct subject of U05's *"recovery instructions"* clause. A step claiming the user is adequately warned would be an appearance nobody has seen; a step claiming they are not would be the same mistake pointed the other way |
| 21 | `obsidian` | Clear asset B's read-only attribute. Back on **asset A**, make two clearly visible gestures, then close the designer tab and reopen the same asset from the asset library's **Edit shape** | The same asset opens, drawing both gestures. The **undo history is gone**: Undo and Redo are both dimmed, and nothing warned you before the tab closed | AD15 §5's "per-leaf subject restoration", which only real Obsidian validates. The subject survives because `getState` persists `{ assetId }` and nothing else; everything held in the leaf's Pinia does not — the history, both write ledgers, the save-state word, the selection, background opacity, the camera and `stale`. **That is the correct behaviour and not a defect**: every gesture on this surface dispatches on release, so there is no unsaved edit buffer to lose, which is also why `save-state.unsaved-changes` is unreachable here. `assetDesignerView.test.ts` "carries the open asset in its own view state, so a workspace restore reopens the same asset" is the suite half, against a `FakeLeaf` that records rather than restores |
| 22 | `obsidian` | Press Undo on the reopened leaf | Nothing is undone and nothing is said — the button is dimmed and the two gestures from step 21 are still on the canvas and still in the vault | A reopened leaf offering an Undo over a history it no longer has, which would be the live control that does nothing. The gestures surviving is the other half: they were written, so losing the history loses the ability to reverse them and not the work itself |
| 23 | `obsidian` | Quit Obsidian entirely with asset A's designer tab open, and start it again | The tab comes back on asset A, draws it, and shows neither a failure panel nor a flash of one | The pre-scan race. Obsidian restores leaves BEFORE `onLayoutReady`, and the index scan runs from it, so the read at mount resolves an asset id against an empty index and is answered a legitimate miss about a note sitting on disk. `AssetDesignStore.hydrate` declines to call a pre-scan miss authoritative and holds the loading line; `createAssetDesignChangeSource`'s `ProjectIndexRebuilt` arm re-reads once the scan lands. **A failure panel that appears and then retracts is the thing to watch for**, and it is a frame or two long — look at the tab as it restores, not after |
| 24 | `obsidian` | With the designer open, open the plugin's settings and change any setting at all — verbose logging is the cheapest — then return to the designer | The designer is still on the same asset and still drawing it, and the undo history is gone again | `rebind`: a settings save unmounts and remounts every open view's Vue tree with a fresh Pinia, for every setting rather than only the relevant ones. The asset survives because it is the VIEW's own field and not store state. **This is also where `unrecoveredWrite` would be discarded** if step 19's state were still standing — `save-state-store.ts` records that window explicitly — so a user who sees a Save error, saves a setting, and looks again finds an all-clear over an unrepaired vault |
| 25 | `obsidian` | With the designer open, disable the plugin in Obsidian's community plugins pane, then enable it again. Open the developer console before you start | Record what the leaf shows after the disable and after the enable. Nothing in the console reads *Several Konva instances detected*, and no error is logged by the unload | C08's plugin-unload clause, and the one instrument for it. The Konva global is assigned at module scope on every plugin load and `onunload` exists to release it — but only while it is still the one that load claimed. A stacked global here would mean the previous load's whole bundle is still reachable from `window`, which no gate in this repository can see |
| 26 | `obsidian` | Open **asset C**'s designer. In Obsidian's file explorer, move its note from `Renovation/Library/Assets/` into any other folder. Wait about two seconds and look at the designer | **Nothing visible changes at all** — the same shape, the same Inspector, no notice, no panel, no toast. That is the pass condition | A walker reading "no visible change" as a missed event. A move keeps the index entry's id and its sidecar mapping, so the re-read the move provokes SUCCEEDS and there is nothing to report. It is written as its own step because the alternative — leaving it out — is a case that says nothing about the half of "delete/move" that is supposed to be a non-event |
| 27 | `obsidian` | Now delete asset C's note from the file explorer. Wait about two seconds | The canvas is replaced by a panel reading *"This asset no longer exists"*, *"This tab points at an asset that is not in the vault any more."*, and a single button reading **Close this tab**. There is **no** Retry button and no stale notice | C08's moved/deleted-note clause at the delete end, and the specific decision that an authoritative miss is not retryable. Allow the second — `VaultChangeAdapter` debounces 500 ms before the index entry is removed and the event published. A **Retry** here would re-run the same lookup for a note that is not coming back, in a tab with no subject |
| 28 | `suite` | Check that the panel's button is the only control and that nothing re-read in the background | It is, and nothing did | `AssetDesignerRoot`'s `failure` computed asking `isMissingAsset` FIRST, before `viewHydrationOrigin` can route it into the retryable bucket. `assetDesignerRoot.test.ts` "offers to close the tab when the asset is gone, rather than a retry that cannot work" and "still retries a vault fault, and never closes the leaf for one" are the pair — neither alone discriminates, since a handler that always closed would pass the first |
| 29 | `obsidian` | Press **Close this tab** | The leaf closes. No new tab opens, nothing is re-read, and no other designer leaf is affected | `closeLeaf` being the VIEW's own `leaf.detach()` rather than anything the root knows about. `assetDesignerRoot.test.ts` "closes the leaf from that action, and does not re-read" pins the pair in jsdom against a leaf that records the ask; whether Obsidian really detaches it is what this step adds |
| 30 | `obsidian` | Open `Renovation/Library/Geometry/` in the file explorer and look for asset C's `.rpgeo` | **It is still there.** Nothing told you, nothing offered to remove it, and no diagnostic names it. Record that it is present and record its size | The orphan, asserted by nothing anywhere in this repository. The plugin's own delete removes both halves — `ObsidianAssetRepository.delete` passes `alsoRemove` — but `VaultChangeAdapter` writes no files at all and only mutates the index, so a file-explorer delete runs none of it. `AssetGeometryStore`'s own header names the consequence that matters: a reused id is the one case its `asset-id-mismatch` guard cannot refuse, because the two ids then agree. **An invariant asserted in a comment and by no test is exactly what a manual step is for** |
| 31 | `obsidian` | Open asset A's `.rpgeo` in the text editor and read its `assetId` and `revision` | `assetId` is the same id the asset has had since the preconditions — it never changed across a failed write, a stale read, an undo, a close and reopen, a settings save or a plugin reload — and it matches the filename | U05's "stable IDs" clause, and the whole of it. An id that moved would break the sidecar's derived path (ADR-0014) and orphan the design silently, since an absent sidecar reads as a shapeless asset rather than as an error |
| 32 | `obsidian` | Compare `revision` against the number of gestures that actually landed during this walk — count them from the steps, not from memory: the successful drags in steps 6, 12's aftermath, 14 (two, minus one undo), 16 and 17 | The revision advanced once per landed write and once per landed undo, and not at all for any of the refused ones. In particular it did **not** move for steps 3, 5, 11 or 19's sidecar half | U05's "no repeated mutations" clause, measured on disk rather than inferred from the screen. There is no retry path in this designer's write chain at all, and the guards are the serial chain, the conditional writes, the `no-write` short-circuit and the ledger generation — but `assetGeometrySidecar.test.ts` "refuses a stale expectation and leaves the bytes on disk untouched" is the only one of those anything has watched against real bytes, and it watches a fake vault. This is the first count taken on a real one |

### Steps — the stale notice's way out

**Added 2026-09-22 (wave 20), and this is the half of the case that CHANGED rather than grew.**
Ruling **AD18-R13** gave the stale notice a `Try again` and refused both a write block and the plan
editor's hidden pause disclosure. Steps 10 and 12 above were rewritten for it; these five are new.

**Nothing here has been seen in Obsidian, and it cannot be**: `tests/harness/page.ts` passes its
`stale` knob to the PLAN EDITOR branch only, so no harness fixture and no capture can put the
designer into this state. A person in a vault is the only instrument that has ever drawn it.

These run from the state step 7 leaves you in — the stale notice showing over a design that is
still drawn.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 33 | `obsidian` | Look just below the stale notice | A **Try again** button is there. It is a SIBLING of the notice, not inside it, and nothing anywhere in the designer is dimmed | AD18-R13's whole ruling in one look: a door OUT, and no paused controls beside it. The sibling placement is load-bearing — four test files read the notice's text as EQUAL to its sentence, so a button inside it would make that class mean two things |
| 34 | `judgement` | Before pressing anything, say whether the button reads as an ACTION belonging to the notice, or as a bar of chrome across the leaf | Your judgement, recorded either way | **A known defect with a fix that no gate can verify.** Measured in a browser at a 1024 px leaf, the button first shipped **1024 px wide** — the full leaf — sitting below the notice's tinted strip on the plain background, reading as a second toolbar. Ruling AD18-R15 constrained it. This step is where a person says whether the constraint worked |
| 35 | `obsidian` | With the fault still in place, press **Try again** | The notice **stays**, the canvas **stays** — the design is not blanked and no failure panel appears — and the sentence changes to *"Re-reading this asset failed again; what you see may still be out of date."* | The defect the card blocked itself on rather than shipping. The only read door on the runtime blanks on failure; a retry wired to it would have replaced a design the vault still has with the failure panel, which is the one outcome the ruling forbids. **If the canvas goes blank here, that is exactly that defect** |
| 36 | `obsidian` | Press **Try again** several times in a row, quickly | Each press is answered; nothing stacks up, nothing flickers, and the button never becomes permanently dead | The in-flight guard. It withholds the second read rather than disabling the control, so the button keeps its focus and its accessible name while a read is running |
| 37 | `obsidian` | Now repair the fault in the text editor, return to the designer and press **Try again** | The notice, the button and the header's **Saved · refresh needed** all disappear **together**, and the canvas shows the repaired file | The three widgets reading one fact. They share the same value, so a build where the notice clears and the header still says `Saved · refresh needed` has two answers to one vault state — straight against C08 |
| 38 | `obsidian` | Break the file again, let the notice appear, and read its sentence **without pressing anything** | It reads the FIRST sentence — *"could not be re-read"* — **not** the *"failed again"* one | A defect found in review. The counter that swaps the sentence was reset only by the button's own handler, so a retry you made in an earlier episode kept counting: a later, unrelated failure announced itself as a failure you had already retried. **If you see "again" on a fresh failure you never retried, that defect is back** |

## Deliberately NOT checked

- **Two leaves on one asset, and the expected-version conflict between them.**
  [[Two designers on one asset]] owns that whole scenario, including whether Obsidian offers a
  second leaf on a third-party `ItemView` at all. Step 17 reaches the same refusal machinery
  through a text editor instead, because a hand edit is the version of a foreign write one walker
  can produce reliably — and because the `WriteLedger` cannot tell the two apart by construction.
- **A second route to the written-but-stale state.** Steps 12a to 12d reach it through the one
  asymmetry that exists — a clearance the write path validates and the read path cannot measure —
  and no second one is looked for. Every fault applied to either FILE refuses the write first,
  which the fault-2b section derives; a walker who wants to confirm that can apply fault 1 and
  watch step 3 happen again.
- **Making `unrecoveredWrite` visible, or proposing where it should be drawn.** Step 19 records
  what the build does. The flag exists, is set by this surface and is read by five Plan Editor
  modules; closing that is an increment with its own argument.
- **Whether the plan editor shows any of this differently.** [[Recover from a stale read]] is that
  surface's own case and is the model this one was written against. The two are deliberately not
  merged: the designer's gate is still weaker, but **no longer in the way this bullet said until 2026-09-22**:
  it has a `Try again` now (AD18-R13, W20-A). What it still does not have is a strip with several
  actions, an `Open source note`, or any paused control — the ruling refused the write block and the
  pause disclosure together, and refused them on the merits rather than for cost. A shared case would
  still have to say "except here" at every row, and the rows it would have to say it at have changed.
- **A sidecar whose `assetId` declares a different asset.** It is refused
  (`asset-geometry.asset-id-mismatch`) and it is a copy-a-file-and-rename-it fault rather than a
  recovery one; `assetGeometrySidecar.test.ts` "refuses a sidecar that declares a different asset"
  covers it and no screen is involved.
- **Colour contrast, hit-target size and any theme other than the default.** The standing exception
  every case in this suite carries.

## Automated in Obsidian

**Added 2026-09-25.** `tests/e2e/assetDesignerRecovery.e2e.ts`, against a real vault copy on a real file
system, with the `.rpgeo` on disk as the instrument step 12c asks for.

| Step | Clause | Discharged by |
| --- | --- | --- |
| 2 | setting the read-only attribute changes nothing on screen | *refuses a write the OS forbids without a toast, and clears the error only on a write that lands* — header and notice read after a second's wait |
| 3 | the bowl springs back and the header reads Save error | same case — Position X still 0, revision still 1 |
| 4 | no toast during step 3 | same case |
| 5 | `schemaVersion: 99` on disk: a toast "This data is not in the expected form.", header UNCHANGED at Save error, nothing written | same case — the refusal comes from the read that opens the write, so no host watcher is needed |
| 6 | the next landed write clears the error | same case — revision 2, "Saved just now", X 10 |
| 7 | the notice sentence, with the canvas unchanged and no failure panel | *shows the stale notice once the host reconciles an edited sidecar, retries it, and heals it unprompted* — after `reconcileFile` |
| 8 | the notice arrives without a press | **finding** — it does not: nothing reaches the leaf until Obsidian reconciles, which a driven 1.13.7 never does on its own; measured for 15 s on the `.rpgeo` and the `.md` control |
| 9 | the header reads "Saved · refresh needed" | same case |
| 10 | exactly one control, Try again, a sibling of the notice, nothing dimmed | same case — the retry is outside the notice element, and no tool button carries `disabled` |
| 12 | the repair clears the notice with no press | same case — once reconciled, the notice and the retry go together |
| 17 | the second Undo refuses with the exact sentence, the foreign coordinate survives | *refuses to undo past a foreign edit, with the one refusal here that explains itself* — revision unchanged by the refusal, `-195` still on disk |
| 21 | close and reopen: the same asset, both gestures, history gone | *restores the same asset across a close, a restart and a settings save, keeping the work and losing the history* |
| 22 | Undo on the reopened leaf is dimmed and undoes nothing | same case |
| 23 | a restart brings the tab back on the asset with no failure panel | same case — `reloadObsidian`, the leaf's view state, and `.rp-view-failure` absent once drawn; a one-frame flash is not observed by this instrument |
| 24 | a settings save keeps the asset and drops the history | same case — Verbose logging toggled in the real settings window |
| 26 | a moved note changes nothing visible | *ignores its note moving, and offers only Close this tab once the note is gone, leaving the sidecar orphaned* |
| 27 | a deleted note: the panel's headline, body and single Close this tab; no Retry, no stale notice | same case |
| 29 | Close this tab detaches the leaf | same case |
| 30 | the `.rpgeo` is still there, naming the asset | same case |
| 31 | `assetId` is unchanged and matches the filename | same case, and every other case reads the file by that name |
| 33 | Try again below the notice, a sibling, nothing dimmed | *shows the stale notice…* |
| 35 | a retry over the fault keeps the canvas and changes the sentence to "again" | same case |
| 37 | repair plus retry clears the notice, the button and the qualifier together | same case — the repair is reconciled, and the three go at once |
| 38 | a fresh failure reads the first sentence | same case |

**Added later on 2026-09-25 (W24-A).** `tests/e2e/assetDesignerRecoveryMore.e2e.ts`, over
`tests/e2e/recovery.ts` (the needle, the fault edits). Every case was watched red against a
one-clause mutation of `src/`, recorded in W24-A's report.

| Step | Clause | Discharged by |
| --- | --- | --- |
| 11 | the drag into the fault springs back | *counts one revision per landed write and undo and none per refusal, and draws one fault three ways* |
| 11 | a toast "This data is not in the expected form." | same case |
| 11 | the notice is still there, unchanged, with no second copy | same case — every `.rp-designer-notice` reads the one sentence |
| 11 | the header reads Saved · refresh needed | same case |
| 11 | one fault produces all three | same case — one schema-99 file, read in one look after one nudge |
| 12a | the stale notice appears; canvas unchanged; header qualified | *lands a Remove reference and its undo over a clearance the read-back cannot measure, and stays stale until repaired* |
| 12b | canvas, notice and header unchanged, the background still drawn | same case — the Konva image still on the stage, no toast |
| 12c | revision +1, the needle still in the file, the note's background key gone | same case — disk and metadata cache |
| 12d | the undo restores background and calibration on disk | same case |
| 12d | the canvas still does not redraw | same case — the notice still reads the first sentence after the undo |
| 12d | only the hand repair clears the notice, and the canvas then agrees | same case |
| 19 | the background comes back, the header reads Save error | *restores the sheet but not its scale when the undo cannot write the sidecar, and names neither* |
| 19 | the calibration does not come back: Scale reads "Not calibrated" | same case — the sidecar on disk still has `calibration: null` at an unchanged revision |
| 19 | nothing names the half-restored state | same case — no toast, no `.rp-designer-notice`, no `[role="alert"]` |
| 20 | would a user know the undo half-succeeded | none — `judgement` |
| 25 | no `Several Konva instances` line, and the unload logs no error | Design an Asset's *keeps every shape across a plugin reload, which detaches the leaf and leaves the console clean* |
| 32 | the revision advances once per landed write and once per landed undo | *counts one revision per landed write and undo…* — preset, nudge, undo, redo, nudge, nudge = 1..6 |
| 32 | it does not move for steps 3, 5 and 11, nor for step 19's sidecar half | same case, and *restores the sheet but not its scale…* |
| 34 | the button reads as an action, not chrome | none — `judgement` |
| 36 | a burst of presses is answered with one read; nothing stacks up | *answers a burst of Try again with one read, keeping the button focused and live* — five presses in one tick, one `vault.read` |
| 36 | nothing flickers | same case — a MutationObserver saw no notice, retry or failure node come or go |
| 36 | the button never becomes permanently dead | same case — `aria-disabled` clears, focus stays, the next press reads, and a press after the repair heals |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| 2026-09-25 | W24-A — `npm run test:e2e` over `assetDesignerRecoveryMore.e2e.ts`, Obsidian 1.13.7, Windows 11 | **4 passed**, each watched red first. **Steps 12a–12d executed as a sequence for the first time, and walk exactly as reasoned**: Remove reference lands (revision +1, needle kept, calibration null, the note's `background-path` gone), the read-back overflows so the notice, the qualified header and the drawn sheet all stay; the undo lands too (revision +2, calibration and background restored) and the canvas still does not redraw until the hand repair is reconciled. **Step 19 matches the row**: on Windows the read-only bit refuses the sidecar restore, the note restore lands, the sheet comes back, the header reads Save error, Scale reads "Not calibrated", and nothing names it — `unrecoveredWrite` is drawn nowhere, as predicted. Instrument notes: the designer offers no background door once a shape exists, so Asset B is built sheet → calibration → preset; the Reference rows are not drawn for a measured shape even over a calibrated sheet. |
| 2026-09-25 | `npm run test:e2e` on this branch — Obsidian 1.13.7 driven by WebdriverIO, Windows 11, `--lang=en` | **Steps 2, 3, 4, 5, 6, 7, 9, 10, 12, 17, 21, 22, 23, 24, 26, 27, 29, 30, 31, 33, 35, 37 and 38 are discharged by `tests/e2e/assetDesignerRecovery.e2e.ts`**, clause by clause in *Automated in Obsidian*. **Fault 1 is answered: on Windows the read-only attribute IS a rejected `Vault.modify`** — `Save error`, revision unchanged, no toast, the bowl back where it was. **Step 8's first link is answered NO**: for a `.rpgeo` (and for a `.md` note — measured as the control) written outside Obsidian, the host raises `raw` within 10 ms and then neither raises `modify` nor updates the `TFile`'s `stat` for 15 s, so the stale notice never arrives by that route. Every link after it is real: the suite calls `app.vault.adapter.reconcileFile(path, path)` — the call Obsidian's own watcher makes when it does act — and from there the notice, the qualified header, `Try again`, the "again" sentence, the unprompted heal and the first-sentence reset all behave as the rows say. Step 25's disable-and-enable detaches every designer leaf (recorded in Design an Asset's run). Not walked: 12a–12d, 13–16, 18–20, 25 beyond that, 32, 34, 36. |
| — | — | **Not yet run in a vault. No step above has been walked.** Every row is an expectation derived from the module source, its English copy and the tests named in the rows — never from memory of any of them. The `suite` rows' tests were run (`npx vitest run` over `designerRefresh`, `designerWriteChain`, `assetDesignerRoot`, `assetDesignerView`, `designerCrossLeaf`, `assetGeometrySidecar`, `reversibleAssetDesignWindows`, `saveStateAgreement` and `getAssetDesign`) and all passed at the time of writing; that establishes the assertions exist and hold, not that the vault behaves as the `obsidian` rows say. **Steps 12a to 12d are the least-supported rows in the file** — four separately verified links, never executed as a sequence — so walk them with step 12c's disk check in hand and record what the `revision` actually did. Record the fault setups used, the Obsidian version and the platform — steps 2, 3 and 19 all rest on an OS read-only attribute, whose behaviour is not the same on Windows and macOS. |

## Outcome

Written after the first walk: which steps passed, whether the read-only attribute produced a write
refusal at all, whether an externally edited `.rpgeo` reached the leaf, whether step 12b's write
really landed over its failed read-back, and anything only a live vault showed.
