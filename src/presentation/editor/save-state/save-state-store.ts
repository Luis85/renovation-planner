import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { activeWriteIncidentRegistry } from '../../../application/incidents/WriteIncidentRegistry';
import type { SaveState } from './save-state';

/**
 * "Is this Plan's data safely written?", one instance per open Plan Editor.
 *
 * Per-view rather than plugin-global, and that follows from slice 6 rather than being a
 * preference: `CommandHistory` is scoped per open Plan, so the save state it produces is a
 * fact about THAT Plan's command history. Two editors on two plans can legitimately show
 * different states at once, one saving while the other is saved.
 *
 * **`pendingCount` exists because slice 6's choke point serializes per GESTURE, not
 * globally.** An Inspector field commit and a canvas gesture can each call the dispatcher
 * around the same time, so two commands can be in flight against one Plan Editor. Setting
 * `state` directly on each resolution would let the faster of two writes flip the indicator
 * to `saved` while the slower is still pending — reporting data as safely written before it
 * is. So a batch settles only when the last dispatch in it resolves, and one failure
 * anywhere in the batch decides the whole batch.
 *
 * This solves the INDICATOR, not the data. Two overlapping writes to one plan's geometry
 * sidecar is a lost-update hazard, and a counter in a Pinia store cannot prevent one — slice
 * 4's `PlanGeometryStore.mutate` serializes each plan's read-modify-write, and this store
 * assumes that guarantee rather than restating it. It would be wrong without it: an
 * indicator accurately reporting `saved` over silently lost data is worse than one that
 * misreports.
 *
 * **Nothing here produces `'unsaved-changes'`.** Slice 6's transaction boundary leaves no
 * moment where an edit has been decided and no command dispatched: a gesture's `pointerUp`
 * dispatches, and an Inspector field dispatches on blur or enter. There is no state between
 * "nothing decided" (still saved — a preview shape mid-drag has changed no persisted state)
 * and "a command is in flight" (saving). The value stays in the type and no action reaches
 * it, which `saveStateStore.test.ts` walks exhaustively rather than asserting here.
 */
export const useSaveStateStore = defineStore('rp-save-state', () => {
	const state = ref<SaveState>('saved');
	const pendingCount = ref(0);
	const hasErrorInBatch = ref(false);
	const hasWriteInBatch = ref(false);
	/** What the indicator read before this batch opened, for a batch that writes nothing. */
	const beforeBatch = ref<SaveState>('saved');
	/**
	 * **TWO facts, two refs, and the gate below is their OR.** They were one ref until
	 * 2026-09-17 and that was a defect rather than a simplification: one boolean was answering
	 * "did THIS leaf leave a write behind?" and "is the VAULT paused?", and each consumer got
	 * whichever answer the other question had already written.
	 *
	 * **`leafOwn` — did this leaf leave a write behind that its compensation failed to undo?**
	 * Set by `markUnrecovered()` alone. Distinct from `save-error`, which any refused write
	 * raises and which the NEXT successful write clears for the ordinary reason — this one is
	 * about the vault's coherence.
	 *
	 * **`vaultPaused` — does the vault hold an open write incident (ADR-0034), so `guardCommand`
	 * refuses every guarded write in it?** Seeded from `activeWriteIncidentRegistry()?.anyOpen()`
	 * while the store is being created, and set afterwards by `markVaultPaused()`, which
	 * `withSaveStateTracking` calls on the gate's own `WRITES_PAUSED_CODE`. It may be true
	 * because of a write on another plan, in another project, or in an earlier session.
	 *
	 * **Ruling R1 (2026-09-05) is now STRUCTURAL rather than a rule to remember**: each ref is
	 * written in exactly one place, each with the literal `true`, so neither can go back down and
	 * the OR of two monotonic values is monotonic. There is no `= false` to audit for and no
	 * `resolveOk` arm to get wrong — the shape carries the guarantee the ruling used to carry on
	 * its own. The reasoning for sticky-over-clearing still holds and is below.
	 *
	 * **Why they may not share a ref, in the two directions the shared one broke.**
	 *
	 * A seeded `vaultPaused` used to be `unrecoveredWrite`, so `PlanEditorView.mount`'s later
	 * `markUnrecovered()` for this leaf's own incident changed nothing, its watcher — which fires
	 * on a CHANGE — never ran, and the leaf's own incident never reached the field that rides
	 * `getState()` into Obsidian's persisted layout. In the other direction, the gate-refusal
	 * catch-up would have marked this leaf for an incident some other leaf raised, persisting a
	 * stranger's incident into a field that is never unset — where removing the incidents file
	 * could not clear it. `tests/presentation/views/planEditorIncident.test.ts` holds both
	 * directions.
	 *
	 * `DraftRecovery.vue` reads `leafUnrecoveredWrite` for a third reason on the same axis:
	 * ADR-0034 gates COMMANDS and keeps queries working, and that panel's fourth site removes a
	 * READ retry.
	 *
	 * **`unrecoveredWrite` is the GATE**, the OR, and the name every write-blocking consumer
	 * already reads. Measured in the edit that split the refs rather than remembered:
	 * `grep -rl "unrecoveredWrite" src/ --include=*.ts --include=*.vue | wc -l` prints **11**
	 * files, this module included — a FILE count, so unlike the two caller greps below it is not
	 * inflated by the sentence quoting it. Of the other ten, SEVEN read this gate —
	 * `presentation/editor/runtime.ts` (`unsafeHistory`), `presentation/designer/runtime.ts`
	 * (the `EditorContext.writesBlocked` it builds), `presentation/views/work/
	 * projectWorkActions.ts` (`paused`), `presentation/views/work/ProjectWorkState.vue`,
	 * `presentation/editor/PlanEditorRoot.vue` (the paused reason, and the input it hands
	 * `editorWarnings`), `presentation/editor/elements/elementActions.ts` and
	 * `presentation/editor/elements/rotationActions.ts` (each an `inputBlocked`). The remaining
	 * three do NOT read it: `presentation/editor/forms/DraftRecovery.vue` reads
	 * `leafUnrecoveredWrite`, `presentation/editor/shell/warnings.ts` reads its own INPUT field
	 * of that name, and `presentation/views/PlanEditorView.ts` owns a PRIVATE field of that name
	 * and watches `leafUnrecoveredWrite`. The docblock this replaced said "the three that own a
	 * WRITE GATE"; that was an undercount of the behavioural consumers, and this sentence is
	 * written from the grep above rather than from it.
	 *
	 * **The other half of the old R1 note — "sticky for the MOUNT's life" — is not where the
	 * leaf's incident lives.** `leafOwn` is built fresh with every `createPinia()`, so on its own
	 * it would lose the warning on any `saveSettings` (`rebind` -> `unmount()` -> `sync()` ->
	 * `mount()`, for every open Plan Editor leaf, whichever setting changed). What closed that
	 * window is `PlanEditorView`'s own `unrecoveredWrite` field: the leaf holds the incident
	 * beside its `planId`, in Obsidian's view state, `mount` SEEDS this ref from it through
	 * `markUnrecovered`, and a watcher there hands a newly raised incident back. So `leafOwn` is
	 * the mount's REPORT of the leaf's incident rather than the record of it.
	 *
	 * Read the resulting guarantee at the leaf, at exactly this width. It survives a settings
	 * rebind, and a close-and-reopen that REUSES the view object (`onClose`/`onOpen` on a tab
	 * that stays in the layout) — both of which this repository drives. A leaf DETACHED and
	 * reopened from the palette, and an application restart, are a different mechanism: the field
	 * rides `getState()` and nothing more, so the incident comes back if and only if Obsidian
	 * hands that state to the new leaf. Obsidian does not run here and `FakeLeaf` records asks
	 * rather than performing them, so that half is Obsidian's behaviour and not a checked claim —
	 * either way nothing manufactures an all-clear: a leaf that comes back without the state
	 * comes back clean, exactly as one does today.
	 *
	 * **`vaultPaused` is asked once, because there is nothing to subscribe to.**
	 * `WriteIncidentRegistry.record` publishes no event and holds a plain array, so a reader must
	 * poll or be seeded; seeding is the half that costs nothing per frame. The consequence is
	 * stated rather than hidden: an incident raised in ANOTHER leaf while this one is already
	 * mounted does not re-render this one's controls. That leaf catches up at its next write
	 * instead — `guardCommand` refuses it with `WRITES_PAUSED_CODE` and `withSaveStateTracking`
	 * calls `markVaultPaused` on exactly that code. Making the gate reactive needs a notification
	 * the registry does not have and is its own increment.
	 *
	 * **The seed also runs EARLIER than the registry's own file read, for a leaf Obsidian
	 * restores.** `RenovationPlannerPlugin` calls `void this.stores.writeIncidents.seed()` from
	 * `startPersistence`, which runs at `onLayoutReady`, and that same function's own comment
	 * records that Obsidian restores its leaves BEFORE `onLayoutReady`. A registry whose `seed()`
	 * has not resolved holds an empty list and answers `anyOpen() === false`, so a restored leaf
	 * seeds clean and is NOT paused from its first frame. It catches up at its first refused
	 * write, exactly as an already-mounted leaf does — the same non-reactive limitation reached
	 * from startup rather than from a peer. Nothing here reorders plugin startup to close it, and
	 * `saveStateStore.test.ts`'s un-seeded-registry case is what holds the mechanism.
	 *
	 * **What the seed still does NOT reach, because it reads the DURABLE record and not this
	 * process's other leaves.** An incident raised OUTSIDE a `guardCommand` call stack never
	 * becomes a durable record at all (ADR-0034's Consequences: every reversible adapter's
	 * `undo`/`redo` is outside the chokepoint, among others) — it marks the leaf that raised it,
	 * through `leftWritesBehind`, and no other leaf learns of it at that leaf's next write or
	 * ever, because there is nothing for the gate to refuse on. That residue is ADR-0034's stated
	 * coverage boundary, inherited here rather than introduced.
	 *
	 * And a write already IN FLIGHT when the settings are saved, whose compensation refuses after
	 * the remount: that `markUnrecovered()` lands on the retired store, which no watcher and no
	 * reader is left on. `PlanEditorView.rebind`'s docblock carries that window, beside the two
	 * sibling residues of the same remount. Narrowed rather than closed by the seed — if that
	 * compensation refused inside a guarded stack it recorded a durable incident, so the fresh
	 * store's `false` is corrected at the leaf's next write.
	 *
	 * The reasoning for sticky-over-clearing still holds inside one mount's life: the only
	 * in-session event that actually repairs a half-written vault is a successful retry of the
	 * SAME delete resolution over the SAME rows, and this wrapper cannot see either fact —
	 * `resolveOk` fires for ANY write that lands whole, undo/redo and an edit to an unrelated
	 * zone included, so treating it as proof of repair was exactly E3's defect. A stale warning
	 * is cheaper than a false all-clear. A successful REFRESH does not clear it either: reading a
	 * half-written vault back does not mend it.
	 *
	 * `tests/plugin/rootSwapRebind.test.ts` pins the rebind, and
	 * `tests/presentation/views/planEditorIncident.test.ts` raises the incident through the real
	 * dispatch path and walks the leaf's whole lifecycle with it.
	 */
	const leafOwn = ref(false);
	const vaultPaused = ref(activeWriteIncidentRegistry()?.anyOpen() ?? false);

	/**
	 * Settle the batch once its last dispatch has resolved, and reset for the next one.
	 *
	 * **Three outcomes, not two, and the third is the one that is easy to miss.** A batch that
	 * FAILED reports `save-error`; a batch that WROTE something reports `saved`; a batch in
	 * which nothing was written at all reverts to whatever the indicator said before it opened.
	 * Collapsing that third case into `saved` is a lie with a real victim: after a persistence
	 * failure has settled the store to `save-error`, a later field edit refused for validation
	 * writes nothing — and reporting `saved` for it tells the user the earlier failed write is
	 * now safe. Only a write that actually succeeded may clear a save error.
	 */
	const settle = (): void => {
		if (pendingCount.value > 0) return;
		if (hasErrorInBatch.value) state.value = 'save-error';
		else if (hasWriteInBatch.value) state.value = 'saved';
		else state.value = beforeBatch.value;
		hasErrorInBatch.value = false;
		hasWriteInBatch.value = false;
	};

	return {
		state: computed(() => state.value),

		/**
		 * **The write gate: are writes refused in this leaf, for either reason?** The OR of the
		 * two facts above, and the member every write-blocking consumer reads — the refs' own
		 * docblock names which modules those are and how that was measured.
		 */
		unrecoveredWrite: computed(() => leafOwn.value || vaultPaused.value),

		/**
		 * **Did THIS leaf leave a write behind that was never undone?** Narrower than the gate,
		 * and the answer a consumer needs when its subject is this leaf's own draft rather than
		 * whether writing is allowed — `DraftRecovery.vue`'s four sites, and the watcher
		 * `PlanEditorView.mount` installs to carry the incident into Obsidian's view state.
		 */
		leafUnrecoveredWrite: computed(() => leafOwn.value),

		/**
		 * **Does the vault hold an open write incident?** Wider than this leaf and durable across
		 * sessions. Exported so a consumer can tell the two halves of the gate apart, and so the
		 * suite can assert each ref's monotonicity separately.
		 */
		vaultWritesPaused: computed(() => vaultPaused.value),

		/**
		 * A new dispatch always shows `saving`. The state it replaces is remembered when the
		 * batch OPENS, so a batch that turns out to have written nothing can put it back.
		 */
		beginSaving(): void {
			if (pendingCount.value === 0) beforeBatch.value = state.value;
			pendingCount.value += 1;
			state.value = 'saving';
		},

		/**
		 * **THIS leaf left a write behind**, stamped by the site that wrote (`leftWritesBehind`).
		 * Never called for a gate refusal — that is `markVaultPaused` below, and keeping the two
		 * doors apart is the whole point of there being two refs.
		 *
		 * TWO callers, re-measured in the edit that split the refs —
		 * `grep -rn "\.markUnrecovered()" src/ | wc -l` prints **3**, and the third is the line you
		 * are reading, quoting its own command. The two CALLS are `withSaveStateTracking`, where a
		 * stamped refusal becomes this flag, and `PlanEditorView.mount`, which seeds a fresh store
		 * with the incident that leaf was already carrying. The second is why this stays an action
		 * rather than becoming `withSaveStateTracking`'s private business.
		 */
		markUnrecovered(): void {
			leafOwn.value = true;
		},

		/**
		 * **The VAULT is paused** — `guardCommand` returned its own `WRITES_PAUSED_CODE`, which
		 * says an open incident exists somewhere in the vault and says nothing about this leaf.
		 * The catch-up door for a leaf that was already mounted when a peer raised one, since the
		 * seed above reaches a store only at SETUP and the registry notifies nobody.
		 *
		 * ONE caller, measured in the edit that added it —
		 * `grep -rn "\.markVaultPaused()" src/ | wc -l` prints **2**, the second being this line
		 * quoting its own command. The one CALL is `withSaveStateTracking`.
		 */
		markVaultPaused(): void {
			vaultPaused.value = true;
		},

		/**
		 * A write landed whole. Clears NEITHER of the two facts behind the gate — see their
		 * docblock (R1): this wrapper cannot tell a repairing write from any other, so the gate
		 * stays shut for as long as the LEAF does.
		 */
		resolveOk(): void {
			pendingCount.value -= 1;
			hasWriteInBatch.value = true;
			settle();
		},

		/** A write may not have landed. */
		resolveErr(): void {
			pendingCount.value -= 1;
			hasErrorInBatch.value = true;
			settle();
		},

		/** Nothing was written — a refusal that never reached the repository. */
		resolveNeutral(): void {
			pendingCount.value -= 1;
			settle();
		},
	};
});
