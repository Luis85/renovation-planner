/**
 * @vitest-environment jsdom
 *
 * jsdom only because `../../../helpers/workspace` pulls in `RenovationProjectView`, whose
 * `ViewRoot.vue` mounts slice 15's `DialogHost` (design slice 15): once a `.vue` file with
 * real template content is reachable from BOTH this file's default 'node' environment and
 * `dialogKinds.test.ts`'s jsdom one, `@vitejs/plugin-vue` compiles it once per environment
 * and `@vitest/coverage-v8` merges the two into a phantom, never-hit duplicate of every
 * statement — not a real gap, since the same file is fully exercised under jsdom elsewhere.
 * No DOM otherwise: this is still the whole reason activation lives in a module rather than
 * in the plugin's click handler. What "show the view" means is asked of a function.
 */
import { describe, expect, it } from 'vitest';
import { revealView } from '../../../../src/infrastructure/obsidian/workspace/revealView';
import { FakeWorkspace } from '../../../helpers/workspace';

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
});
