import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { installWriteIncidentRegistry } from '../../../../src/application/incidents/WriteIncidentRegistry';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';
import { installOpenWriteIncident, installQuietWriteIncidents } from '../../../helpers/writeIncidents';

type Store = ReturnType<typeof useSaveStateStore>;
// Named references, not anonymous closures: the exhaustive walk below has to recognise WHICH
// action a given prefix entry is, to compute the expected `unrecoveredWrite` for that
// sequence, and a name on the array element is cheaper than re-deriving it from what the
// store looks like afterwards.
const beginSavingAction = (store: Store): void => store.beginSaving();
const resolveOkAction = (store: Store): void => store.resolveOk();
const resolveErrAction = (store: Store): void => store.resolveErr();
const resolveNeutralAction = (store: Store): void => store.resolveNeutral();
const markUnrecoveredAction = (store: Store): void => store.markUnrecovered();

describe('the save-state store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('starts saved, because a fresh hydration has nothing unsaved by construction', () => {
		expect(useSaveStateStore().state).toBe('saved');
	});

	it('reports a dispatch in flight, then its outcome', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		expect(store.state).toBe('saving');
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	it('reports a failed dispatch', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		expect(store.state).toBe('save-error');
	});

	it('does not get stuck on a stale error', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		store.beginSaving();
		expect(store.state).toBe('saving');
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	it('never says saved while a sibling dispatch is still in flight', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.beginSaving();
		store.resolveOk();
		expect(store.state).toBe('saving');
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	it('lets one failure decide a whole batch, even where a sibling succeeded', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.beginSaving();
		store.resolveErr();
		expect(store.state).toBe('saving');
		store.resolveOk();
		expect(store.state).toBe('save-error');
	});

	it('does not let a validation refusal clear a real save error', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		expect(store.state).toBe('save-error');

		// A field edit refused for validation: nothing reached the repository, so the earlier
		// failed write is exactly as unsaved as it was.
		store.beginSaving();
		store.resolveNeutral();
		expect(store.state).toBe('save-error');
	});

	it('lets a write that actually succeeded clear a save error', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		store.beginSaving();
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	it('leaves a resting saved state alone after a refusal that wrote nothing', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveNeutral();
		expect(store.state).toBe('saved');
	});

	it('reports a batch that mixed a real write with a refusal as saved', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.beginSaving();
		store.resolveNeutral();
		store.resolveOk();
		expect(store.state).toBe('saved');
	});

	/**
	 * Named for what it PROVES, which is not what an earlier name claimed. It establishes no
	 * save error at all — the case below it does that — so it cannot be about clearing one. What
	 * it holds is that `beforeBatch` is captured when the batch OPENS and not on every
	 * `beginSaving`: the second `beginSaving` arrives with the store already reading
	 * `'saving'`, so an unconditional capture would settle this batch on `'saving'` and leave
	 * the indicator stuck there. That mutation survives 100% branch coverage and is killed here
	 * and nowhere else.
	 */
	it('settles an overlapping batch of refusals back to what it opened on, never to saving', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.beginSaving();
		store.resolveNeutral();
		store.resolveNeutral();
		expect(store.state).toBe('saved');
	});

	it('preserves a save error across an overlapping batch that writes nothing', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.resolveErr();
		expect(store.state).toBe('save-error');

		store.beginSaving();
		store.beginSaving();
		store.resolveNeutral();
		store.resolveNeutral();
		expect(store.state).toBe('save-error');
	});

	it('records an unrecovered write, and keeps reporting it even after a later write succeeds (R1: sticky for the leaf\'s life)', () => {
		const store = useSaveStateStore();
		store.beginSaving();
		store.markUnrecovered();
		store.resolveErr();
		expect(store.state).toBe('save-error');
		expect(store.unrecoveredWrite).toBe(true);
		store.beginSaving();
		store.resolveNeutral(); // a refusal that wrote nothing
		expect(store.unrecoveredWrite).toBe(true);
		store.beginSaving();
		store.resolveOk(); // a write that landed whole -- R1: resolveOk no longer clears the flag
		expect(store.unrecoveredWrite).toBe(true);
	});

	it('never reaches unsaved-changes through any sequence of its own actions, and unrecoveredWrite is sticky once marked (R1)', () => {
		const actions: ((store: Store) => void)[] = [
			beginSavingAction,
			resolveOkAction,
			resolveErrAction,
			resolveNeutralAction,
			markUnrecoveredAction,
		];

		/**
		 * Every sequence of up to four actions, each replayed from a FRESH store — a genuine
		 * proof over every sequence from the initial state, rather than one continuous stream
		 * that only ever visits whatever state the previous sequence happened to leave behind.
		 * A store that assigns `'unsaved-changes'` only when an action sees the store at rest
		 * (e.g. `resolveOk` doing so exactly when `state === 'saved'`) is caught at depth 1,
		 * because every sequence here genuinely starts from `'saved'`.
		 *
		 * `unrecoveredWrite` is asserted at every depth too, from the prefix alone: R1 makes it
		 * sticky for the leaf's life, so no action in this store's surface ever clears it once
		 * set — it is `true` exactly when `markUnrecoveredAction` appears ANYWHERE in the
		 * sequence, with no dependence on where a `resolveOkAction` falls relative to it. (An
		 * earlier version of this walk compared the last `markUnrecoveredAction` index against
		 * the last `resolveOkAction` index, back when `resolveOk` still cleared the flag; R1
		 * retired that comparison along with the clearing statement it was proving.)
		 */
		const walk = (prefix: readonly ((store: Store) => void)[], depth: number): void => {
			setActivePinia(createPinia());
			const store = useSaveStateStore();
			for (const act of prefix) {
				act(store);
				expect(store.state).not.toBe('unsaved-changes');
			}
			expect(store.unrecoveredWrite).toBe(prefix.includes(markUnrecoveredAction));
			if (depth === 0) return;
			for (const act of actions) {
				walk([...prefix, act], depth - 1);
			}
		};
		walk([], 4);
	});

	it('exposes exactly its own action surface, so a future action cannot slide in unnoticed', () => {
		const store = useSaveStateStore();
		expect(Object.keys(store)).toEqual(
			expect.arrayContaining([
				'state',
				'unrecoveredWrite',
				'beginSaving',
				'markUnrecovered',
				'resolveOk',
				'resolveErr',
				'resolveNeutral',
			]),
		);
		// The exact key set Pinia hands back for this store today — its own seven members plus
		// the setup-store machinery ($dispose, $patch, …) Pinia attaches to every store. An
		// exact match, not a negative check for a name (like the never-existed `markUnsaved`)
		// that no implementation would plausibly add: a genuinely new action changes this set
		// and must be added here deliberately rather than passing unnoticed.
		expect(Object.keys(store).toSorted()).toEqual([
			'$dispose',
			'$id',
			'$onAction',
			'$patch',
			'$reset',
			'$subscribe',
			'_customProperties',
			'_hmrPayload',
			'_hotUpdate',
			'_p',
			'beginSaving',
			'markUnrecovered',
			'resolveErr',
			'resolveNeutral',
			'resolveOk',
			'state',
			'unrecoveredWrite',
		]);
	});

	it('gives each Plan Editor its own state, since two can save independently', () => {
		const first = useSaveStateStore();
		setActivePinia(createPinia());
		const second = useSaveStateStore();
		first.beginSaving();
		expect(first.state).toBe('saving');
		expect(second.state).toBe('saved');
	});
});

/**
 * **The seed, which is the whole of how a leaf that did nothing wrong learns the vault is
 * half-written** (ADR-0034, BP-02 slice 4). Every `ItemView` mounts its own Pinia, so a pane
 * opened while an incident is open builds a fresh store — and unless that store asks the
 * vault-scoped registry at setup, it starts clean and offers an enabled UI over a vault every
 * guarded write is already being refused for.
 *
 * `setActivePinia(createPinia())` per case is what makes "a freshly created store" literal
 * here: a Pinia store is created once per Pinia, so the registry has to be installed BEFORE
 * `useSaveStateStore()` is first called against it. That ordering is the mechanism, not a
 * fixture detail — a second pane is precisely a second Pinia asking the same question.
 *
 * **What these cases do NOT simulate, said plainly rather than worked around:** a second Plan
 * Editor LEAF. `FakeWorkspace` has no split and no layout restore, `duplicateLeaf` exists
 * nowhere in this repository, and no test anywhere drives two Plan Editor leaves on the same
 * plan (tracker limitation L-03). A fake that pretended to duplicate a leaf would be kinder
 * than Obsidian, which is this repository's most expensive recurring defect. The gesture is
 * covered by a manual case instead — `docs/tests/cases/Two panes on one plan under an open
 * write incident.md`, written and NOT yet run in a vault.
 */
describe('the save-state store seeded from an open write incident', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	afterEach(() => {
		installWriteIncidentRegistry(null);
	});

	it('starts with writes paused when the vault holds an open incident', async () => {
		await installOpenWriteIncident();

		expect(useSaveStateStore().unrecoveredWrite).toBe(true);
	});

	it('starts clean when a registry is installed with nothing open', () => {
		installQuietWriteIncidents();

		expect(useSaveStateStore().unrecoveredWrite).toBe(false);
	});

	it('starts clean when no registry is installed at all, which is every test rig and the harness', () => {
		expect(useSaveStateStore().unrecoveredWrite).toBe(false);
	});

	/**
	 * Ruling R1 over the seeded value: the flag is SET and never unset, and the seed adds a way
	 * for it to start true rather than a way for it to become false. Driven with the one action
	 * whose whole job is to report that a write landed whole, because that is the action a reader
	 * would most expect to clear it — and the one E3 proved must not.
	 */
	it('keeps the seeded pause across a write that succeeds', async () => {
		await installOpenWriteIncident();
		const store = useSaveStateStore();

		store.beginSaving();
		store.resolveOk();

		expect(store.state).toBe('saved');
		expect(store.unrecoveredWrite).toBe(true);
	});
});
