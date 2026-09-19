import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { installWriteIncidentRegistry } from '../../../../src/application/incidents/WriteIncidentRegistry';
import { useSaveStateStore } from '../../../../src/presentation/editor/save-state/save-state-store';
import { installOpenWriteIncident, installQuietWriteIncidents, installUnseededWriteIncidents } from '../../../helpers/writeIncidents';

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
const markVaultPausedAction = (store: Store): void => store.markVaultPaused();

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

	it('never reaches unsaved-changes through any sequence of its own actions, and each marking door sets exactly its own sticky fact (R1)', () => {
		const actions: ((store: Store) => void)[] = [
			beginSavingAction,
			resolveOkAction,
			resolveErrAction,
			resolveNeutralAction,
			markUnrecoveredAction,
			markVaultPausedAction,
		];

		/**
		 * Every sequence of up to four actions, each replayed from a FRESH store — a genuine
		 * proof over every sequence from the initial state, rather than one continuous stream
		 * that only ever visits whatever state the previous sequence happened to leave behind.
		 * A store that assigns `'unsaved-changes'` only when an action sees the store at rest
		 * (e.g. `resolveOk` doing so exactly when `state === 'saved'`) is caught at depth 1,
		 * because every sequence here genuinely starts from `'saved'`.
		 *
		 * **All three of the store's derived booleans are asserted at every depth, from the prefix
		 * alone**, and that is what makes R1 STRUCTURAL rather than remembered. `unrecoveredWrite`
		 * is the gate and is `true` exactly when EITHER marking action appears anywhere in the
		 * sequence; `leafUnrecoveredWrite` exactly when `markUnrecoveredAction` does;
		 * `vaultWritesPaused` exactly when `markVaultPausedAction` does. Together those three
		 * predicates say, over every sequence of up to four actions from a fresh store: nothing
		 * clears either fact, each door writes ONE of them, and the gate is their OR. A door that
		 * leaked into the other ref fails the second or third clause at depth 1.
		 *
		 * (An earlier version of this walk compared the last `markUnrecoveredAction` index against
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
			expect(store.leafUnrecoveredWrite).toBe(prefix.includes(markUnrecoveredAction));
			expect(store.vaultWritesPaused).toBe(prefix.includes(markVaultPausedAction));
			expect(store.unrecoveredWrite).toBe(
				prefix.includes(markUnrecoveredAction) || prefix.includes(markVaultPausedAction),
			);
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
				'leafUnrecoveredWrite',
				'vaultWritesPaused',
				'beginSaving',
				'markUnrecovered',
				'markVaultPaused',
				'resolveOk',
				'resolveErr',
				'resolveNeutral',
			]),
		);
		// The exact key set Pinia hands back for this store today — its own ten members plus
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
			'leafUnrecoveredWrite',
			'markUnrecovered',
			'markVaultPaused',
			'resolveErr',
			'resolveNeutral',
			'resolveOk',
			'state',
			'unrecoveredWrite',
			'vaultWritesPaused',
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

	/**
	 * **The seed answers the VAULT's question and leaves the LEAF's alone**, which is the whole
	 * reason there are two refs rather than one. A leaf that has written nothing must not report
	 * an unrecovered write of its own: `PlanEditorView` carries that fact into Obsidian's
	 * persisted layout, where nothing can clear it, and `DraftRecovery.vue` takes a READ retry
	 * away for it.
	 */
	it('answers the vault question and not the leaf question when it seeds paused', async () => {
		await installOpenWriteIncident();
		const store = useSaveStateStore();

		expect(store.vaultWritesPaused).toBe(true);
		expect(store.leafUnrecoveredWrite).toBe(false);
	});

	/**
	 * **A restored leaf seeds CLEAN, and this is the mechanism under that.** `seed()` is the
	 * registry's own file read and `RenovationPlannerPlugin` calls it (unawaited) from
	 * `startPersistence`, which runs at `onLayoutReady` — while that same function's comment
	 * records that Obsidian restores its leaves BEFORE `onLayoutReady`. So a restored Plan
	 * Editor asks a registry whose list is still empty.
	 *
	 * Driven by installing a registry and NOT seeding it, which is exactly the state a restored
	 * leaf meets. Nothing here reorders plugin startup; the leaf catches up at its first refused
	 * write, the same non-reactive limitation reached from startup rather than from a peer.
	 *
	 * **What this cannot see**: Obsidian's real ordering. `FakeLeaf` records asks rather than
	 * performing them and nothing on this branch has run in a vault, so the ordering claim above
	 * is read from `RenovationPlannerPlugin.ts` and from its own comment, never from a run.
	 */
	it('starts clean against a registry whose file read has not resolved, as a restored leaf does', async () => {
		const restored = await installUnseededWriteIncidents();

		expect(useSaveStateStore().unrecoveredWrite).toBe(false);

		// The vault really did hold one — the clean seed above is the ORDERING and not an empty
		// file, which is the difference between this case and the quiet-registry one.
		await restored.seed();
		expect(restored.anyOpen()).toBe(true);
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
		expect(store.vaultWritesPaused).toBe(true);
	});

	/**
	 * **R1 on the OTHER ref, and on each door independently.** Splitting one monotonic ref into
	 * two is only safe if both are monotonic — the gate is their OR, and an OR is monotonic
	 * exactly when its terms are. So each door is driven on its own, then a successful write is
	 * put through, and both terms plus the gate are re-read.
	 *
	 * This case has no red against the pre-split store: R1 is an invariant the change had to
	 * CARRY, not one it creates. What it guards is the next edit — a `resolveOk` arm, or a
	 * `markVaultPaused(false)`, added to either ref.
	 *
	 * The EXHAUSTIVE form of the same three claims is the walk above ("each marking door sets
	 * exactly its own sticky fact"), which asserts all three booleans from the prefix alone over
	 * every sequence of up to four actions. This case is the readable named statement of the one
	 * sequence a reader would try by hand; a separate "the doors do not leak into each other" case
	 * was deleted rather than kept, because the walk decides it at depth 1.
	 */
	it('clears neither term of the gate, whichever door set it', () => {
		const store = useSaveStateStore();

		store.markUnrecovered();
		store.markVaultPaused();
		store.beginSaving();
		store.resolveOk();

		expect(store.state).toBe('saved');
		expect(store.leafUnrecoveredWrite).toBe(true);
		expect(store.vaultWritesPaused).toBe(true);
		expect(store.unrecoveredWrite).toBe(true);
	});
});
