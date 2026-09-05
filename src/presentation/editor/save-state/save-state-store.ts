import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
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
	 * for the ordinary reason — this one is about the vault's coherence, and the only evidence it
	 * is coherent again is a write that landed WHOLE, so `resolveOk` is the one clearer. A
	 * successful REFRESH does not clear it: reading a half-written vault back does not mend it.
	 */
	const unrecoveredWrite = ref(false);

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

		/** The refusal that follows left writes standing in the vault (`leftWritesBehind`). */
		markUnrecovered(): void {
			unrecoveredWrite.value = true;
		},

		/** A write landed whole — the only evidence the vault is coherent again. */
		resolveOk(): void {
			pendingCount.value -= 1;
			hasWriteInBatch.value = true;
			unrecoveredWrite.value = false;
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
