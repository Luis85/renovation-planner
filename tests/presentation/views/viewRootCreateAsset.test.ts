/**
 * @vitest-environment jsdom
 *
 * Design slice A10's entry point, end to end: the foot line's `New asset` button (Task 9 moved
 * it there from the list header, giving it the one home `.rp-view-aside__create-asset` shares
 * with the empty state's own) opens the New asset form, and the form is handed the two REAL
 * command doors rather than one the view invented.
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
import { DEFAULT_SETTINGS } from '../../../src/plugin/settings/settings';
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
	// Task B9's door: the real one is `renovationProjectOpenAsset` bound to
	// `revealAssetDesigner` at the composition root, and this is the mock that lets these
	// cases watch it being reached without a real workspace behind it.
	const openAsset = vi.fn<(assetId: string) => Promise<void>>(() => Promise.resolve());
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
				defaultCurrency: DEFAULT_SETTINGS.defaultCurrency,
			},
			openProject: vi.fn<() => Promise<'opened'>>(() => Promise.resolve('opened')),
			navigate: vi.fn<() => void>(),
			onProjectsChanged: () => () => undefined,
			projectId: null,
			openAsset,
			// Task 11's continue read; no case in this file is about Continue, so `null` — no
			// stored context — is the honest default.
			continueContext: () => Promise.resolve(null),
		},
		createAsset,
		setAssetFootprintFromDimensions,
		listProjects,
		openAsset,
	};
}

async function openTheForm(context: unknown) {
	const wrapper = mount(ViewRoot, {
		global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
	});
	await flushPromises();
	await wrapper.get('.rp-view-aside__create-asset').trigger('click');
	await flushPromises();
	return wrapper;
}

/**
 * **A FRESH VAULT, which is where this button was unreachable.**
 *
 * `ViewRoot` draws `EmptyState` when the selector answers one and `ProjectList` only as the
 * `v-else` — so with no projects the list, its header and this button were not mounted at all,
 * and the first thing a user could do with a brand-new vault was create a project they may not
 * want. An Asset is VAULT-WIDE since design slice 19: it carries no project id, needs none, and
 * a catalogue is a perfectly ordinary thing to build first.
 *
 * The helper above says so in its own comment — *"an empty vault draws `EmptyState` instead"* —
 * which is this repository's recurring shape once more: the limitation was written down in the
 * file that shipped it, as an explanation of the fixture rather than as a gap.
 *
 * Asserted by DRIVING the button through to the composed command, not by finding it. A build
 * that rendered a second button wired to nothing, or to `createProject`, passes an existence
 * check and fails here.
 */
describe('ViewRoot, creating an asset in a vault with no projects', () => {
	it('offers the asset action beside the empty state, wired to the real command', async () => {
		setActivePinia(createPinia());
		const { context, createAsset } = deps();
		context.queries.listProjects = vi.fn<() => Promise<unknown>>(() =>
			Promise.resolve(ok({ projects: [], unreadable: 0 })),
		);

		const wrapper = mount(ViewRoot, {
			global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
		});
		await flushPromises();
		expect(wrapper.find('.rp-empty-state').exists()).toBe(true);
		expect(wrapper.find('.rp-project-list').exists()).toBe(false);

		await wrapper.get('.rp-view-aside__create-asset').trigger('click');
		await flushPromises();
		const form = wrapper.findComponent(NewAssetForm);
		expect(form.exists()).toBe(true);

		for (const [field, value] of [['name', 'Tiles'], ['unitCostAmount', '12.00'], ['currency', 'EUR']]) {
			await form.get(`[data-field="${field}"]`).setValue(value);
		}
		await form.get('form').trigger('submit');
		await flushPromises();

		expect(createAsset).toHaveBeenCalledTimes(1);
		expect(createAsset.mock.calls[0][0].name).toBe('Tiles');
	});

	it('prefills the asset currency from the bundle default', async () => {
		setActivePinia(createPinia());
		const { context } = deps();
		context.queries.listProjects = vi.fn<() => Promise<unknown>>(() =>
			Promise.resolve(ok({ projects: [], unreadable: 0 })),
		);

		const wrapper = mount(ViewRoot, {
			global: { provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } },
		});
		await flushPromises();
		expect(wrapper.find('.rp-empty-state').exists()).toBe(true);
		expect(wrapper.find('.rp-project-list').exists()).toBe(false);

		await wrapper.get('.rp-view-aside__create-asset').trigger('click');
		await flushPromises();
		const form = wrapper.findComponent(NewAssetForm);
		expect(form.exists()).toBe(true);

		expect((wrapper.get('[data-field="currency"]').element as HTMLInputElement).value).toBe(
			DEFAULT_SETTINGS.defaultCurrency,
		);
	});
});

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
	 * Task B9's hand-off. The dialog's own resolution carries what the sequence made
	 * (`FormDialogResult.values`, which for THIS form is the `AssetId` `NewAssetForm` emits
	 * directly rather than an object — see `onCreateAsset`'s own docblock), and `onCreateAsset`
	 * opens the designer on it through the SAME door `open-asset-designer`'s palette picker
	 * uses: `context.openAsset`, bound to `revealAssetDesigner` at the composition root. Driven
	 * end to end rather than asserted on the dialog's return value alone, which is what tells a
	 * correct wiring from a plausible one — the recurring instrument in this file.
	 */
	it('opens the designer on the asset the dialog created', async () => {
		setActivePinia(createPinia());
		const { context, openAsset } = deps();
		const wrapper = await openTheForm(context);

		await wrapper.get('[data-field="name"]').setValue('Kitchen island');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(openAsset).toHaveBeenCalledTimes(1);
		expect(openAsset).toHaveBeenCalledWith(ASSET.id);
	});

	/** The other half: a cancelled dialog made nothing, so there is nothing to open. */
	it('opens nothing when the dialog is cancelled', async () => {
		setActivePinia(createPinia());
		const { context, openAsset } = deps();
		const wrapper = await openTheForm(context);

		await wrapper.get('[data-rp-action="cancel"]').trigger('click');
		await flushPromises();

		expect(openAsset).not.toHaveBeenCalled();
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

		await wrapper.get('.rp-view-aside__create-asset').trigger('click');
		await flushPromises();
		await wrapper.get('.rp-view-aside__create-asset').trigger('click');
		await flushPromises();

		expect(openDialog).toHaveBeenCalledTimes(1);
		expect(wrapper.findComponent(NewAssetForm).exists()).toBe(true);
	});
});
