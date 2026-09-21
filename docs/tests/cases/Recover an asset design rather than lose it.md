---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 85
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
two nearly meet is step 18, whose foreign write comes from a text editor rather than a second leaf,
because a hand edit is the version of that fault a single walker can produce reliably.

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
  measured. This is the subject of steps 1 to 18.
- **Asset B** — `editor-background-png-test.png` chosen as its background and calibrated against
  the fixture's 1000 mm scale bar. Used by steps 19 and 20 alone, which need a gesture that writes
  the note *and* the sidecar.
- **Asset C** — **Set dimensions** 600 × 600 and one rectangle drawn on it. It is destroyed by
  steps 26 to 30; nothing else uses it.

Note each asset's id as you go — it is the `.rpgeo` filename, and step 31 compares it against what
the file declares.

## Why a human is the only instrument for most of this

Eight things sit outside every gate this repository has, and all eight are facts about the HOST or
about a real filesystem rather than about this tree:

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
   say so. That is a derivation from two modules and is asserted by no test — step 30 is the first
   time anyone looks in the folder.
7. **Whether a notice is even visible.** The browser harness declares no `.notice` and no
   `.notice-container` rule, so every toast this case expects (steps 5, 12, 17) is outside
   `npm run harness-shot` as well as outside the suite. [[Notices and save state]] records the same
   limitation.
8. **Whether two words are enough.** Step 20 is a judgement, and it is the only honest verdict for
   the question U05's last clause actually asks.

## The fault setups

Three faults are applied by hand below, and **two more are listed as refused alternatives because
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
`Validation` as pre-write. So it produces **no `Save error` at all**: a toast instead, reading the
category fallback sentence. Step 5 walks it precisely because the picture differs.

**A third guess worth naming: deleting the asset note.** That refuses even earlier, in
`updateAssetShape`'s own asset-first read, as `asset.not-found` — category `Reference`, also
pre-write, and a toast reading *"That asset no longer exists."* So "fail a write" is at least
three different pictures on this surface depending on which resource you break. Steps 3, 5 and 27
walk all three.

### Fault 2 — a re-read that fails with work still on screen (steps 8 to 13)

**This clause is NARROWED, and here is the code that narrows it.** U05 asks to *"fail post-write
refresh"*. The exact sequence — our own write lands, our own read-back fails — **has no
hand-applied fault**, and the reason is structural rather than a gap in anyone's imagination:

- `GetAssetDesign.execute` reads exactly two resources: `assets.getById(assetId)` and
  `geometry.read(assetId)`.
- Every geometry write reads **both of them first**. `updateAssetShape` opens with
  `assets.getById` (its asset-first existence check, shared with `CalibrateAsset`), and
  `AssetGeometryStore.write` opens with `readUnlocked` inside its own queue —
  `assetGeometrySidecar.test.ts`'s *"refuses to overwrite a sidecar it cannot read"* is that
  second half pinned.
- So there is no resource the read-back touches that the write has not already read. Any fault
  that breaks the read breaks the write that precedes it, and what you get is fault 1 again.
- The designer's write and its read-back are one queued unit besides —
  `withStateRefresh`, wrapped into the chain in `runtime.ts` — so there is no window between them
  for a hand to reach into.

**What IS reachable is the STATE C08 names, "written but stale", through the other caller of the
same `refresh()`.** `createAssetDesignChangeSource` subscribes this leaf to `GeometrySidecarChanged`,
which `VaultChangeAdapter` publishes for a `.rpgeo` written by anything that is not this plugin. So
a hand edit that makes the sidecar unreadable provokes a re-read with a valid design already drawn,
`keepPreviousOnFailure` holds it, and `AssetDesignStore` sets `stale`. That is the same store field,
the same notice and the same header, reached by the only door a walker can open.

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
| 5 | `obsidian` | Clear the read-only attribute. Now open the same `.rpgeo` in a text editor, change `"schemaVersion": 4` to `"schemaVersion": 99`, save, wait about two seconds, and drag the bowl again | A **toast** appears reading *"This data is not in the expected form."*, and the header does **not** read Save error | "Fail a write" being three different pictures and not one. `asset-geometry.schema-invalid` is category `Validation`, which `affectsSaveState` treats as pre-write — correctly, since the refusal comes from the read that opens the write — so the indicator stays out of it and the sentence goes to a toast instead. A build that badged this one would be reporting a persistence failure that did not happen |
| 6 | `obsidian` | Put `"schemaVersion"` back to `4`, save, wait about two seconds, and drag the bowl once more | The bowl moves and stays moved; the header reads **Saved** again; nothing else is on screen | The recovery being a plain retry of the gesture, with no repair control needed and none offered. It also proves steps 3 and 5 were the fault rather than a wedged write chain — `createSerialQueue` is shared precisely so a rejected step cannot block the ones behind it |
| 7 | `obsidian` | Note the bowl's position, then apply **fault 2**: with the designer still open, set `"schemaVersion": 99` again in the text editor and save. Wait about two seconds | A one-line paragraph appears at the foot of the shell reading *"This asset could not be re-read after the last change; what you see may be out of date."* The canvas is **unchanged** — the same toilet, the same bowl position, the same selection. There is **no** failure panel and the Inspector still shows the asset's fields | C08's "written but stale" outcome, and both halves of it. A failure panel here would mean the keep-previous arm was not taken and a valid design was blanked over a read that established nothing; no notice at all would mean the leaf silently went on presenting a canvas the vault has moved past. `assetDesignerRoot.test.ts` "draws an additive stale strip rather than replacing the design it cannot re-read" drives the same state at the store and asserts both |
| 8 | `obsidian` | Confirm the notice arrived **without you pressing anything** | It did — within about a second of the save, unprompted | The whole publishing chain, which exists only for this: an out-of-band `.rpgeo` write reaching a leaf that made no command. `createAssetDesignChangeSource`'s fourth arm (`GeometrySidecarChanged`) is the subscription and `VaultChangeAdapter.announceSidecar` the publisher, and the link no test can reach is the first one — whether Obsidian raises `modify` for a non-Markdown file edited outside it |
| 9 | `obsidian` | **The first recorded hole.** With the notice showing, read the header's save-state word | It reads **Saved**. **This is what the build does, not a failure of the walk** — record it. `SaveStateIndicator` derives its *Saved · refresh needed* label from `useProjectStore().stale` and `usePlanningReadState()`, and `AssetDesignerView` gives the designer its own Pinia where neither is ever hydrated; the designer's own staleness lives on `assetDesignStore` and no indicator reads it | The hole closing or widening silently. This is the sharpest thing in the case against C08's *"Saved must not imply that a stale canvas is current"*: the sentence and the word are both on screen at once, three inches apart, disagreeing. A step asserting *Saved · refresh needed* here would be wrong about the build rather than finding a defect in it — that label cannot be produced by this surface at all |
| 10 | `suite` | Look for a **Try again** button, an **Open source note** button, a warning strip with controls, or any dimmed control anywhere in the designer | There are none. The notice is a bare `<p role="status">` with no children, and every tool, every Inspector field and both history buttons are live | The designer's stale gate being strictly weaker than the plan editor's, which is a decision rather than an omission: `runtime.ts` builds the tool framework with `writesBlocked: () => false`, pinned by `designerRefresh.test.ts` "answers false for writesBlocked, which this surface builds but never asks". **That option's own comment gives a false reason** — it says this surface has "no re-read that can go stale", which `assetDesignStore.stale` and the notice you are looking at contradict. The behaviour is deliberate; the premise written beside it is not, and that belongs in the package's own findings rather than in this step |
| 11 | `obsidian` | With the notice still showing, drag the bowl anyway | It springs back and the header reads **Save error**; the notice paragraph is **still there**, unchanged, and no second copy of it appears | The one state where both of C08's failure words are on screen together, and the fact that nothing stopped the user reaching it. The write refuses for the same reason the read did — `AssetGeometryStore.write` opens by reading the file you broke — so this is a refusal and not an overwrite, which is the guarantee that matters. **The clause that needs Obsidian rather than jsdom is that ONE fault produces both halves**: the suite injects a failed read at the query bundle and a failed write at a fake repository, two independent probes, so no case in it can show that a single broken file refuses both. A second notice paragraph would mean the region is being appended to rather than bound to one flag |
| 12 | `obsidian` | Put `"schemaVersion"` back to `4` in the text editor and save. Do **not** press anything in Obsidian | Within about a second the notice disappears **by itself** and the canvas is current again | The only event that retires this warning being a read that succeeded. It heals unprompted because the repair is itself a sidecar change, so the same subscription that reported the problem reports the fix. A notice that needed a press to clear would be one a user has no control to give — there is no **Try again** on this surface |
| 13 | `suite` | Consider the case where the asset is not merely unreadable but GONE, and read the row rather than walking it — step 27 walks it against a real deleted note | An authoritative `asset.not-found` does **not** produce the notice: it blanks the design and fails, because the keep-previous argument is "over data the vault has" and a deleted note is the case where it has none. `designerRefresh.test.ts` "fails rather than keeping the design of an asset the vault no longer has" is that arm, paired in the same file with "keeps the design on screen when a peer-provoked re-read fails, and marks it stale" so that neither passes a build that treats every failure the same way | A stale notice drawn over an asset that is not there, which would leave a canvas the user goes on drawing on while every write refuses |
| 14 | `suite` | Make two drags of the bowl in quick succession, with no pause between them, and click **Undo** while the second is still being written | The **second** drag is the one undone — the bowl ends one step over, not back where it started — and the header settles on **Saved** | Undo being QUEUED rather than gated. `runtime.ts` wraps undo and redo in `chain.enqueue`, and `createWriteChain` runs one step at a time including its read-back, so an Undo pressed mid-write waits for that write and then undoes it. `designerWriteChain.test.ts` "undo clicked while a second drag is still being written undoes THAT drag, not the one before it" is the assertion, and its own docblock records what an unqueued Undo did instead: popped the entry the FIRST drag pushed, undoing a gesture the user was not looking at |
| 15 | `browser` | Repeat step 14 and watch the toolbar's Undo button and the header while the write is in flight | Undo never dims — it gates on stack depth alone — and the header reads **Saving** until the queue drains | An Undo that looked disabled while it was merely waiting, which would teach a user to press it twice. The pair is the point: the button is live and the ACTION is sequenced, which is a different design from pausing the control |
| 16 | `suite` | Start a second drag by pressing and holding on a part while an earlier write is still unsettled, hold until the header stops reading Saving, then release. Repeat, but press Escape before releasing | The held press is replayed against what the earlier write left, so the two gestures compose rather than the second being refused; and the Escape'd one is abandoned and never replayed | A press buffered against a design that has since moved. `DesignerSelectTool.hold` is the buffer, and `designerWriteChain.test.ts` "builds a drag held behind a write on a peer write that landed during the hold" and "is abandoned by Escape, and never replayed" are the two arms. Replay is also still CONDITIONAL — the same file's "stays conditional on the design it was replayed on" — so a replay cannot become the silent overwrite C08 forbids |
| 17 | `obsidian` | Drag the bowl once and let it settle (call this G1). Now open the `.rpgeo` in the text editor, change one footprint coordinate by a few units — keep the JSON **valid** and leave `schemaVersion` at 4 — and save. Wait about two seconds, then drag the bowl again and let that settle (G2). Now press **Undo** twice | The first Undo succeeds and reverses G2. The **second Undo refuses**, with a toast reading *"This change was edited elsewhere after this step, so undoing it would discard that edit. Reload and undo again if you still want it reversed."* Your hand-edited coordinate is still in the file afterwards | C08's *"Do not blindly restore old snapshots over a newer external edit during undo"*, at the one door where it can be reached by hand. G1's inverse is a whole-document snapshot taken before your edit, so applying it would delete your edit with nothing reporting anything. `WriteLedger.observe` is what notices — G2's pre-read disagrees with what this history last wrote, so the generation moves and every inverse below it is refused. `reversibleAssetDesignWindows.test.ts` "refuses the first gesture undo rather than restoring a document that predates a peer" is that case; the sandwich ordering is load-bearing and its docblock explains why a single-gesture version of this step would prove nothing |
| 18 | `suite` | Read what the refusal in step 17 actually offered, against what a conflicted WRITE offers | `undo.superseded` is the one refusal on this surface that carries real recovery copy — it names the consequence and tells the user what to do. A conflicted or failed **write** carries none: `asset-geometry.external-modification` maps to *"This entry was edited outside the plugin. Reload and try again."* in the locale table, and that sentence never reaches the user, because `reportDispatchFailure` routes a write-boundary refusal to `AUTOSAVE_SINKS`, whose `saveState` door is a no-op. Two words, **Save error**, is the whole of it | The difference between the two being invisible. `undo.superseded` is `Validation` and deliberately NOT a write-boundary code — `WriteLedger`'s own docblock says so, because it wrote nothing — which is why it takes the toast door while the write refusals take the badge. This row asserts nothing new; it is where U05's "recovery instructions" clause is measured, and the measurement is that one of the two paths has them |
| 19 | `obsidian` | On **asset B**, press **Remove reference**, let it settle, then apply **fault 3**: set the read-only attribute on asset B's `.rpgeo`. Now press **Undo** | The background **comes back** on the canvas and the header reads **Save error**. The calibration does **not** come back — the Reference section's Scale row still reads "Not calibrated". Nothing anywhere names the half-restored state | **The second recorded hole**, and the only place in this case where the vault is left genuinely incoherent. `ReversibleAssetBackgroundEdit.undo` restores the note and then the sidecar; the note restore lands and the sidecar restore refuses, so it returns `markUncompensated`, which sets `unrecoveredWrite` on the save-state store. **That flag is drawn by nothing on this surface** — its five readers are all Plan Editor modules — so the user gets the same two words any ordinary failure gives. Record exactly what you see; do not assert a warning the code does not produce |
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

## Deliberately NOT checked

- **Two leaves on one asset, and the expected-version conflict between them.**
  [[Two designers on one asset]] owns that whole scenario, including whether Obsidian offers a
  second leaf on a third-party `ItemView` at all. Step 17 reaches the same refusal machinery
  through a text editor instead, because a hand edit is the version of a foreign write one walker
  can produce reliably — and because the `WriteLedger` cannot tell the two apart by construction.
- **The exact sequence "our write landed, our read-back failed".** Refused as unwalkable above,
  with the two reads that make it so. The state it produces is walked at steps 7 to 12 through the
  sidecar subscription; the SEQUENCE is not, and no step here claims it was.
- **Making `unrecoveredWrite` visible, or proposing where it should be drawn.** Step 19 records
  what the build does. The flag exists, is set by this surface and is read by five Plan Editor
  modules; closing that is an increment with its own argument.
- **Whether the plan editor shows any of this differently.** [[Recover from a stale read]] is that
  surface's own case and is the model this one was written against. The two are deliberately not
  merged: the designer's gate is strictly weaker — no strip with buttons, no paused controls, no
  **Try again** — and a shared case would have to say "except here" at every row.
- **A sidecar whose `assetId` declares a different asset.** It is refused
  (`asset-geometry.asset-id-mismatch`) and it is a copy-a-file-and-rename-it fault rather than a
  recovery one; `assetGeometrySidecar.test.ts` "refuses a sidecar that declares a different asset"
  covers it and no screen is involved.
- **Colour contrast, hit-target size and any theme other than the default.** The standing exception
  every case in this suite carries.

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| — | — | **Not yet run in a vault. No step above has been walked.** Every row is an expectation derived from the module source, its English copy and the tests named in the rows — never from memory of any of them. The `suite` rows' tests were run (`npx vitest run` over `designerRefresh`, `designerWriteChain`, `assetDesignerRoot`, `assetDesignerView`, `designerCrossLeaf`, `assetGeometrySidecar` and `reversibleAssetDesignWindows`) and all passed at the time of writing; that establishes the assertions exist and hold, not that the vault behaves as the `obsidian` rows say. Record the fault setups used, the Obsidian version and the platform — steps 2, 3 and 19 all rest on an OS read-only attribute, whose behaviour is not the same on Windows and macOS. |

## Outcome

Written after the first walk: which steps passed, whether the read-only attribute produced a write
refusal at all, whether an externally edited `.rpgeo` reached the leaf, and anything only a live
vault showed.
