import { beforeEach, describe, expect, it } from 'vitest';
import { revealView } from '../../../../src/infrastructure/obsidian/workspace/revealView';
import { FakeWorkspace } from '../../../helpers/workspace';

/**
 * Every cause the activation answered, which is how "reported ONCE" is asked as a count
 * rather than as a boolean — the same instrument `openNote.test.ts` uses, for the same
 * finding at the sibling door.
 */
const faults: unknown[] = [];

beforeEach(() => {
	faults.length = 0;
});

/**
 * No DOM: this is the whole reason activation lives in a module rather than in the plugin's
 * click handler. What "show the view" means is asked of a function.
 */

const TYPE = 'renovation-project';

/**
 * The fake's shape is the real one's; the cast is the module boundary the mock stands in for.
 *
 * It builds the whole `RevealDeps` rather than just the workspace, and that is the fake rule
 * rather than brevity: `reportFault` is REQUIRED, so a case that left it out would pass until
 * something faulted and then die with `deps.reportFault is not a function` — a stand-in
 * thinner than the real thing, which `tests/` is not type-checked to catch.
 */
const workspaceFor = (fake: unknown) =>
	({
		workspace: fake,
		reportFault: (cause: unknown) => {
			faults.push(cause);
		},
	}) as unknown as Parameters<typeof revealView>[0];

describe('revealing a view', () => {
	it('opens a leaf and gives it the view state when none is open', async () => {
		const fake = new FakeWorkspace();

		await revealView(workspaceFor(fake), TYPE);

		expect(fake.leaves).toHaveLength(1);
		expect(fake.leaves[0].state).toEqual({ type: TYPE, active: true });
		expect(fake.revealed).toEqual(fake.leaves);
	});

	/**
	 * The defect this module exists to prevent: a second tab of the same view on every
	 * click. Driven twice rather than asserted once, because "reuses the leaf" is a claim
	 * about the SECOND call.
	 */
	it('reuses the open leaf rather than opening another', async () => {
		const fake = new FakeWorkspace();

		await revealView(workspaceFor(fake), TYPE);
		await revealView(workspaceFor(fake), TYPE);

		expect(fake.leaves).toHaveLength(1);
		expect(fake.revealed).toHaveLength(2);
	});

	/**
	 * And it does not re-state the view on a leaf it found: `setViewState` rebuilds the
	 * view, discarding whatever the user had scrolled to or filtered. Asserted through the
	 * state object's identity, since a rebuild would replace it.
	 */
	it('leaves an existing leaf’s state untouched', async () => {
		const fake = new FakeWorkspace();
		const open = fake.withOpen(TYPE);
		const before = open.state;

		await revealView(workspaceFor(fake), TYPE);

		expect(open.state).toBe(before);
		expect(fake.revealed).toEqual([open]);
	});

	// A leaf showing something else is not this view's leaf.
	it('ignores leaves of another type', async () => {
		const fake = new FakeWorkspace();
		fake.withOpen('some-other-view');

		await revealView(workspaceFor(fake), TYPE);

		expect(fake.leaves).toHaveLength(2);
		expect(fake.getLeavesOfType(TYPE)).toHaveLength(1);
	});

	it('coalesces a double click on the ribbon into one leaf', async () => {
		// The singleton's whole premise, against the gesture that breaks it. The candidate
		// lookup is `getLeavesOfType`, and a leaf this call creates does not answer that lookup
		// until `setViewState` resolves — which on a real leaf runs the registered factory and
		// the view's `onOpen`. So two activations in one tick both find nothing and both create.
		// Measured before the fix: two leaves. Reported by the polish pass that followed the
		// same defect at the other leaf-creating door.
		const fake = new FakeWorkspace();

		await Promise.all([revealView(workspaceFor(fake), TYPE), revealView(workspaceFor(fake), TYPE)]);

		expect(fake.leaves).toHaveLength(1);
		expect(fake.getLeavesOfType(TYPE)).toHaveLength(1);
	});

	it('goes back to the candidate lookup once an activation has settled', async () => {
		// The other half of the coalescing rule: the entry is released when the activation
		// settles, so a later click reveals the leaf that exists rather than being answered
		// from a promise the map held on to. `setViewState` is what says which happened — it is
		// set only on a leaf the call CREATED, so an unchanged state is the reveal path.
		const fake = new FakeWorkspace();

		await Promise.all([revealView(workspaceFor(fake), TYPE), revealView(workspaceFor(fake), TYPE)]);
		const created = fake.leaves[0];
		const stateAfterCreate = created.state;
		await revealView(workspaceFor(fake), TYPE);

		expect(fake.leaves).toHaveLength(1);
		expect(created.state).toBe(stateAfterCreate);
		expect(fake.revealed).toEqual([created, created]);
	});

	/**
	 * **The defect the coalescing itself created, reported one review round after it landed —
	 * and the SECOND time this repository has had it, at the second of its two leaf-creating
	 * doors.** `openProjectNote` was the first, and its fix is the shape this one takes.
	 *
	 * Both clicks were handed the same rejecting promise, and each call site wrapped its own
	 * `runDetached` around it: measured before the fix, two `reportFault` calls and two
	 * identical log lines for one failed double click. The notice COUNT cannot see it — slice
	 * 13's queue folds an identical message into a `(×N)` suffix on the notice already up — so
	 * the report count is the only instrument that discriminates, which is why this asserts on
	 * it rather than on what the user sees.
	 *
	 * Watched failing against the previous shape: two reports.
	 */
	it('reports a coalesced activation failure once', async () => {
		const failing = {
			getLeavesOfType: () => [],
			getLeaf: () => ({
				setViewState: () => Promise.reject(new Error('workspace exploded')),
			}),
			revealLeaf: () => Promise.resolve(),
		};

		await Promise.all([revealView(workspaceFor(failing), TYPE), revealView(workspaceFor(failing), TYPE)]);

		expect(faults).toHaveLength(1);
		expect((faults[0] as Error).message).toBe('workspace exploded');
	});

	/**
	 * The half that only matters BECAUSE the fault moved in here: the reuse path is not
	 * coalesced, so it never passes through the handler on the creation path — and the two
	 * detached call sites no longer wrap this in anything. Left unanswered, a failing
	 * `revealLeaf` on an existing leaf would be an unhandled rejection reaching nobody, which
	 * is the exact failure `runDetached` had been added to close.
	 */
	it('answers a fault on the reuse path too, rather than rejecting', async () => {
		const fake = new FakeWorkspace();
		fake.withOpen(TYPE);
		const failing = {
			getLeavesOfType: (type: string) => fake.getLeavesOfType(type),
			getLeaf: () => fake.getLeaf('tab'),
			revealLeaf: () => Promise.reject(new Error('reveal exploded')),
		};

		await expect(revealView(workspaceFor(failing), TYPE)).resolves.toBe(false);

		expect(faults).toHaveLength(1);
		expect((faults[0] as Error).message).toBe('reveal exploded');
	});

	/**
	 * And the entry is released on the failing path, which the `finally` buys: a click after a
	 * failed activation has to reach the workspace again rather than being answered forever
	 * from a promise the map never let go of.
	 */
	it('goes back to the workspace after a failed activation', async () => {
		let failNext = true;
		const fake = new FakeWorkspace();
		const flaky = {
			getLeavesOfType: (type: string) => fake.getLeavesOfType(type),
			getLeaf: () => {
				if (failNext) {
					failNext = false;
					return { setViewState: () => Promise.reject(new Error('once')) };
				}
				return fake.getLeaf('tab');
			},
			revealLeaf: (leaf: unknown) => fake.revealLeaf(leaf as never),
		};

		await revealView(workspaceFor(flaky), TYPE);
		await revealView(workspaceFor(flaky), TYPE);

		expect(faults).toHaveLength(1);
		expect(fake.getLeavesOfType(TYPE)).toHaveLength(1);
	});

	/**
	 * **The half the first version of this boundary missed, reported one round after it landed.**
	 * The fault handler was drawn around the paths INSIDE `revealCandidate`, and the candidate
	 * lookup sits one call out — in each wrapper's own argument. So a throw from
	 * `getLeavesOfType` escaped as a bare SYNCHRONOUS throw out of `revealView`, into Obsidian's
	 * own click handler, at the very call site that had just dropped `runDetached` for this.
	 * Measured before the fix: zero reports, the error escaping.
	 *
	 * `candidates` is a thunk now, called inside the `try`, so the enumeration is inside the
	 * boundary by construction rather than by a caller keeping it there.
	 */
	it('answers a fault from the candidate lookup rather than throwing past the caller', async () => {
		const exploding = {
			getLeavesOfType: () => {
				throw new Error('lookup exploded');
			},
		};

		await expect(revealView(workspaceFor(exploding), TYPE)).resolves.toBe(false);

		expect(faults).toHaveLength(1);
		expect((faults[0] as Error).message).toBe('lookup exploded');
	});

	/**
	 * **It ANSWERS whether the activation succeeded**, and leaf existence could not have
	 * answered that question: `revealCandidate` reports a failed reveal of an EXISTING leaf
	 * and RESOLVES, leaving that leaf in `getLeavesOfType` — so a caller inferring success
	 * from the leaf being there would go on to act as though a failed reveal had worked.
	 */
	it('answers false when revealing an existing leaf faults, and the leaf is still there', async () => {
		const fake = new FakeWorkspace();
		const leaf = fake.withOpen(TYPE);
		fake.revealLeaf = () => Promise.reject(new Error('boom'));

		const answered = await revealView(workspaceFor(fake), TYPE);

		expect(answered).toBe(false);
		expect(fake.getLeavesOfType(TYPE)).toContain(leaf);
		expect(faults).toHaveLength(1);
	});

	it('answers true on a successful reveal', async () => {
		const fake = new FakeWorkspace();
		fake.withOpen(TYPE);

		expect(await revealView(workspaceFor(fake), TYPE)).toBe(true);
	});
});
