/**
 * @vitest-environment jsdom
 *
 * Design slice A10's entry point, end to end: the project list header's second button opens
 * the New asset form, and the form is handed the two REAL command doors rather than one the
 * view invented.
 *
 * The second and third cases are the ones that earn their place. "A dialog opened" is equally
 * true of a caller that wired the wrong command — every existing case in this directory says
 * so — so the pair of props is asserted by DRIVING them and watching the composed commands be
 * called, which is the only thing that can tell a correct wiring from a plausible one.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import NewAssetForm from '../../../src/presentation/views/NewAssetForm.vue';
import { RENOVATION_PROJECT_CONTEXT } from '../../../src/presentation/views/RenovationProjectContext';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { ok } from '../../../src/core/result/Result';
import { makeAsset } from '../../helpers/entities';
import { recorder } from '../../helpers/logger';
import type { CreateAssetInput } from '../../../src/application/commands/asset/CreateAsset';
import type { SetAssetFootprintFromDimensionsInput } from '../../../src/application/commands/asset/SetAssetFootprint';

const ASSET = makeAsset();

/**
 * One project, so the LIST renders rather than the empty state — the button under test lives
 * in `ProjectList`'s header, and an empty vault draws `EmptyState` instead.
 */
const PROJECTS = [{ id: 'p1', name: 'Kitchen', status: 'IDEA' }];

function deps() {
	// Typed with their real INPUTS rather than as `() => …`: the two cases below read
	// `mock.calls[0][0]`, and a zero-parameter signature makes that a `TS2493` on an empty
	// tuple — which is `npm run build` type-checking `tests/**` catching a fake declared
	// thinner than the thing it stands for, in the file asserting the wiring.
	const createAsset = vi.fn<(input: CreateAssetInput) => Promise<unknown>>(() =>
		Promise.resolve(ok(ASSET)),
	);
	const setAssetFootprintFromDimensions = vi.fn<
		(input: SetAssetFootprintFromDimensionsInput) => Promise<unknown>
	>(() => Promise.resolve(ok('wrote')));
	const listProjects = vi.fn<() => Promise<unknown>>(() =>
		Promise.resolve(ok({ projects: PROJECTS, unreadable: 0 })),
	);
	return {
		context: {
			queries: { listProjects },
			commands: {
				// Present and never dispatched: this bundle is required in full, and a case that
				// omitted them would be asserting against a context shape no composition builds.
				createProject: { execute: vi.fn<() => Promise<never>>() },
				createPlan: { execute: vi.fn<() => Promise<never>>() },
				createAsset: { execute: createAsset },
				setAssetFootprintFromDimensions: { execute: setAssetFootprintFromDimensions },
				logger: recorder,
			},
			openProject: vi.fn<() => Promise<'opened'>>(() => Promise.resolve('opened')),
			navigate: vi.fn<() => void>(),
			onProjectsChanged: () => () => undefined,
			projectId: null,
		},
		createAsset,
		setAssetFootprintFromDimensions,
		listProjects,
	};
}

async function openTheForm(context: unknown) {
	const wrapper = mount(ViewRoot, {
		global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
	});
	await flushPromises();
	await wrapper.get('.rp-project-list__create-asset').trigger('click');
	await flushPromises();
	return wrapper;
}

describe('ViewRoot, creating an asset', () => {
	it('opens the New asset form from the project list header', async () => {
		setActivePinia(createPinia());
		const { context } = deps();

		const wrapper = await openTheForm(context);

		expect(wrapper.findComponent(NewAssetForm).exists()).toBe(true);
	});

	/**
	 * The wiring, driven rather than inspected: filling the form and submitting it must reach
	 * the composed `createAsset`, with the values the user typed. A view that passed the wrong
	 * command — `createProject`, say — renders identically and fails here.
	 */
	it('dispatches the composed createAsset with what the user typed', async () => {
		setActivePinia(createPinia());
		const { context, createAsset, setAssetFootprintFromDimensions } = deps();
		const wrapper = await openTheForm(context);

		await wrapper.get('[data-field="name"]').setValue('Kitchen island');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(createAsset).toHaveBeenCalledTimes(1);
		expect(createAsset.mock.calls[0][0]).toEqual(
			expect.objectContaining({ name: 'Kitchen island' }),
		);
		// No dimensions typed, so the second door is not reached — the same assertion the form's
		// own suite makes, repeated here because this is the composition that could wire one
		// door and forget the other.
		expect(setAssetFootprintFromDimensions).not.toHaveBeenCalled();
	});

	it('dispatches the composed footprint command when both dimensions are typed', async () => {
		setActivePinia(createPinia());
		const { context, setAssetFootprintFromDimensions } = deps();
		const wrapper = await openTheForm(context);

		await wrapper.get('[data-field="name"]').setValue('Kitchen island');
		await wrapper.get('[data-field="width"]').setValue('1200');
		await wrapper.get('[data-field="depth"]').setValue('800');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(setAssetFootprintFromDimensions).toHaveBeenCalledTimes(1);
		expect(setAssetFootprintFromDimensions.mock.calls[0][0]).toEqual(
			expect.objectContaining({ assetId: ASSET.id, width: 1200, depth: 800 }),
		);
	});

	/**
	 * `openDialog` THROWS `DialogStackingError` while a dialog is already open, and neither
	 * header button has a disabled state of its own — so the guard is a plain `current` check
	 * made BEFORE the dialog is opened at all, which is what makes a second click a no-op
	 * rather than a fault in a detached click handler.
	 *
	 * **Asserted on the CALL COUNT, and the first version of this case was asserted on
	 * `dialogStore.current` instead and pinned nothing** — measured, by deleting the guard and
	 * watching all 22 cases stay green. `openDialog` throws BEFORE it assigns, so `current`
	 * still holds the first descriptor in both builds; the only thing that differs is whether
	 * the second click reached `openDialog` at all. That is the shape this repository already
	 * records twice over: a test asserting an absence passes in both worlds when neither world
	 * can produce the thing.
	 */
	it('refuses to open a second dialog over the one already up', async () => {
		setActivePinia(createPinia());
		const { context } = deps();
		const wrapper = mount(ViewRoot, {
			global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
		});
		await flushPromises();
		const openDialog = vi.spyOn(useDialogStore(), 'openDialog');

		await wrapper.get('.rp-project-list__create-asset').trigger('click');
		await flushPromises();
		await wrapper.get('.rp-project-list__create-asset').trigger('click');
		await flushPromises();

		expect(openDialog).toHaveBeenCalledTimes(1);
		expect(wrapper.findComponent(NewAssetForm).exists()).toBe(true);
	});
});
