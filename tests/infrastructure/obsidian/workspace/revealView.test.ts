import { describe, expect, it } from 'vitest';
import { revealView } from '../../../../src/infrastructure/obsidian/workspace/revealView';
import { FakeWorkspace } from '../../../helpers/workspace';

/**
 * No DOM: this is the whole reason activation lives in a module rather than in the plugin's
 * click handler. What "show the view" means is asked of a function.
 */

const TYPE = 'renovation-project';

// The fake's shape is the real one's; the cast is the module boundary the mock stands in for.
const workspaceFor = (fake: FakeWorkspace) => fake as unknown as Parameters<typeof revealView>[0];

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
});
