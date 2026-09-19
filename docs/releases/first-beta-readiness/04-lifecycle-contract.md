# Lifecycle contract — pending edits and commands at lifecycle boundaries

BP-03 Action 1. Built 2026-09-18 at `136e27b3a` from three independent reconnaissance passes plus
controller verification of every claim this document rests a decision on.

**Read the status column as a measurement, not as a promise.** Where a cell says UNVERIFIED it is
because the answer depends on ORDER — what is created before what, whether a value is seeded once
or read live — and this repository has already been burned by answering such a question from a
static trace. A chain traced statically tells you what reads what, and nothing about WHEN.

## The five disruptive actions, mechanically

| Action | Mechanism | What is destroyed | What survives |
|---|---|---|---|
| **Settings change** | `SettingsTab.setControlValue` to `saveSettings` to `applySettings` (`RenovationPlannerPlugin.ts:659`) to `rebindOpenViews` (`:807`). Each `rebind` is `deps = …; unmount(); sync()` | The whole Vue app AND its whole Pinia — `createPinia()` is called per mount. Undo history, camera, selection, perspective, layout mode, Konva stage, runtime subscriptions. Any open dialog is cancelled **unconditionally, `busy` included** (`DialogHost.vue`, `onBeforeUnmount`) | Obsidian view state (no rebind touches `planId` or `projectId`), view-owned fields deliberately kept off Pinia, persisted panel widths |
| **Perspective switch** | Three modes in the `renovation-session` Pinia store (`renovationSession.ts:5-7`), switched at `renovationActions.ts:95` | Perspective-gated `v-if` subtrees; an in-progress curve edit | Camera, history, selection. It **refuses while a dialog is open or a save is in flight**, and confirms before discarding a tool draft. Persisted nowhere — a rebind or reopen returns to the first mode |
| **Width change** | `ResizeObserver` to `layoutModeFor` (900/400, `layoutMode.ts:10-17`) to Pinia to template gating | **Exactly one thing unmounts: the canvas slot**, gated `v-if` on the layout mode not being `unsupported` (`shell/ResponsiveEditorShell.vue:168`), releasing its pointer gesture | Both side panels and their slot content are `v-show` (`shell/EditorSidePanel.vue:12`), so an Inspector form keeps its text and its input node. Regions gated `v-if="full"` (`:85`, `:112`) do unmount in constrained mode |
| **Close / reopen** | `onClose` to `unmount()` plus `contentEl.empty()`; Obsidian reuses the view object | Everything in progress | `getState()` only (`planId`, `origin`, `unrecoveredWrite`; `projectId` plus route; `assetId`), view-owned fields, panel widths in device storage |
| **Plugin unload** | `onunload` (`RenovationPlannerPlugin.ts:1007`) sets `unloaded` and drains exactly **five** disposers: Konva global, notice queue, editor icons, `SessionStores`, cascade | Those five | It unmounts **no Vue app and detaches no leaf**, leaving `registerView`, `addCommand` and `registerEvent` to Obsidian's own teardown |

## The one fact that decides most of the table

`createPinia()` is called in exactly four places, all inside a view's `mount()`
(`PlanEditorView.ts:455`, `RenovationProjectView.ts:349`, `AssetLibraryView.ts:282`,
`AssetDesignerView.ts:230`), and `rebind()` is `unmount(); sync()`.

**In this codebase a Pinia store has exactly the same lifetime as a component `ref`.** "It is in a
store, so it survives" is false here. `save-state-store.ts:100` says the same of its own ref. Any
lifecycle reasoning that treats Pinia as the durable tier is wrong before it starts.

## Where each state lives, and what that costs it

| State | Where held | Kind | Survives remount |
|---|---|---|---|
| Clean idle | `PlanEditorView.ts:246` and `RenovationProjectView.ts:153` `getState`; `continueContextStore`; `editorViewPreferencesStore` | Obsidian view state plus per-device localStorage | **Yes** (identity and preferences) |
| Unsaved form | `use-form-commit.ts:72`, `use-field-commit.ts:111`, hand-rolled refs | component `ref`, every one | **No.** No persistence anywhere |
| Pointer preview | `render-state.ts:72` via `runtime.ts:653`; tool private fields (`draw-polygon-tool.ts:144-164`); `room-draft-store.ts` | reactive class plus tool instance plus per-mount Pinia | **No**, by design |
| Command pending | nowhere — the promise lives in the async call frame; `serial-queue.ts:19` holds a tail, `save-state-store.ts:38` a count | none | **The write survives; the knowledge of it does not** |
| Stale read-back | `ProjectStore.ts:244` `stale`, assembled into `runtime.ts`'s `writesBlocked` | per-mount Pinia | **No — a remount silently clears the refusal, and the fresh hydrate cannot reproduce it.** `handleFailedRead` sets `stale` only while `status` is `ready`; a fresh store starts `idle`, so the identical refusing read routes to `fail()` instead. Measured, BP-03 / F2 |
| Unresolved incident | `write-incidents.json`; module global `WriteIncidentRegistry.ts:206`; leaf field via `getState` | disk plus module global plus view state | **Yes**, all three levels — **but it was NOT surviving plugin unload until BP-03 / F3 fixed it.** The module global was released while every view was still mounted and dispatch-capable, and this row asserting Yes at all three levels is exactly why nobody looked |

Exactly one unsaved-work guard exists in the whole codebase: `libraryDraftGuard.ts`, Asset Library
only, a confirm-before-navigate — and it is itself per-mount.

## The contract

Stated as rules rather than as a cell-by-cell table of today's behaviour, because a table that
enumerates code goes stale and a table that states a rule does not. Each rule names the acceptance
criterion it serves.

1. **A write that has been dispatched is never reported as cancelled.** (no hidden write on cancel)
   A component disappearing does not cancel a command. Where the framework cannot wait for the
   command, the caller must be told an outcome that is not a clean cancel, so it cannot report an
   abort over a write that is still running.
2. **A retired context publishes nothing into a live one.** (no stale callback mutates a new
   context) A read or a command outcome belonging to a disposed root must reach that root's bus or
   nothing at all — never the replacement's.
3. **A refusal is not cleared by a remount.** (uncertain outcomes enter recovery rather than
   showing success) Any state that refuses writes — stale read-back, unresolved incident — must be
   re-derivable after a remount from a source that outlives the mount. Today the incident is on
   disk and in a module global; the stale read-back is neither, and that gap is rule 3's live
   exposure.
4. **Retained text stays with the entity it was typed for, or is discarded.** (retained text is not
   moved to another entity) A draft is never carried across a context change into a different
   target. Discarding is an acceptable answer; relocating is not.
5. **Undo history is per-leaf and ephemeral, and nothing may imply otherwise.** `CommandHistory` is
   built per mount. No UI string, no document and no docblock may promise a persistent undo stack.
6. **No global draft autosave is introduced to satisfy rules 1 to 4.** The smallest existing
   mechanism is preferred in every case. The mechanisms that already exist and are portable: the
   `defer()` idiom used throughout the close/reopen family, `libraryDraftGuard`'s
   confirm-before-navigate, and the perspective switch's existing refusal while a dialog is open or
   a save is in flight.

## What today's code does NOT satisfy

| # | Rule | Where it fails | Status |
|---|---|---|---|
| F1 | 1 and 2 | Settings rebind inside the window of a single `vault.create`: `DialogHost`'s `onBeforeUnmount` resolves a cancel while the write runs on. **Confirmed on a rig driving the real plugin and the real `applySettings` → `rebindOpenViews` chain:** the project IS created, under the **previous** default projects folder, and its creation event reaches the retired root's bus. **What happens to the list is a SPLIT, and the earlier wording here — "stale until the leaf is reopened" — is wrong in both arms.** It turns on whether Obsidian's metadata cache has parsed the note when `VaultChangeAdapter` processes the `create`. Cache warm: the entry is indexed into the new root, one `ProjectIndexEntryChanged` is published on the new bus, the rebound tree hydrates and the row appears unprompted — not stale at all. Cache cold: nothing is indexed and nothing is published, and **reopening the leaf does not fix it**, because `ListProjects` resolves through the Project Index and a fresh leaf reads the same empty index. In that arm it clears only at the next full index rebuild — the next settings save, a library migration, or in practice a plugin reload. The user is told nothing, the project exists under the old folder and the list never shows it, so they may create it again and end up with two | **Documented and deliberately unclosed.** Read the last case's docblock in `tests/presentation/dialogs/formBusy.test.ts` ("settles a BUSY dialog on unmount anyway") before reopening — four options were costed and the residual was accepted; deferring the rebind needs an `ItemView` liveness seam that does not exist. **Which arm production takes is UNVERIFIED** and belongs to the timing list below: Obsidian's `create` ordering against its parse and the adapter's 500 ms debounce decide it, and nothing here has been run in a vault |
| F2 | 3 | `ProjectStore.ts:244` `stale` is per-mount Pinia, so a settings change clears an active write refusal that the fresh hydrate cannot re-derive | **VERIFIED. Criterion 1 closed; rule 3 open by design.** Measured: the fresh hydrate reproduces nothing and both its terminal states are safe, either a failure screen or a legitimately current canvas. What was exposed was the TRANSIT between them, one whole vault read wide, in which `writesBlocked` was false and a dispatch into it executed. **BP-03 acceptance criterion 1 — no hidden write on cancel or reflow — is MET:** `writesBlocked` gained a `status !== 'ready'` term, so no write lands in that window, pinned by `tests/presentation/views/planEditorRebindRefusal.test.ts`. **Rule 3's re-derivability requirement is NOT met, and is deliberately declined.** Nothing durable was added: the refusal is not re-derived after the remount, it is REPLACED by a different refusal on a different ground that happens to cover the same interval. Re-deriving it would mean giving a stale read-back durable state it has never had, and that is a SCOPE decision rather than a refused mechanism — the earlier wording here cited BP-03 action 2 and rule 6 as refusing it, and neither does. Rule 6 refuses a global draft AUTOSAVE and prefers the smallest existing mechanism; `PlanEditorView.getState()` already persists `unrecoveredWrite`, a durable write refusal, by exactly that preferred mechanism. So rule 3 is reachable here and simply was not attempted in this change. No promise is made that it will be. So the *Stale read-back* row above still reads **No** under "Survives remount", and rule 3's own exposure sentence still stands — both deliberately |
| F3 | 3 | **CLOSED as a DEFECT, found and fixed; the test column is 1 of 6 and the rest is blocked on a scope decision.** `onunload` releases the write-incident registry while every view is still mounted and dispatch-capable, which disarms all three of its readers at once — `guardCommand` skips its refusal arm, the incident gate answers `false` through its `?? false`, and the recording arm stops recording. Driven on a rig using the plugin own registered view factory against a real repository stack: an identical `createZone` was refused before `onunload` and wrote a note after it, and an Undo refused before ran its inverse after. Fixed by not releasing an OPEN registry; a clean one still releases | **Fixed and locked** by `tests/plugin/unloadWithViewOpen.test.ts`. `openViewOnLeaf` is now in `tests/helpers/plugin.ts`, so the earlier Untestable today sentence no longer applies. **This row previously read 4 of 5 states and was wrong on BOTH numbers**: the axis is SIX states (five is the ACTION count, so the row read transposed) and no test in the suite both opened a view and called `onunload`, so it was zero. **Five of the six rows remain unwritten and deliberately so** — the other rules measure as not violated here, so cases asserting that would CERTIFY that a still-mounted view can write to the vault after `onunload` and succeed silently. Whether it may is a scope decision nobody has taken, tracked as L-21 |
| F4 | 1 and 2 | **CLOSED. No defect — all three arms were already clean and are now locked.** Driven with a real dispatch held open by `defer()`, never by setting a store: the perspective switch already refuses while a save is in flight; the width change needs no refusal, because everything the outcome touches lives above the canvas slot; and the settings rebind is **DISTINCT from F1 rather than its residual** — nothing resolves early, the outcome reaches its caller, and it touches nothing in the replacement tree | Locked by `tests/presentation/editor/pendingDispatchDisruption.test.ts`. **Two of its assertions have no available mutation** and are named in that file as locks rather than as demonstrated reds — honest spelling, and still two assertions nobody has watched fail. One usability finding recorded rather than fixed: the perspective refusal is entirely silent, and saying so would mint user-facing copy, which L-15 blocks |
| F5 | 1 and 4 | **CLOSED. No defect — locked.** A typed override draft survives the round trip below the floor and back on the SAME input node and commits to the requirement it was typed for; a part-drawn polygon that loses its canvas leaves the zone repository untouched; and a selection moved to another room after the width returns **discards** the draft rather than relocating it, which is the arm rule 4 forbids | Locked by `tests/presentation/editor/shell/widthFloorDraft.test.ts`, driven over REAL repositories — the shell suite own harness refuses every write, which would have made nothing was written vacuous there. **One brief premise refuted:** asking what happens if the selection changes while the canvas is unmounted is unreachable, because at that width the canvas is gone and both panels are `v-show`n false, so the relocation hazard is only askable on the way back up |

## Prose this document contradicts

`PlanEditorRoot.vue:488` and `UnreadableStrip.vue:71` both state that the constrained drawer
unmounts what it holds. There is no drawer: `shell/EditorSidePanel.vue:4` records replacing
`OverlayPanel` and `InspectorDrawer`, and `:12` states its slot is `v-show`n and never unmounted.
The conclusion each comment draws may still hold for a different reason — `:85` and `:112` are
`v-if="full"`, so those regions do unmount in constrained mode — so this is a wrong NAME and a
wrong MECHANISM above a possibly-right conclusion, repaired by re-deriving it rather than by
renaming the component. Prose only, no behaviour.

## Unverified timing questions, listed rather than answered

`onOpen` versus `setState` order; whether a pending flush completes before the root swap; whether
the rescan completes before the rebind; dialog cancel versus a caller's liveness check;
`ResizeObserver` firing mid-rebind; whether Obsidian calls `onClose` before `onunload`; the
`unloaded` flag versus an in-flight `onLayoutReady`; microtask ordering at `rebind()` against an
in-flight dispatch; whether Obsidian returns `getState()` to a detached leaf; whether a restored
leaf mounts before the incident registry's `seed()` resolves; **which arm of F1 production takes**
— Obsidian's `create` event and its asynchronous metadata parse against `VaultChangeAdapter`'s
500 ms debounce, which decides whether the rebound list is current or is stale until a plugin
reload.

**Nothing in this document has been run in an Obsidian vault.**
