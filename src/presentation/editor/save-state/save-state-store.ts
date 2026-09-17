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
	 * A write landed half-way and its compensation refused (`leftWritesBehind`). Distinct from
	 * `save-error`, which any refused write raises and which the NEXT successful write clears
	 * for the ordinary reason — this one is about the vault's coherence.
	 *
	 * **Ruling R1 (2026-09-05): nothing in this store ever clears it once set**, `resolveOk`
	 * included — that half of R1 stands and the reasoning for it is below.
	 *
	 * **The other half — "sticky for the MOUNT's life" — is no longer where the incident
	 * lives.** This ref is still built fresh with every `createPinia()`, so on its own it would
	 * still lose the warning on any `saveSettings` (`rebind` → `unmount()` → `sync()` →
	 * `mount()`, for every open Plan Editor leaf, whichever setting changed). What closed that
	 * window is `PlanEditorView`'s own `unrecoveredWrite` field: the leaf holds the incident
	 * beside its `planId`, in Obsidian's view state, `mount` SEEDS this ref from it through
	 * `markUnrecovered`, and a watcher there hands a newly raised incident back. So this ref is
	 * the mount's REPORT of the leaf's incident rather than the record of it.
	 *
	 * Read the resulting guarantee at the leaf, at exactly this width. It survives a settings
	 * rebind, and a close-and-reopen that REUSES the view object (`onClose`/`onOpen` on a tab
	 * that stays in the layout) — both of which this repository drives. A leaf DETACHED and
	 * reopened from the palette, and an application restart, are a different mechanism: the
	 * field rides `getState()` and nothing more, so the incident comes back if and only if
	 * Obsidian hands that state to the new leaf. Obsidian does not run here and `FakeLeaf`
	 * records asks rather than performing them, so that half is Obsidian's behaviour and not a
	 * checked claim — either way nothing manufactures an all-clear: a leaf that comes back
	 * without the state comes back clean, exactly as one does today.
	 *
	 * **What the flag MEANS widened on 2026-09-17 (BP-02 slice 4), and the sentence above is the
	 * narrow half of it.** It used to say only "this leaf left a write behind". It now says
	 * "writes are refused — because this leaf left one behind, OR because the vault holds an
	 * open write incident (ADR-0034)". The second half arrives by SEEDING: the ref below is
	 * initialised from `activeWriteIncidentRegistry()?.anyOpen()`, asked once while the store is
	 * being created. Every `ItemView` mounts its own Vue app and its own Pinia (ADR-004), so a
	 * leaf opened while an incident is open is gated from its first frame rather than from its
	 * first refused write — which is what closes the second-leaf hole this paragraph used to
	 * state, without any leaf knowing another exists.
	 *
	 * **The seed reaches every surface that calls `useSaveStateStore`, which is wider than the
	 * Plan Editor.** Measured in the edit that added it rather than remembered:
	 * `grep -rln "useSaveStateStore" src/ | wc -l` prints **26** files, this module included, and
	 * the three that own a WRITE
	 * GATE built on `unrecoveredWrite` are `presentation/editor/runtime.ts` (`unsafeHistory`),
	 * `presentation/designer/runtime.ts` (its `EditorContext.writesBlocked`, which read a
	 * hard-coded `false` until 2026-09-17) and `presentation/views/work/projectWorkActions.ts`
	 * (`paused`). So the sentence this paragraph replaced — "neither Asset Designer nor the
	 * project view's work section is seeded at all" — is false in BOTH clauses now, and by one
	 * edit rather than three.
	 *
	 * **R1 is untouched by the seed**: it adds a way for the flag to START true and no way at
	 * all for it to become false.
	 *
	 * **Asked once, because there is nothing to subscribe to.** `WriteIncidentRegistry.record`
	 * publishes no event and holds a plain array, so a reader must poll or be seeded; seeding is
	 * the half that costs nothing per frame. The consequence is stated rather than hidden: an
	 * incident raised in ANOTHER leaf while this one is already mounted does not re-render this
	 * one's controls. That leaf catches up at its next write instead — `guardCommand` refuses it
	 * with `WRITES_PAUSED_CODE` and `withSaveStateTracking` marks on exactly that code. Making
	 * the gate reactive needs a notification the registry does not have and is its own increment.
	 *
	 * **What the seed still does NOT reach, because it reads the DURABLE record and not this
	 * process's other leaves.** An incident raised OUTSIDE a `guardCommand` call stack never
	 * becomes a durable record at all (ADR-0034's Consequences: every reversible adapter's
	 * `undo`/`redo` is outside the chokepoint, among others) — it marks the leaf that raised it,
	 * through `leftWritesBehind` below, and no other leaf learns of it at that leaf's next write
	 * or ever, because there is nothing for the gate to refuse on. That residue is ADR-0034's
	 * stated coverage boundary, inherited here rather than introduced.
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
	const unrecoveredWrite = ref(activeWriteIncidentRegistry()?.anyOpen() ?? false);

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
		unrecoveredWrite: computed(() => unrecoveredWrite.value),

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
		 * A refusal this leaf must not write past: one that left writes standing in the vault
		 * (`leftWritesBehind`), or `guardCommand`'s own `WRITES_PAUSED_CODE`, which says some
		 * earlier write did and the vault-wide gate is shut.
		 *
		 * TWO callers, re-measured in the edit that widened the second condition —
		 * `grep -rn "saveState\.markUnrecovered()" src/ | wc -l` prints **2**:
		 * `withSaveStateTracking`, which is where either refusal is turned into this flag, and
		 * `PlanEditorView.mount`, which seeds a fresh store with the incident that leaf was
		 * already carrying. The second is why this stays an action rather than becoming
		 * `withSaveStateTracking`'s private business. The vault-scoped seed above needs no
		 * caller at all: it is the ref's own initialiser.
		 */
		markUnrecovered(): void {
			unrecoveredWrite.value = true;
		},

		/**
		 * A write landed whole. Does NOT clear `unrecoveredWrite` — see that field's docblock
		 * (R1): this wrapper cannot tell a repairing write from any other, so the flag stays
		 * standing for as long as the LEAF does.
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
