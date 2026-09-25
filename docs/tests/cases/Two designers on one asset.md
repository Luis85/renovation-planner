---
type: Test case
parent: "[[Smoke Test the Editor]]"
order: 84
sources:
  - C08 — persistence, history and failures ("two leaves editing one asset must not cause silent overwrite")
  - AD15 validation matrix row T12, minimum layer "Integration + real host"
  - ADR-0015 — the designer is per-asset, keyed by an `assetId` in Obsidian's own view state
  - AD03 — one write chain per leaf, undo/redo barriers, no recursive enqueue
  - Asset designer symbols design spec, Amendment 1 (a gesture is conditional on the design its PRESS read) and Amendment 2 (one write chain per leaf)
  - SDD §65 (a refusal is a `Result`, a throw is a fault) and §66 (the surface policy)
status: Ready
---

# Two designers on one asset

Matrix row **T12**, walked in a real vault: two Asset Designer leaves showing ONE asset, and
what the expected-version condition does when they disagree. Contract C08 is the authority —
*"External edits, moved/deleted notes, plugin unload and two leaves editing one asset must not
cause silent overwrite. Preserve original versions/intent, report conflicts and refresh or
recover explicitly."* Every leaf in the automated suite is a `FakeLeaf` that records asks
rather than behaving, so the two-leaf half of that sentence has been observed by nothing, ever.
That is a structural blindness rather than thin coverage, and it is what this case is pointed
at.

**Read the gate first. Nothing in this plugin opens a second leaf on one asset**, and that is
by construction rather than by omission. **Four** user-facing doors open a designer on an asset
and all four end at one `revealAssetDesigner`, which filters `getLeavesOfType` by the leaf's own
persisted `assetId` and reveals the first match without re-setting its view state: the palette's
**Open asset designer** (`assetDesignerCommands.ts`); the asset library inspector's **Edit
shape**; the Renovation project view's create-asset flow; and the **Plan Editor's placement
Inspector**, which offers a placed asset's designer through `EditorNavigation.asset`. The last
three are not merely the same function but the same BINDING — `renovationProjectOpenAsset`,
bound at the composition root, in `assetLibraryDeps.ts` and in `editorWorkspaceNavigation.ts`.
The list is here so the claim is checkable; the claim is that there is one decider, which
`grep -rn revealAssetDesigner src/` answers.

So a second leaf can only come from **Obsidian's own tab split or a restored workspace layout**,
and whether the host offers that for a third-party `ItemView` is host behaviour this repository
cannot settle. `revealAssetDesigner.ts`'s docblock anticipates *"a vault reopened onto two Asset
Designers"* and nothing has ever seen one. **Step 1 is where that is found out, and it names
exactly which rows survive a failed answer** — most of this case does not, but four steps do.
A step 1 that finds nothing is a finding for the Runs table, not a failed walk.

**Its sibling is [[Recover an asset design rather than lose it]]** (matrix row U05), which works
in ONE leaf throughout and cedes this whole scenario here. The two meet at exactly one place and
it is named in both files: **that case's step 17 is this case's step 11**, reached with a text
editor in place of a second leaf. Walk one of the two, not both — step 11 says which to prefer.

Preconditions: `npm run test-build`, this folder open as a vault, the plugin enabled, and a
**desktop** Obsidian (`AssetDesignerView.sync` draws a refusal and mounts nothing while
`Platform.isMobile`, and the palette command hides itself there). Two assets, both made by hand
from the Renovation project view's **New asset** button:

- **Asset K** — the asset every step below is about. In its designer, **Start from preset →
  Toilet**, so it carries a footprint AND a separate bowl detail. The bowl is what every drag in
  this case grabs; it is the same shape the suite's own two-leaf rig drags, which is what makes
  the citations below comparable to what you see.
- **Asset L** — anything at all, for step 6 alone.

## Why a human is the only instrument for eight of these sixteen

Derived from the table below rather than remembered: eight rows carry a verdict other than
`suite`, and the eight are 1, 2, 8, 10, 11, 14, 15 and 16. Each is a fact about the HOST, about
real hardware, or about an eye:

1. **Whether two leaves on one asset can exist at all.** This is the premise of row T12 and no
   code in this repository decides it. Step 1. **There is no fallback for it** — step 2 asks
   whether a pair PERSISTS, which presupposes one — so step 1 carries the map of what survives a
   failed answer instead.
2. **Whether Obsidian's own pointer capture survives a click in another leaf.** The conflict
   window is a HELD gesture (below), so producing it means holding a press in one leaf while
   something writes in the other. Whether a second pointing device can do that inside one
   Chromium window is not a question any fake answers. Step 8, and it is the only `desktop` row
   here.
3. **Whether anything at all tells the user their edit was refused.** The suite can assert that
   no `Notice` was raised and that the badge says `save-error`. It cannot answer whether a
   person looking at the leaf they were dragging in NOTICES two words in the header. Step 10 is
   written as a judgement for that reason.
4. **What a real `Notice` looks like, and that there is one at all for the sandwiched undo.**
   The browser harness declares no `.notice` and no `.notice-container` rule — measured, not
   assumed — so `npm run harness` cannot show a toast at any width. Step 11 is the only
   instrument in this repository for the one refusal on this path that speaks in a sentence.
5. **Whether a write from outside the plugin reaches the same refusal.** `observed` is a digest
   of the sidecar's bytes, so a foreign rewrite is detectable in principle; whether Obsidian's
   file watcher, a sync client or an external editor produces the byte change at the moment the
   held gesture needs it is a vault fact. Step 14.
6. **What is actually on disk afterwards.** Every version count in the suite is taken at an
   in-memory or probe store. Step 15 counts revisions in the real sidecar.
7. **Whether a leaf closed and reopened rejoins the conversation.** `assetIdOf` reads the LEAF's
   persisted state rather than `leaf.view`, precisely so a deferred or restored leaf still
   matches — which only a real workspace restore exercises. Steps 2 and 16.

## The conflict window, and the fault setup

**The obvious first guess is the wrong one, and it is worth stating before you waste an
afternoon on it.** "Edit in both leaves and save" cannot produce a conflict, because there is no
save: an idle second leaf does not hold a stale version to write from. `updateAssetShape`
publishes `AssetDesignChanged` on its write arm, every leaf subscribes through
`createAssetDesignChangeSource`, and each one calls `refresh()` within a tick — a re-read that
keeps the previous design on failure, never a `hydrate` that blanks it. So the second leaf is
already looking at the first leaf's change before you can reach it. Step 5 is that, asserted.

**The window is a HELD GESTURE.** `DesignerSelectTool.begin` captures
`design.geometryVersion` at the pointer-DOWN and `commit` passes exactly that value as
`expected`; the Bend/Curve gesture does the same. Every OTHER write door on this surface reads
the version INSIDE its queued step — `createEditShape` reads `design()` after the chain has
drained, which is what makes the arrow keys, the canvas's Delete and Ctrl+D, the selection
inspector, the Arrange and Clearance panels and both draw tools compose with a peer rather than
race it. Their window is sub-millisecond and not reproducible by hand. Preset, **Edit
dimensions**, background and undo/redo pass no `expected` at all and fall back to the version
their own read returned.

So the one hand-reproducible recipe is: **press and hold a drag in leaf B, make a write in leaf
A, release in leaf B.** Three ways to make the peer write happen while a press is held, and
**record which you used in the Runs table** — they are not interchangeable:

- **Primary — two pointing devices.** Press and hold the bowl in leaf B with one device (a
  laptop trackpad, a trackball, a second mouse), then with the other device drag the bowl in
  leaf A and let that write land. Release in leaf B. The risk is the host's, not the plugin's:
  Chromium may merge two mice into one `mouse` pointer, in which case the click in leaf A ends
  the drag in leaf B and there is nothing to release. Record what happened.
- **Alternative — touch and mouse.** On a touchscreen desktop, hold the bowl in leaf B with a
  finger (a `touch` pointer, tracked separately from the mouse) and click-drag in leaf A with
  the mouse. Cleaner in principle and untried here.
- **Alternative — an external write on a timer, which produces the OTHER refusal.** Stage a
  shell command that rewrites the asset's `.rpgeo` sidecar after a delay, start it, then press
  and hold in leaf B and release once it has fired. This needs no second leaf and no second
  device, and it yields `asset-geometry.external-modification` rather than
  `asset-geometry.revision-conflict` — `checkExpectedVersion` compares `revision` first, then
  the `observed` digest. It is listed because it is the only one-handed route to the window at
  all, and step 14 is where it is walked deliberately.
- **NOT a fault setup — opening the same asset twice from the plugin.** Every door reveals the
  existing leaf, and two clicks in one tick are coalesced by an in-flight map keyed on the view
  type plus the state that would be set. Steps 3 and 4 are that, asserted, and they are here so
  that nobody tries it as a setup.

**And there is a second, entirely one-handed route to the T12 territory that needs no racing at
all**: the SANDWICHED UNDO of step 11. It is sequential, deterministic, and it is the only
refusal on this whole path that speaks to the user in a sentence.

## Steps

Each step carries a `Reachable by` verdict — the cheapest instrument that could discharge it as
written. [[Smoke Test the Editor]]'s *The triage column* section defines the five values and
what they do not claim.

| # | Reachable by | Do this | It passes when | It exists to catch |
| --- | --- | --- | --- | --- |
| 1 | `obsidian` | Open Asset K's designer. Then try, in order, every way Obsidian offers to duplicate that leaf: right-click the tab → **Split right**, **Split down**, **Move to new window**, and dragging the tab into a new split. **Record which of them produced a second Asset designer tab drawing Asset K, and which produced nothing or an empty leaf** | At least one of them leaves you with TWO leaves, both drawing Asset K's toilet. Call them leaf A and leaf B. **If none does, that sentence — with the gestures you tried — is what this case found**; record it in the Runs table and in the Outcome, and then walk only what survives. **Unwalkable without a pair: 2, 3, 5, 6, 7, 8 and 16.** **Still walkable: 4** (it needs no pair at all), **14 and 15** (the timed external write needs neither a second leaf nor a second device), **then 9, 10, 12 and 13 off the badge step 14 leaves** — read "leaf B" as "the only leaf" in each. **Step 11 also survives, through that same external write** — but in that form it IS [[Recover an asset design rather than lose it]]'s step 17, so walk it there and record here that you did | The premise of matrix row T12. A second designer on one asset cannot be produced by any control this plugin owns: `revealAssetDesigner` filters `getLeavesOfType` by the leaf's persisted `assetId` and `revealCandidate` reveals the first match without calling `setViewState` on it. `revealAssetDesigner.ts`'s own docblock anticipates "a vault reopened onto two Asset Designers" — this step is the first time anybody has checked that such a thing can exist |
| 2 | `obsidian` | With both leaves open, quit Obsidian and reopen the vault | Both leaves come back, both drawing Asset K. Neither is empty, neither shows a refusal, and neither has forgotten which asset it holds | **A pair PERSISTING, which is not the same question as a pair being obtainable** — this step presupposes what step 1 produced and cannot make a first one, so it is not step 1's fallback and nothing here is. `AssetDesignerView.getState` writes `{ assetId }` (with `''` as the sentinel for a leaf holding none) and `assetIdOf` reads the LEAF's state rather than `leaf.view`, deliberately, so a restored leaf whose view has been deferred still answers. `assetDesignerView.test.ts` "carries the open asset in its own view state, so a workspace restore reopens the same asset" drives the round trip against a fake leaf; a real restore is what this adds |
| 3 | `suite` | With two leaves on Asset K open, run **Open asset designer** from the command palette and pick Asset K again | No THIRD leaf appears. One of the two existing leaves is revealed, and the one revealed keeps the pan, zoom, selection and active tool it already had | A reveal that rebuilds a pane the user has already set up. `revealCandidate` deliberately calls `setViewState` only on a leaf it CREATED. `revealAssetDesigner.test.ts` "reuses the leaf already showing that asset rather than opening a second" and "does not re-set the view state of a leaf it found". Which of the two is revealed is not asserted anywhere and is not asserted here either |
| 4 | `suite` | Double-click **Edit shape** in the asset library's inspector for Asset K, as fast as you can | Exactly one leaf is revealed. No duplicate tab appears | The double-click defect this plugin has already shipped three times in three different doors: a leaf a call creates does not answer `getLeavesOfType` until its own `await` resolves, so two activations in one tick both find nothing and both create. `revealCandidate` holds an in-flight map keyed on the view type PLUS the state that would be set, asked before the candidate lookup. `revealAssetDesigner.test.ts` "coalesces two opens of the SAME asset into one leaf" and "still gives two DIFFERENT assets their own leaves when they race" |
| 5 | `suite` | Put leaf A and leaf B side by side. In leaf A, drag the toilet bowl one clear step. **Do not touch leaf B** | Leaf B's canvas redraws with the bowl in its new place within a moment; leaf B's header still reads **Saved**; no notice appears anywhere; and leaf B's own pan, zoom and selection are untouched | The belief this whole case has to dislodge first: that two leaves on one asset means a conflict. It does not — `updateAssetShape` publishes `AssetDesignChanged` on the write arm and each leaf's `onDesignChanged` calls `refresh()`, a re-read that keeps the previous design when it fails rather than blanking the canvas. `designerCrossLeaf.test.ts` "refreshes a second leaf on the same asset"; `designerRefresh.test.ts`'s *a refresh a PEER leaf provoked* block, including "keeps the design on screen when a peer-provoked re-read fails, and marks it stale". **Read those two citations narrowly — the pass condition above is wider than either.** The first asserts `reads` equals two entries: two re-reads were ISSUED, and nothing about the canvas drawing the new shape, the header still reading Saved, no notice appearing, or leaf B's camera and selection surviving. The second covers the FAILURE arm. So the redraw and the three survival clauses are `suite`-reachable and `suite`-unasserted, which is the same gap step 7 states about the same properties: nothing in `tests/` drives two MOUNTED designer leaves against each other |
| 6 | `suite` | Open Asset L's designer beside the other two, then drag Asset K's bowl again in leaf A | Asset L's leaf does not redraw at all | A bus subscription that announced "something changed" instead of "THIS asset changed", which would make every design edit in the vault re-read every open designer. `designerCrossLeaf.test.ts` "leaves a leaf on a different asset alone" |
| 7 | `suite` | In leaf A select the footprint; in leaf B select the bowl and switch to a different tool. Then compare the two leaves | Each leaf keeps its own selection, its own active tool, its own camera and its own **Saved** word. Nothing you do in one moves any of them in the other | Two leaves sharing a store. Each mount runs `app.use(createPinia())`, so the design store, the save-state store, the command history and BOTH write ledgers are per leaf — which is the whole reason step 11 works the way it does. `saveStateStore.test.ts` "gives each Plan Editor its own state, since two can save independently" holds the indicator half against two store instances. **Stated as a gap**: nothing in `tests/` drives two MOUNTED designer leaves' cameras and selections against each other, so the composite is `suite`-reachable and not `suite`-asserted today |
| 8 | `desktop` | **The step this case exists for.** Using one of the setups named in *The conflict window* above, press and hold a drag on the bowl in leaf B — moving it a clear distance, not a click — and, without releasing, make a write in leaf A. Then release in leaf B. **Record which setup you used and whether the held press survived at all** | Leaf B's header reads **Save error**. Leaf A's still reads **Saved**. Leaf B's canvas shows leaf A's change and NOT your drag. Nothing anywhere is paused, no dialog appears, and the asset's stored shape is leaf A's | C08's silent overwrite, at the one window a person can hold open. `DesignerSelectTool.begin` captures `design.geometryVersion` at the press and `commit` passes it as `expected`; the geometry store compares it inside its own per-asset queue, so read and compare are inseparable, and refuses with `asset-geometry.revision-conflict`. `designerWriteChain.test.ts` "stays conditional on the design it was replayed on, so a peer write during the live replayed drag refuses it" drives exactly this ordering and asserts the `save-error` state; `setAssetFootprint.test.ts` "refuses the second of two writes built from the same revision, rather than losing one" asserts the stored shape is unchanged, because the refusal alone would be equally true of a build that wrote and then reported. What only a host adds is two real leaves, two real Pinia instances and Obsidian's own pointer capture |
| 9 | `suite` | With the **Save error** still showing in leaf B, look everywhere for an explanation: a toast, a strip above the canvas, a **Try again**, a dimmed control, anything in the Inspector | **There is none, and this is the RECORDED HOLE rather than a failure.** The two words **Save error** in leaf B's header are the entire account the user gets. No notice was raised, nothing is paused, nothing offers a retry, and the header does NOT read *Saved · refresh needed* | The hole silently closing or silently widening. `reportDispatchFailure` asks the same predicate the indicator asked: a conflict is category `Validation`, but `affectsSaveState` carves the write-boundary codes back out of the pre-write set (read from `WRITE_BOUNDARY_CODES`, not a copy), so it routes to the `autosave-write` origin, whose surface is `save-state`, whose sink in the designer is a deliberate no-op — the toast branch is never taken. **That chain is covered by tests COMPOSING, not by one case, and the row says so because it would otherwise read as though a single case walked it.** `designerRefresh.test.ts` "leaves a write-boundary refusal to the indicator rather than toasting it twice" is the badge-and-no-toast half at this surface — but its fixture is `{ category: 'Persistence', code: 'vault.unexpected-failure' }`, which reaches `affectsSaveState`'s true arm through `!PRE_WRITE_CATEGORIES.includes('Persistence')` and **not** through the write-boundary carve-out. `withSaveStateTracking.test.ts` "reads the codes from versioning.ts rather than a copy" pins the carve-out at the predicate, one layer below any surface. And `designerWriteChain.test.ts` "stays conditional on the design it was replayed on…" (step 8's citation) drives a REAL conflict through a real mounted designer and asserts `save-error` — but asserts nothing about notices. **So no single case in `tests/` takes a real `asset-geometry.revision-conflict` all the way to "badge, and no toast" on this surface**, and that is exactly the seam this step is the instrument for. **The sentence that would explain this exists and is unreachable here**: `error.suffix.revision-conflict` reads *"This entry changed elsewhere in the meantime. Reload and try again."*, and the asset library and the rotation dialog both surface their conflicts visibly. A step asserting the designer did would be asserting a guarantee the code does not make. And `save-state.saved-refresh-needed` **cannot be produced by this surface at all**: `SaveStateIndicator` derives it from `useProjectStore().stale` and the planning read state, neither of which the designer's own Pinia ever hydrates |
| 10 | `judgement` | Now answer what step 9 collected the evidence for, from memory of the moment rather than from the paragraph above: **while you were dragging in leaf B, would you have noticed that your edit did not land?** And having noticed the badge, could you tell from the leaf alone what happened and what to do next? | Record the answer in prose. Say whether your eye went to the header at all, whether **Save error** read as being about the gesture you had just made or about something older, and what you would have tried next. There is no pass condition here and no instrument that can supply one | The one thing about this hole that no gate, no capture and no assertion can settle, and the input the decision to close or keep it actually needs. A step claiming "the badge is clearly visible" would be an appearance nobody has seen |
| 11 | `obsidian` | **No racing needed for this one.** In leaf A, drag the bowl (gesture 1). Wait for leaf B to redraw. In leaf B, drag the bowl somewhere else. Wait for leaf A to redraw. In leaf A, drag the bowl again (gesture 2). Now press **Undo** in leaf A TWICE | The first Undo succeeds: gesture 2 is reversed and the canvas returns to leaf B's version. The second Undo is **refused, and a real notice appears**, reading *"This change was edited elsewhere after this step, so undoing it would discard that edit. Reload and undo again if you still want it reversed."* Leaf A's shape is unchanged by the refusal | C08's last sentence — *"Do not blindly restore old snapshots over a newer external edit during undo"* — and the one refusal on this whole path that speaks to the user in a sentence, which is the contrast that makes step 9 mean anything. The ledger generation gesture 1 ran under travels beside its inverse; gesture 2's own execute observed the peer's version and moved the generation on, so gesture 1's inverse is known to describe a state that no longer happened. Restoring a whole document cannot merge, so refusing is the only answer that discards nobody's edit. `undo.superseded` is category `Validation` and is NOT a write-boundary code, which is precisely why it takes the toast door that step 9's conflict does not. `reversibleAssetDesignWindows.test.ts` "refuses the first gesture undo rather than restoring a document that predates a peer" drives this exact five-move sequence; what a host adds is that a `Notice` really renders — the browser harness declares no `.notice` rule at all, so no capture in this repository can show one. **Walk this step OR [[Recover an asset design rather than lose it]]'s step 17, never both**: that case's is the same five moves, the same refusal, the same sentence and the same cited case, with the foreign write coming from a text editor instead of leaf B — and the `WriteLedger` cannot tell the two apart by construction, which is why one walk settles both. Prefer this one only while you already have a pair from step 1; prefer that one otherwise, since it needs no pair, no second device and no timing. **What this variant adds over that one is narrow and worth naming: that a peer LEAF's write moves the ledger generation exactly as a foreign file write does** — the two enter through different subscriptions and nothing asserts they land the same |
| 12 | `suite` | Back in leaf B, still carrying **Save error** from step 8, press **Edit dimensions** and retype the width and depth already shown. Save | Nothing is written, nothing is refused, no notice appears — and **Save error is still there**. The badge did not clear and did not change | The trap a walker falls into by repeating a gesture "to check it still conflicts". Identical geometry short-circuits to `no-write` BEFORE the port is reached, so there is no version comparison to fail — `samePolygon` uses `coincident`, so even a sub-nanometre difference counts as unchanged, and a stale expectation makes no difference either. `setAssetFootprint.test.ts` "reports no-write when the rectangle asked for is the one already stored" and "reports no-write for an identical footprint even when the expectation is stale". The badge standing is the correct half: a batch that wrote nothing reverts the indicator to what it said before the batch opened, because only a write that actually succeeded may clear a save error. `withSaveStateTracking.test.ts` "settles run NEUTRALLY for a SUCCESS that wrote nothing"; `saveStateStore.test.ts` "preserves a save error across an overlapping batch that writes nothing" |
| 13 | `suite` | Now make a REAL edit in leaf B — drag the bowl a clear step, on the version leaf B is now showing | It lands, and leaf B's header returns to **Saved**. Leaf A redraws with it | The other half of the same rule, and the contrast that makes step 12 mean something: a badge that cleared on a no-write would be a false all-clear over an edit that was genuinely refused, and a badge that never cleared would be a dead widget. `saveStateStore.test.ts` "lets a write that actually succeeded clear a save error" |
| 14 | `obsidian` | The other refusal code. Stage a command that rewrites Asset K's `.rpgeo` sidecar after a delay — changing a coordinate, leaving the `revision` number exactly as it is. Start it, then press and hold a drag on the bowl in leaf B and release once it has fired | The same two words, **Save error**, and the same silence — no toast, nothing paused. The stored shape is the one the external write left, not your drag | That `external-modification` and `revision-conflict` are indistinguishable to the user on this surface, which is a fact worth having recorded rather than inferred: `checkExpectedVersion` compares `revision` first and the `observed` byte digest second, and mints two codes because "the caller's recovery differs" — while the designer gives both the same silent badge. It also checks the half of C08 that names EXTERNAL edits beside two leaves, and it is the only route to the held-gesture window that needs one hand and one device |
| 15 | `obsidian` | Open the asset's `.rpgeo` sidecar in the file explorer and read its `revision` number. Count back over everything you did in steps 5, 8, 11, 12, 13 and 14 | The revision equals the number of writes that actually LANDED, and no more: nothing was written twice, the refused drags of steps 8 and 14 left no trace, the no-write of step 12 left none, and the refused undo of step 11 left none. The shape on disk is the one both leaves are drawing | The successful write occurring more than once, and a refusal that wrote and then reported. Every version count in the suite is taken at an in-memory store or a probe; this is the only place the real file is counted. It also catches the quieter one: a refused write that still bumped a revision would make the NEXT gesture in either leaf conflict for no reason anybody could see |
| 16 | `obsidian` | Close leaf B. Make three separate edits in leaf A. Then obtain a second leaf on Asset K again by whichever gesture step 1 found | The new leaf B draws the CURRENT shape, not the one it had when it was closed; leaf A behaved normally throughout, with no notice and no error while no second leaf existed; and a drag in leaf A now refreshes the new leaf B exactly as step 5 did | A subscription that outlived its leaf. `EventBus.subscribe` removes a handler on `dispose` and by no other mechanism, so an undisposed one keeps a dead leaf's whole Pinia reachable and issues a design read from it on every later edit — one more per designer the user has ever opened. `designerCrossLeaf.test.ts` "does not refresh a leaf that has been closed" and "leaves nothing subscribed once every leaf is closed" hold it against mounted runtimes; what a real close-and-reopen adds is Obsidian's own leaf lifecycle around it |

## Deliberately NOT checked

- **The mobile refusal.** `AssetDesignerView.sync` mounts nothing while `Platform.isMobile` and
  the palette command hides itself there, so a second leaf on a phone is a question about a
  surface that does not draw. [[Read projects on mobile]] owns the platform gate.
- **Whether the conflict SHOULD be silent.** That is a decision, not an observation. Step 9
  records what the build does and step 10 records what a person made of it; neither asserts
  which is right.
- **Two leaves on two DIFFERENT assets writing at once.** They share no resource — the geometry
  store queues per asset id — so there is nothing to conflict. Step 6 is the only part of that
  worth a walk.
- **Everything [[Recover an asset design rather than lose it]] walks in ONE leaf.** That case
  owns the failed write, the failed read-back with work still on screen, the undo pressed before
  a write has settled, the close-and-reopen, the plugin unload and the note moved or deleted
  underneath the leaf. It cedes the two-leaf scenario here and this file repeats none of it. The
  single overlap is its step 17 and this file's step 11, named in both rows; **walk it once.**

## Automated in Obsidian

**Added 2026-09-25.** `tests/e2e/twoDesigners.e2e.ts`. The pair comes from `app.workspace.duplicateLeaf`; the
held gesture is one WebDriver action chain with a 2.5 s pause, and the peer's write arrives from a timer
inside the page or from the file system — the two things that can reach the vault while the driver is busy.

| Step | Clause | Discharged by |
| --- | --- | --- |
| 1 | at least one of Obsidian's own gestures yields two leaves drawing the asset | *splits a designer into a second leaf on the same asset with Obsidian's own Split, and restores both* — Split right, through its API |
| 2 | both leaves come back after a restart, neither empty nor refusing | same case |
| 5 | leaf B redraws leaf A's write; header still Saved; no notice | *redraws the peer on a write, and DROPS a drag held across one — no write, no badge, no toast* — B's Position X follows, B's header is the plain "Saved" of a leaf that never wrote |
| 5 | B's own pan, zoom and selection survive | none — the selection is re-made to read the field; camera not read |
| 8 | B's header reads Save error | **finding — it reads Saved**; same case pins the measured outcome |
| 8 | A's header still Saved; B's canvas shows A's change and not the drag; the stored shape is A's | same case — all three hold |
| 9 | no toast, no strip, no retry, nothing dimmed, no qualifier | same case — trivially, since nothing was refused either |
| 11 | first Undo succeeds, second refuses with the sentence, shape unchanged | *refuses to undo a gesture the other leaf has written past, with a real notice* |
| 13 | a real edit in B lands and A redraws it | *redraws the peer…* — B's badge never rose, so "clears" is not observable here |
| 14 | an external same-revision rewrite under a held drag: Save error, silence, the stored shape is the external one | *refuses a drag held across an external rewrite with the badge alone, and writes nothing for it* |
| 15 | the revision equals the writes that landed; refusals leave no trace | every case above asserts the revision after each refusal; no separate count is taken over steps 5–14 in one vault |
| 16 | a reopened leaf draws the current shape; A behaved normally; a drag in A refreshes the new B | *draws the current shape in a leaf reopened after edits made while it was closed* |

**Added later on 2026-09-25 (W24-A).** `tests/e2e/twoDesignersMore.e2e.ts`. **Not yet watched red** —
the agent session's permission classifier refused the `src/` mutations (see W24-A's report).

| Step | Clause | Discharged by |
| --- | --- | --- |
| 1 | which of Obsidian's own gestures yield a second leaf | *duplicates a designer through the tab menu's Split right and Split down, and only moves it with Move to new window* — driven through the real tab context menu |
| 1 | dragging the tab into a new split | none — WebDriver cannot express Obsidian's tab drag-and-drop |
| 10 | "would you have noticed" | none — `judgement` |
| 15 | the revision equals the writes that landed across steps 5, 8, 11, 12, 13 and 14 in ONE vault; refusals leave no trace; both leaves draw the stored bowl | *counts on disk exactly the writes that landed across the whole walk, and both leaves draw what is stored* — revision 8 = the preset plus seven landed writes |

## Runs

| Date | Build | Outcome |
| --- | --- | --- |
| 2026-09-25 | W24-A — `npm run test:e2e` over `twoDesignersMore.e2e.ts`, Obsidian 1.13.7, Windows 11 | **2 passed**; mutation gate NOT run. Step 1: the tab menu's Split right and Split down each give a second leaf drawing the asset; Move to new window MOVES it (one leaf, in a popout). Step 15 counted in one vault: revision 8 equals the landed writes, the step-12 retype is a no-write. Instrument note: after a vertical split leaf A keeps its pre-split camera, so a computed bowl point falls outside it — the held drag is driven in leaf B. |
| 2026-09-25 | `npm run test:e2e` on this branch — Obsidian 1.13.7 driven by WebdriverIO, Windows 11, `--lang=en` | **Step 1 is answered: Obsidian's own `duplicateLeaf(leaf, 'split')` — the tab menu's Split right — produces a second Asset designer drawing the same asset**, and step 2's restart brings both back. Steps 5, 8, 9, 11, 13, 14, 15 and 16 are in `tests/e2e/twoDesigners.e2e.ts`, clause by clause below. **Step 8 is a FINDING, not a pass**: with a drag held in leaf B and leaf A's keystroke landing 900 ms into the hold (fired by a timer inside the page — the driver cannot interleave anything of its own with an action chain, measured), A's write lands, B redraws it, and B's held drag is **abandoned with no account at all** — nothing written, header still the plain `Saved` of a leaf that never wrote, no history entry, no toast. Not `Save error`. That is one step quieter than the silent badge step 9 records as the hole, and the case's own expectation is pinned the other way; the e2e pins what the host does, so whichever way the ruling goes the change is a red case. Step 14's external rewrite under a held drag DOES refuse with the badge alone, as written. Not walked: 3, 4, 6, 7, 10, 12. |
| — | — | **Not yet run in a vault.** Every row above is an expectation derived from the code, its English copy and the tests named inside each row — never from memory of any of them. Every `suite` citation was executed with `npx vitest run <path> -t "<case name>"` against the commit this case was written on and passed. Nothing here has been seen in Obsidian. Record: whether step 1 produced a second leaf and by which gesture; which of the three setups in *The conflict window* produced step 8's held press and whether the press survived at all; the Obsidian version and the platform. |

## Outcome

Written after the first walk: whether a second designer leaf on one asset can exist in
Obsidian at all, which fault setup produced the held-gesture conflict, what step 10's judgement
answered, and anything only a live vault showed.
