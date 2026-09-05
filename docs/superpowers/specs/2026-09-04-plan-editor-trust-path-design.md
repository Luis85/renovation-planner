# Plan editor foundation, increment 3 — the trust path

**Date:** 2026-09-04
**Epic:** `docs/requirements/Plan editor.md` → Feature `Release hardening` (its first three PBIs) and
`Editor foundation` (the two Active task halves the read path left open about stale content).
**Baseline:** `main` AFTER the add-room pull request (`claude/plan-editor-add-room`) merges. This
increment gates Add's Create and Finish and reads `EditorRuntime.canCreateRoom`, none of which
exist on `main` today; see §12.
**Status:** proposed design. The implementation plan derived from it is
`docs/superpowers/plans/2026-09-04-plan-editor-trust-path.md` (to be written). Where this document
and the SDD disagree, the SDD is the authority; where it and a PBI under `Release hardening`
disagree, the PBI is.

## 1. What this increment delivers

This is the vertical-slice plan's checkpoint **C3 — the trust path**: *"Undo/redo/reload/failure
recovery pass. Can users trust the state across failure and time?"* Scenario D of that plan's §8
("Write succeeded, refresh failed") is its acceptance, and Scenarios A–C stay green under it.

A private renovator commits a room edit. The write lands. The read-back fails — the vault is
busy, a note is locked, a parse refuses. The floor they were looking at stays exactly where it
was, a strip above it says the view may be out of date and what to do, the status bar's save
state reads *Saved · refresh needed*, and every control that would write against what is on
screen says it is paused and why. Undo and Redo still work, because their inverse comes from the
history's own record and not from the screen. Try again re-reads and nothing else; a retry that
fails again says so, once, and keeps everything; a retry that succeeds clears the strip, the
label and every pause in one move. Open source note takes them to the floor's Markdown if they
would rather look for themselves.

When the WRITE is what fails — the room note is written and its geometry entry is refused — the
repository already puts the note back, and the editor reports one refusal over an unchanged
floor. When that restore fails too, the editor now SAYS so: the note is on disk without its
geometry, nothing here will pretend otherwise, and the strip names the condition and offers the
note. Today that case reports the same code and the same sentence as the recovered one.

### PBIs and tasks this increment closes or advances

| PBI (`docs/requirements/`) | Tasks (`docs/tasks/`) touched here |
|---|---|
| Recover safely from failed writes and stale reads | Model successful writes with failed read-back; Guard stale editing and retry hydration only; Exercise write compensation and interrupted recovery; Verify stale recovery in Obsidian |
| Undo and redo | Record editor writes in one shared history; Reverse and replay editor commands safely; Refresh history results without replaying writes |
| Reload the editor without losing room data | Prove the room note and sidecar round trip; Restore the room projection on editor reopen; Walk a room reload in a live vault |
| Inspect a selected room (Editor foundation, Active) | Preserve room inspection across layout and read changes — criterion 4's second half, "nothing is disabled while stale" |
| Open a floor plan in the Obsidian editor shell (Editor foundation, Active) | Render independent simultaneous persistent warnings — criterion 3's heading and busy clauses, criterion 6's keyboard-reach-an-action clause |

Not advanced here: any Spatial creation PBI (move, edit shape, delete); `Use the editor in
Obsidian themes and constrained layouts`, which is checkpoint C4's; the two application-layer
residues named in §11.

## 2. Decisions

### 2.1 The stale fact already exists, and nothing new writes it

`ProjectStore.stale` is set when a `keepPreviousOnFailure` read fails over a ready canvas and
cleared by the one read that succeeds (and by `fail()`, where the content goes with it). Its
docblock records three review rounds spent getting that lifetime right. Every mechanism below
READS that field; none writes it, and the store's status union does not grow — `keepPreviousOnFailure`
deliberately holds `status === 'ready'` so the canvas, the empty states and the Select-on-ready
watcher keep working, and a fifth status would reopen every `=== 'ready'` gate in the tree.

### 2.2 The gate is one decorator on the one dispatcher, and undo/redo pass through it

Every write in a Plan Editor leaf funnels through one wrapped dispatcher (`runtime.ts`). The
chain today is `CommandHistory` → `withEditorStateRefresh` → `withSaveStateTracking` →
`wrapDispatcher` → `mapDispatchFaults` (tools only). `withStaleGate(dispatcher, isStale)` is a
fifth member, placed AFTER the save-state tracker and BEFORE `wrapDispatcher`, so a refused
dispatch never opens a saving batch and the undo/redo flags still refresh. It:

- refuses `run` while `isStale()` with a RESOLVED refusal — a `ValidationError` literal with code
  `editor.stale-write-refused`, minted the way `deleteZoneFlow.ts` mints its own (there is no
  `validationError` factory in `application/errors.ts`, and presentation minting an `AppError`
  literal is this system's normal shape). Validation is a pre-write category in `affectsSaveState`, so the indicator settles neutral and
  the badge cannot move; the refusal reaches the user through `reportDispatchFailure`'s one toast
  or, at a field, through the field's inline error, exactly as any other refusal does;
- passes `undo` and `redo` through untouched. Their inverse is the ledger's snapshot, presented
  with the version the history recorded, and refused by the repository on a conflict — none of
  that reads the projection, so none of it is "unsafe" in the PBI's own definition ("an action
  whose correctness depends on the unavailable current projection"). They are also the way a user
  backs out of the write whose read-back failed;
- takes `() => boolean` and not the store, so its node test drives both arms with a flag.

Why one decorator and not five call sites: the Inspector's `toCommand`, the tools'
`commandDispatcher`, the delete action and room creation all dispatch through this one object
already, and a rule spelled at each door is a rule some door is not following.

### 2.3 Retry is the refresh, by construction

`withEditorStateRefresh` closes over an anonymous refresh (hydrate with `keepPreviousOnFailure`,
then `inspector.refresh()`). That closure becomes a named `refreshProjection(): Promise<void>` on
the runtime, and BOTH callers use it: the post-command refresh inside the queue, and the strip's
Try again. "A retry cannot replay the write" is then a fact about a signature — the function has
no command parameter — held by `tests/presentation/editor/type-safety.test-d.ts` rather than by a
sentence, and the e2e case additionally counts repository writes across three retries.

### 2.4 Retry in flight, and a retry that fails again

`ProjectStore` gains `refreshing: Readonly<Ref<boolean>>` — true from a hydrate's first line
until the read holding the LATEST ticket settles; a superseded read never clears it. No second
flag anywhere. The strip's stale row is `aria-busy` and its buttons `aria-disabled` while it
holds. A failed retry keeps the row (the `stale` fact is unchanged) and moves its message to
`editor.refresh-failed.again`, driven by a `retriesFailed` counter on the store that a successful
hydrate resets — so the accessible text changes exactly once per failed attempt, and the row's
DOM node survives because the strip keys on `w.id`.

### 2.5 Saved · refresh needed is derived, not a fifth save state

The write landed; `SaveState` stays `saved`. `SaveStateIndicator` reads `ProjectStore.stale`
beside the save state and shows `save-state.saved-refresh-needed` when both hold, emitting class
`rp-save-state-saved-refresh-needed`, whose stylesheet rule the existing selector test finds by
building the class from the template's own expression. `SaveStateStore` does not change: it has
no view of hydration and giving it one would make the indicator a second reader of the store's
tickets. The mark is the settled disc with the ring's gap — held still, distinct from all four.

### 2.6 Open source note is a context door, shaped like `closeLeaf`

`PlanEditorContext.openPlanNote(): Promise<void>` is partially applied in `PlanEditorView` from a
new `PlanEditorDeps.openNote(entityId: string): Promise<ProjectNoteOpenOutcome>`, which the
composition root binds to the existing `openProjectNote` — that function already resolves ANY
entity id through the index, so a plan's note needs no new infrastructure. The `unavailable`
deps bundle answers `'failed'` after notifying `settings.unrecovered`, the same refusal shape its
siblings use. A `'missing'` outcome (the note is gone) notifies `editor.source-note-missing`.

### 2.7 A failed compensation stops calling itself compensated

`ObsidianZoneRepository.compensateFailedSidecarWrite` returns `zone.sidecar-insert-failed` /
`zone.sidecar-update-failed` with the sentence "the note was compensated" WHETHER OR NOT the
restore succeeded; the failure is one log line. It returns `zone.sidecar-insert-uncompensated` /
`zone.sidecar-update-uncompensated` when the restore refuses, with a message saying the note was
NOT restored, stamped with `markUncompensated` (application territory the repository may import,
and the stamp `affectsSaveState` already reads). The recovered arm keeps its codes and sentence.
Both new codes get locale copy in both languages, naming the manual action: inspect the note.

### 2.8 The unrecovered condition is a warning row, cleared by the next successful write

`editorWarnings` gains an `unrecovered` row (severity `error`, first in order, before `stale`)
fed by a new `SaveStateStore.unrecoveredWrite: boolean`, set by `withSaveStateTracking` when a
refused result `leftWritesBehind`, cleared by `resolveOk` — a write that landed whole is the only
evidence the vault is coherent again. It carries Open source note and no retry: there is nothing
to re-read that would change it. It is NOT cleared by a successful refresh, which is the
difference from `stale` and the reason it is a separate field.

### 2.9 Which controls pause, and how each says why

One `runtime.writesBlocked: Readonly<Ref<boolean>>` (a computed over `stale`) and one reason id
minted in `PlanEditorRoot` (`useId()`), rendered once as a visually-hidden sentence
(`editor.paused.reason`) and pointed at by every paused control's `aria-describedby`:

| Surface | While stale |
|---|---|
| Add menu entries | each `aria-disabled` with the stale reason, the way unsupported entries already are; the menu still opens and Escape still closes it |
| Empty-state action (no rooms) | `aria-disabled` + reason |
| New-room Inspector: Create; banner: Finish | `aria-disabled` + reason, beside their own validity reason (`aria-describedby` lists both ids) |
| Room Inspector: Delete, assign, both override fields | `aria-disabled` + reason; a commit reaching the gate anyway refuses inline |
| Layer panel: Set scale | joins the reason mechanism it already has for "no background" |
| Canvas: a Select drag | the tool dispatches, the gate refuses, one toast; no ghost is drawn because `SelectTool` asks `context.writesBlocked` before starting a move preview — the one place a tool learns about it, through `EditorContext`, so a drag is not a promise the release cannot keep |
| Status bar | a hint line `editor.hint.paused` beside the pan hint; the indicator's fifth label (§2.5) |
| Undo, Redo | unchanged |

`aria-disabled` and never `:disabled`, per the add-room plan's own rule: a paused control stays
focusable so its reason can be read.

### 2.10 No schema change, no new write path, no new event

The round trip, the write path and every event are the add-room increment's and slice 8's.
`editorRoundTrip.test.ts` gains reopen cases and loses nothing.

## 3. Stores

**`ProjectStore`** gains `refreshing` (§2.4) and `retriesFailed` (§2.4); `hydrate`'s success arm
resets the counter, the keep-on-failure arm increments it only when `stale` was already true
(a first failure sets `stale`; a second is a failed retry). `reset()` clears both.

**`SaveStateStore`** gains `unrecoveredWrite` (§2.8) and two actions, `markUnrecovered` and its
clearing inside `resolveOk`. The exhaustive transition test grows one axis and stays exhaustive.

**`SelectionStore`**, **`EditorStore`**, **`InspectorStore`**: unchanged.

## 4. Runtime

`EditorRuntime` gains `refreshProjection`, `writesBlocked`, `openPlanNote` (forwarded from the
context so components need one injection) and nothing else. `buildRuntime` inserts the gate in
the chain (§2.2). `runtime.ts` is at its cap; the gate, the refresh extraction and the two new
members are EXTRACTED to `presentation/editor/staleGate.ts` and `presentation/editor/refreshProjection.ts`
before anything is added, the add-room plan's own move (`registerEditorTools.ts`).

`EditorContext` (the tool facade) gains `writesBlocked: () => boolean`, read by `SelectTool`
alone today (§2.9); `createEditorContext` threads it, so every fixture that builds a context is a
compile error until it decides — `tool-context.ts` and `calibrateHarness.ts` answer `false`.

## 5. Shell

### 5.1 Components

| Component | Change |
|---|---|
| `warnings.ts` | `EditorWarning` gains `actions?: readonly WarningAction[]` (`{ id, labelKey, run, busy }`); `unrecovered` row; `stale` row's message key follows `retriesFailed` |
| `PersistentWarningStrip.vue` | renders actions as `<button>`s inside the item, `aria-busy` on the item while `busy`, buttons `aria-disabled` while busy; the live region stays on the container |
| `SaveStateIndicator.vue` | fifth label (§2.5) |
| `StatusBar.vue` | `editor.hint.paused` while `writesBlocked` |
| `AddMenu.vue`, `PlanEditorRoot.vue` (empty-state action), `NewRoomInspector.vue`, `TemporaryToolBanner.vue`, `RoomInspector.vue`, `RequirementRow.vue`, `LayerList.vue` / `PropertyLayerPanel.vue` | `aria-disabled` + shared reason id (§2.9) |
| `PlanEditorRoot.vue` | mints the reason id, renders the hidden reason sentence in the `warnings` region, wires the stale row's actions to `runtime.refreshProjection` and `runtime.openPlanNote` |
| `PlanEditorView.ts` | `openPlanNote` partial application (§2.6) |
| `composition-root.ts` | `openNote` binding on `planEditorDeps`; `unavailable` refusal |

### 5.2 What the shell deliberately does not show

No modal, no toast for the stale condition itself (the strip is the surface; a toast would be
the double report slice 17 forbade), no per-control tooltip beyond the reason sentence, no retry
count in the copy (`t` interpolation exists but "tried twice" is not information the user can act
on), no automatic retry.

## 6. Strings

All in `en/editor.ts` and `de/editor.ts` unless noted: `editor.stale-write-refused` (the toast
and inline sentence: "Editing is paused until the floor is re-read"), `editor.paused.reason`,
`editor.hint.paused`, `editor.refresh-failed.again` ("Re-reading failed again; what you see may
still be out of date"), `editor.warning.retry` (reuses `view.failure.retry`'s "Try again" — a
separate key on purpose, because the strip's button and the failure panel's may diverge),
`editor.warning.open-source-note`, `editor.unrecovered` ("A change was written but could not be
completed or undone; inspect the floor's note before editing further"),
`editor.source-note-missing`; in `en.ts`/`de.ts`: `save-state.saved-refresh-needed`
("Saved · refresh needed"), and the two uncompensated codes' copy. German is formal; sentence
case in English; the middle dot in the save-state label is the component library's own spelling.

## 7. Write faults: what is proved

Three editor-level detonation cases in `planEditorRig`, each against the wired editor:

1. **Sidecar refused after the note, restore succeeds.** Zero zones in the repository, one
   refusal surfaced, the badge settles where the tracker's existing rules put a Persistence
   refusal, no `unrecovered` row.
2. **Sidecar refused, restore refused.** The note remains, the result carries the uncompensated
   stamp, the `unrecovered` row is drawn with Open source note, `save-error` sticks, and a later
   successful write clears the row.
3. **Scenario D end to end.** Create a room; the read-back refuses; the room is in the
   repository and the pre-command scene is drawn; Add's entries, Delete and Create are
   `aria-disabled` with the reason; a Select drag draws no ghost and commits nothing; Undo
   removes the room (live while stale); Try again refuses once (message moves to `.again`,
   node identity kept), then succeeds; the strip, the label, and every pause clear; the write
   count across all of it is exactly what the gestures owed.

The rig models the sidecar join through the in-memory repositories today; case 1 and 2 drive
`ObsidianZoneRepository` directly against `FakeVault` in the repository's own suite, because the
compensation is that class's and the rig does not have a sidecar to refuse. Case 3 is the rig's.

## 8. Undo, redo and reload: what is pinned

Undo and redo's mechanisms exist; the criteria the PBI names and nothing pins get a case each in
`tests/presentation/editor/history.e2e.test.ts`: one inverse per Undo counted at the repository;
a new action after Undo empties the redo branch; a no-write success (assign of an already-linked
asset) creates no entry and leaves the badge; a revision conflict on Undo surfaces once and
leaves `canUndo` true (the recorded `undo.superseded` behaviour, pinned as such rather than
fixed); an Undo whose refresh fails marks stale and Try again re-reads only (4b). Keyboard reach
is the context bar's two buttons; no hotkey.

Reload: `editorRoundTrip.test.ts` gains the reopen through `PlanEditorView` (same id, name, type,
four points and area after unmount and a fresh mount over the same vault); a draft in the room
store is never persisted (the store is per leaf and dies with it — asserted by reopening and
finding no draft); a restored view state naming a deleted zone opens in Select with every valid
room drawn (the existing retirement rule, asserted from the reopen side).

## 9. Testing

| layer | cases |
|---|---|
| store | `refreshing` true across an in-flight read and false only when the latest ticket settles; `retriesFailed` increments only over an already-stale store and resets on success; `unrecoveredWrite` set by a stamped refusal, cleared by `resolveOk`, untouched by `resolveNeutral` and by a successful hydrate; transition test extended |
| gate | `run` refuses while stale and passes otherwise; `undo`/`redo` pass both ways; the refusal is neutral to the badge (mutation: swap the category to Persistence and watch the badge case go red) |
| refresh | `refreshProjection` is the same function the post-command path calls (spy identity); type test: its parameter list is empty |
| warnings | order `unrecovered`, `stale`, …; the stale row's key follows `retriesFailed`; actions and busy flow through |
| strip (jsdom) | buttons rendered per action, `aria-busy` and `aria-disabled` while busy, live region still on the container, node identity kept across a message change |
| indicator | fifth label and class; selector test extended |
| surfaces (jsdom) | each row of §2.9's table: `aria-disabled` and `aria-describedby` present while stale, absent otherwise; the reason element exists once; `SelectTool` draws no ghost while blocked |
| repository | both compensation arms return distinct codes; the uncompensated one carries the stamp |
| e2e | §7's three cases; §8's history and reopen cases |
| accessibility (axe) | the stale strip with two buttons; the Room Inspector with every control paused; the constrained drawer in the same state |
| build | both locales complete (the interpolation-hole and completeness tests, unchanged); every new stylesheet class declared; the two new codes are rows in `toUserMessage.test.ts`'s table, copied from the repository's raise sites |
| harness | `?stale` knob: mounts with a query bundle whose second `getPlan` refuses, then triggers one refresh; shots `plan-editor-stale` (1280) and `plan-editor-stale-narrow` (460), read by eye — the strip's two buttons and the fifth label are on screen at rest |
| manual | `docs/tests/cases/Recover from a stale read.md` (a controlled live-vault fault: lock the plan note, edit, observe, unlock, retry) and `Reload a room.md` (both reopen paths); both added to the smoke census |

## 10. Escape and focus

Escape's routine is unchanged. After Try again succeeds the stale row unmounts with its buttons;
focus, if it was on one of them, moves to the strip container (which gains `tabindex="-1"`) in
the row's `onBeforeUnmount`, the same recovery the add-room spec gives the banner and the form.
A paused control keeps focus and keeps its reason readable; nothing here moves focus on the
transition INTO stale.

## 11. Residues, stated so they are not read as forgotten

- **A successfully recalculated reassignment cannot be rolled back** and **two marker failures
  read as an interrupted sequence** — both PRE-EXISTING, both application-layer, both named in
  `docs/superpowers/plans/2026-09-03-the-lock-publish-boundary.md`'s "Not in scope" and in
  CLAUDE.md. This increment surfaces an unrecovered result; it does not change what produces one.
- **The gate cannot see a write that bypasses the dispatcher.** `notifyFault`'s raw ports and
  the plugin's `set-plan-background` command are outside the leaf's chain today, as CLAUDE.md
  records; the manual case's "unsafe menu, command, keyboard and pointer paths" clause is
  checked against the doors that exist, and that list is written in the case.
- **Undo while stale can itself go stale.** Its refresh runs through the same keep-on-failure
  read, so a second failure leaves `stale` true and `retriesFailed` at 2 — designed, and pinned.
- **`refreshing` is one flag for two readers.** The strip's busy state and any future consumer
  read the same field; a per-caller busy state was refused as a second answer to one question.
- **No automatic retry, no backoff.** A vault that stays unreadable is a fact for the user, not
  a loop.

## 12. Sequencing

1. **Gate**: the add-room pull request merged; branch `claude/plan-editor-trust-path` from
   `main`. If it is not merged, STOP — this increment edits `runtime.ts`, `NewRoomInspector.vue`,
   `TemporaryToolBanner.vue`, `AddMenu.vue` and `PlanEditorRoot.vue`, all of which that branch
   is changing.
2. **Wave 1** (pure and jsdom, no shell): the two `runtime.ts` extractions; `withStaleGate`;
   `refreshProjection`; store fields; `SaveStateStore.unrecoveredWrite`; the repository code
   split; `EditorContext.writesBlocked` and `SelectTool`'s check.
3. **Wave 2** (shell): strings; warnings model and strip actions; indicator label; status hint;
   every paused surface; `openPlanNote` door through view and root.
4. **Wave 3** (proof and record): e2e detonations, history and reopen cases, accessibility,
   harness knob and shots, two manual cases, PBI/task/Feature statuses, CLAUDE.md section.

## 13. Risks

| risk | control |
|---|---|
| `runtime.ts` trips `max-lines` | two extractions BEFORE the first addition, as their own step |
| The gate refuses a redo whose refresh is the thing that went stale | undo/redo bypass the gate by construction; a case drives stale → undo → redo |
| A paused control is `:disabled` somewhere and unreadable | one jsdom case per surface asserts `aria-disabled` and the absence of `disabled` |
| `refreshing` stays true after a superseded read | the store case drives two overlapping reads and asserts the flag clears with the LATER one |
| The unrecovered row is cleared by a refresh | its case asserts it survives a successful hydrate and clears only on `resolveOk` |
| Coverage headroom of about one unit | every task names its arms and their tests; no guard whose other arm is unreachable |
| The rig cannot refuse a sidecar | §7 cases 1–2 live in the repository's own suite against `FakeVault`; the rig owns only case 3 |

## 14. Out of scope

Automatic retry; a `'stale'` status; a fifth `SaveState`; hotkeys for Undo and Redo; a source-note
door for any entity but the plan; any fix to the two application-layer residues; snapping, move,
resize and delete PBIs; C4's theme, constrained-layout and usability acceptance; any schema
change, migration, repository method or event.

## Amendments

**2026-09-05 — §8, four claims measured FALSE while building the cases it asks for.** None is a
production defect; each is the code deliberately doing otherwise, with the reason written where the
code is, and the cases pin what is true. They are recorded here and in
`docs/requirements/Undo and redo.md` because the next reader meets the cases before the reasoning
and would otherwise read them as drift:

1. **"Removing `withStaleGate` reddens the 'commits nothing' and 'Delete is paused' assertions."**
   It reddens NEITHER. `SelectTool.pointerDown` returns early on `context.writesBlocked()`, and the
   paused attributes come from each component reading the same computed — so **the gate and the
   control guards are defence in depth over one outcome, and removing either alone leaves that
   outcome green.** `stalePath.e2e.test.ts`'s third case exists for exactly this: driven at
   `runtime.createRoom()` past every `aria-disabled` control, it is the only case in either e2e
   file that mutation reddens.
2. **"A no-write success creates no history entry."** `CommandHistory.runNow` says the opposite in
   as many words — *"A gesture that wrote nothing still goes on the undo stack: it happened, and
   asking to undo it is legal."* The case pins the documented behaviour with the instrument that
   can see it (the following Undo pops the NO-WRITE assign and leaves the requirement standing);
   the half that IS the PBI criterion — no badge moves — is kept and made discriminating with a
   REAL standing `save-error` behind it.
3. **"A revision conflict on Undo surfaces once as a toast."** It raises no toast at all.
   `zone.external-modification` is one of `WRITE_BOUNDARY_CODES`, so `affectsSaveState` carves it
   back out of the pre-write categories and it flips the BADGE — and `reportDispatchFailure`
   routes it to the `autosave-write` origin whose toast sink is deliberately a no-op, per slice
   17's one-failure-one-widget rule. The badge is the whole surface. The case asserts
   `Notice.shown` is unchanged **over a live queue**, since over an inactive one that absence is
   true of every build ever written.
4. **"A restored view state naming a deleted zone."** Cannot be written as stated: a restored
   `setViewState` carries a plan id and nothing else, and a selection dies with the leaf's Pinia.
   The case is written from the half observable at a reopen and says what it does not reach.

**2026-09-05 — §2.7 stands UNAMENDED, and the plan's own fallback is moot.** The implementation's
first pass dropped `zone.sidecar-update-uncompensated` as unreachable and flagged this section for
an amendment saying so. Controller Ruling 6 rejected that: the code was unreachable against the
FAKE rather than in production. A one-shot `failOnce` set keyed `<op>:<path>` cannot separate an
update's own `writeOwnedFrontmatter` write from its restore — both are `modify:<notePath>` — but a
COUNTED failure can, and hit 2 of that key on an update is the restore, with the sidecar mutation
between them keyed elsewhere. `FakeVault.failOnHit` is that primitive (`failOnce` retired: it had
zero real call sites, and a one-shot is the degenerate `failOnHit.set(key, 1)`), both codes ship,
and the case proves the counting positively — the note on disk still carries the FAILED update's
new name, so hit 1 landed and only hit 2 refused. **This paragraph is a NOTE and not a change:
§2.7 as written is what shipped.**

**2026-09-05 — deviations from this document, each with its reason.** Every one was taken
deliberately and none changes what the section asks for:

- **§2.9's reason id is minted in `runtime.ts`, not in `PlanEditorRoot`** (controller Ruling 2).
  `useId()` inside `buildDispatcherChain`, which `buildRuntime` calls synchronously in setup; both
  spellings yield one id per leaf and every consumer reads it off the runtime.
- **§4's conditional `deleteZoneAction.ts` extraction was NOT performed** (Ruling 3): `runtime.ts`
  measured 321 counted lines before and **366** after, under the 380 threshold. A different budget
  bit instead — `buildRuntime`'s own `max-lines-per-function` — and the answer was the
  `buildDispatcherChain` extraction named above, which is the file's own existing pattern.
- **§2.6's `PlanEditorDeps.openNote` returns `ProjectOpenOutcome`, not `ProjectNoteOpenOutcome`.**
  The named type lives in `infrastructure/`, which `presentation/` may not import;
  `AssetLibraryDeps.ts`'s own docblock already declares the third copy of that union and predicts
  that the next one should share. It imports the sibling `presentation/` type instead of minting a
  fifth.
- **§2.9's layer-panel formula is `hasReference && writesBlocked ? paused : none`**, not the
  spelling this document implies: the literal `!hasReference ? … : paused` answers the paused
  reason whenever a background exists, even unblocked, which falsifies the pre-existing "offers Set
  scale when a background exists" case.
- **§6's `editor.paused.reason` uses the sentence-case fallback wording** — *"Editing is paused:
  the floor could not be re-read after the last change. Retry from the warning above."* — because
  `obsidianmd/ui/sentence-case-locale-module` fails the build on a capitalised `Try` mid-sentence,
  the same measurement the Shift-constraint hint already paid for.
- **§2.4 and §3 spell the new store fields `Readonly<Ref<…>>`; they ship as plain `Ref`**, matching
  every other exposed ref in every store in this codebase. A per-field exception would have been a
  new convention for two fields.
- **§9's accessibility row lives in a NEW file.** The three scans would have pushed
  `tests/harness/accessibility.test.ts` from 450 to 459 counted lines, so they are
  `tests/harness/accessibilityTrustPath.test.ts`, sharing `runOptions` from `./axeOptions` exactly
  as `accessibilityAssetLibrary.test.ts` already does. No violations in any of the three.
- **§9's harness row describes a knob that does not work.** Arming a call-counting `getPlan` and
  triggering the second read through the view's `onPlanChanged` listener cannot set `stale`:
  `PlanEditorRoot.hydrate()` passes no `keepPreviousOnFailure`, so a failure there calls `fail()`
  and blanks the floor. `?stale` drives a REAL successful write instead — it selects a sacrificial
  zone and clicks the Inspector's own Delete, whose zero-referent branch dispatches with no dialog,
  and the automatic post-command `refreshProjection` is the read the knob fails. Both captures were
  taken with the PINNED Chromium, so neither carries an approximate-build caveat.
- **§9's refresh row asks for identity held by a SPY.** Identity is held by CONSTRUCTION today —
  one `const` handed to both callers — plus call-count assertions. A spy would additionally catch a
  future second closure; left standing below.

**2026-09-05 — what the captures showed.** `plan-editor-stale` (1280, light) and
`plan-editor-stale-narrow` (460, dark) were read by the controller. At 1280 the strip's sentence
and both buttons sit on one line, the status bar carries the paused hint and
`Saved · refresh needed`, every Inspector section reads *Not available yet*, and Delete is present
and paused. At 460 the strip wraps to two lines (sentence, then both buttons) — acceptable — with
the drawer open over the canvas showing the paused Inspector. **One layout defect was found by
reading them and fixed**: the Layers panel rendered *"No reference plan has been added to this
floor."* TWICE, once as the entry's own reason and once as the new per-action reason span carrying
the same key. **One residual was found and is NOT fixed here**: at 460 the status bar CLIPS its
hint text, so the paused hint is not visible in a narrow leaf, while the strip and the save-state
label still carry the fact. It belongs to `docs/tasks/Build full and compact editor status bars.md`
and is step 4b of `docs/tests/cases/Recover from a stale read.md`. The *Harness: light/dark* badge
overlapping the save-state label in both shots is pre-existing harness furniture, verified against
untouched captures.

**2026-09-05 — deferred minors, left standing.** Each was raised in review, judged not worth the
round, and is written here rather than lost:

- `selectTool.test.ts`'s comment about releasing the click "so no stale gesture can leak" is
  misleading under `writesBlocked` — no gesture was ever built. Cosmetic.
- `withEditorStateRefresh` (the wrapper, not `createProjectionRefresh`) has no production caller
  left; it is kept alive by its own test file and by the docblocks that name it. Retire it or
  repoint it in a later task.
- `mountStatusBar` is a local helper inside `statusBar.test.ts`; it could move to
  `tests/helpers/editor.ts` once that file is free.
- The strip's busy case asserts `aria-disabled` on `buttons[0]` only; `buttons[1]` would widen it.
- `tests/harness/fixture.ts`'s `openPlanNote` door is type-checked and not asserted, matching that
  fixture's other doors.
- The accessibility file's third case copies its drawer-presence assertion from a relied-upon
  sibling pattern rather than watching that one assertion red independently.
- `AddMenu`'s unsupported-AND-blocked combination is untested, and the "everything live again"
  case samples one control rather than every one it cleared.
- `runtime.ts`'s `pausedReasonId` is minted inside `buildDispatcherChain` rather than
  `buildRuntime` directly, which stretches Ruling 2's wording; the one-id-per-leaf constraint holds.
- `PlanEditorRoot`'s `retry` and `openSourceNote` closures `void` their promises. Traced rather
  than left open: `createProjectionRefresh` and `openProjectNote` resolve on every arm, so neither
  is a detached rejection today. If either starts throwing, both owe `runDetached` handling.

**2026-09-05 — the gates.** Wave 1's gate was RED at lint on two size caps, both in one task's
files (`ProjectStore.ts`'s setup arrow at 106 against a 100-line function cap, and
`stores.test.ts` at 531 against 450) and GREEN after the extraction of `runHydrationReads` and the
split of `stores.test.ts` into `projectStore.test.ts`. Wave 2's gate was RED on ONE test — an
`assetPriceList.test.ts` case reading `.rp-visually-hidden` from `styles/asset-prices.css` after
this increment moved that rule to its own partial — and the repair found that a SECOND reader in
the same file had been passing for the wrong reason, matching a comment that spelled the class with
its leading dot rather than a real declaration. Coverage at the green Wave 1 gate: statements
99.31, functions 99.14 (about **three** covered units above the 99 floor), lines 99.59, branches
98.27. `dist/main.js` measured **945.60 kB (gzip 284.50 kB)** at the Wave 2 gate of the trust path
(2026-09-05); read that as the size on that day rather than as a standing total.
