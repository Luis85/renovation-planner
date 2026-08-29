/**
 * Opening the Plan Editor for a specific Plan.
 *
 * The premise this view exists on is that several coexist — comparing Ground Floor against
 * First Floor — so "one leaf" is per PLAN here, not per view type. That is the one
 * behavioural difference from `revealView`, and it is what the two functions could not
 * both be.
 */
import { describe, expect, it } from 'vitest';
import { revealPlanEditor } from '../../../../src/infrastructure/obsidian/workspace/revealPlanEditor';
import { revealView } from '../../../../src/infrastructure/obsidian/workspace/revealView';
import { FakeWorkspace } from '../../../helpers/workspace';

const TYPE = 'renovation-plan-editor';

describe('revealing a plan editor', () => {
	it('opens a leaf carrying the plan id in its view state', async () => {
		const workspace = new FakeWorkspace();

		await revealPlanEditor(workspace as never, TYPE, 'plan-ground');

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0].state).toEqual({
			type: TYPE,
			active: true,
			state: { planId: 'plan-ground' },
		});
		expect(workspace.revealed).toEqual([workspace.leaves[0]]);
	});

	it('reuses the leaf already showing that plan rather than opening a second', async () => {
		const workspace = new FakeWorkspace();
		const existing = workspace.withOpen(TYPE, { planId: 'plan-ground' });

		await revealPlanEditor(workspace as never, TYPE, 'plan-ground');

		expect(workspace.leaves).toEqual([existing]);
		expect(workspace.revealed).toEqual([existing]);
	});

	/**
	 * `setViewState` only on a leaf this call CREATED. Setting it on an existing leaf
	 * rebuilds a view the user has already panned and zoomed — which for a canvas editor is
	 * the whole of their working position.
	 */
	it('does not re-set the view state of a leaf it found', async () => {
		const workspace = new FakeWorkspace();
		const existing = workspace.withOpen(TYPE, { planId: 'plan-ground' });
		const before = existing.state;

		await revealPlanEditor(workspace as never, TYPE, 'plan-ground');

		expect(existing.state).toBe(before);
	});

	it('opens a second, independent leaf for a different plan', async () => {
		const workspace = new FakeWorkspace();
		workspace.withOpen(TYPE, { planId: 'plan-ground' });

		await revealPlanEditor(workspace as never, TYPE, 'plan-first');

		expect(workspace.leaves).toHaveLength(2);
		expect(workspace.leaves[1].state?.state).toEqual({ planId: 'plan-first' });
	});

	it('ignores a leaf of the same type whose state names no plan', async () => {
		const workspace = new FakeWorkspace();
		workspace.withOpen(TYPE);

		await revealPlanEditor(workspace as never, TYPE, 'plan-ground');

		expect(workspace.leaves).toHaveLength(2);
	});

	it('ignores a leaf whose plan id is not a string', async () => {
		const workspace = new FakeWorkspace();
		workspace.withOpen(TYPE, { planId: 7 });

		await revealPlanEditor(workspace as never, TYPE, 'plan-ground');

		expect(workspace.leaves).toHaveLength(2);
	});
});

describe('two activations racing', () => {
	it('coalesces two opens of the SAME plan into one leaf', async () => {
		// The multiplicity premise is per PLAN, not per call: a plan already open must not get a
		// second editor. The candidate lookup cannot see a leaf being built, so two opens in one
		// tick both found nothing and both created — measured, two leaves for one plan, each
		// with its own undo history and camera.
		const workspace = new FakeWorkspace();

		await Promise.all([
			revealPlanEditor(workspace as never, TYPE, 'plan-1'),
			revealPlanEditor(workspace as never, TYPE, 'plan-1'),
		]);

		expect(workspace.leaves).toHaveLength(1);
	});

	it('still gives two DIFFERENT plans their own leaves when they race', async () => {
		// The over-correction the case above would hide, and the reason the key carries the
		// state rather than the type alone: coalescing on the view type would collapse the very
		// multiplicity this function exists to permit.
		const workspace = new FakeWorkspace();

		await Promise.all([
			revealPlanEditor(workspace as never, TYPE, 'plan-1'),
			revealPlanEditor(workspace as never, TYPE, 'plan-2'),
		]);

		expect(workspace.leaves).toHaveLength(2);
		expect(workspace.leaves.map((leaf) => leaf.state?.state?.['planId'])
			.toSorted()).toEqual([
			'plan-1',
			'plan-2',
		]);
	});
});

/**
 * The two activations share their mechanism through one internal helper, so the singleton
 * guarantee has to still hold after the refactor that introduced it. This is the case
 * `revealView`'s own suite covers; repeated here as the pairing, because the shared helper
 * is where a change would break both.
 */
describe('the singleton case, unchanged by the shared mechanism', () => {
	it('still opens exactly one leaf per view type', async () => {
		const workspace = new FakeWorkspace();

		await revealView(workspace as never, 'renovation-project');
		await revealView(workspace as never, 'renovation-project');

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.revealed).toHaveLength(2);
	});

	it('passes no view state, since a singleton view has none', async () => {
		const workspace = new FakeWorkspace();

		await revealView(workspace as never, 'renovation-project');

		expect(workspace.leaves[0].state).toEqual({ type: 'renovation-project', active: true, state: undefined });
	});
});
