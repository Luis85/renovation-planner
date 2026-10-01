/**
 * @vitest-environment jsdom
 *
 * AD07's first implementation item: the designer's empty state offers all THREE entry paths —
 * start from an object, start from measurements, trace a reference — rather than the one the
 * selector happens to rank first.
 *
 * Driven against the REAL `ReversibleAssetDesignCommands` over the in-memory vault
 * (`tests/helpers/assetDesignHarness.ts`), with only the DIALOG and the PICKER faked, which is
 * the same line `assetDimensions.test.ts` and `backgroundPicker.test.ts` already draw: Obsidian's
 * suggester cannot run in jsdom, and a real `openDialog` would need a user to type into a mounted
 * form those two files already cover.
 *
 * **Both empty states are driven, not one.** `selectAssetDesignerEmptyState` ranks
 * `noBackground` above `noShape`, so a build that offered the alternatives from only the entry it
 * was written against would pass a suite that tested only that entry — which is how the gesture
 * came to be reachable from one of them in the first place (`selectors.ts`'s own account of the
 * review finding).
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import EmptyState from '../../../src/presentation/components/EmptyState.vue';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import type { BackgroundPicker } from '../../../src/presentation/designer/ports';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { GetAssetDesignQuery } from '../../../src/application/queries/GetAssetDesign';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import { t } from '../../../src/presentation/i18n/strings';
import { recorder } from '../../helpers/logger';
import { expectOk } from '../../helpers/domain';
import { seeded } from '../../helpers/assetDesignHarness';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installResizeObserver } from '../../helpers/layout';
import { unwiredPlanUsage } from '../../helpers/designerQueries';

installCanvas();
installResizeObserver();

/** What a user reads on each of the three buttons, resolved the way the surface resolves it. */
const PRESET = t('en', 'designer.inspector.start-preset');
const MEASUREMENTS = t('en', 'empty.asset.no-shape.action');
const REFERENCE = t('en', 'empty.asset.no-background.action');

/**
 * Give the seeded asset a spec sheet, which is the ONLY difference between the selector's two
 * shapeless answers — `assetDimensions.test.ts`'s own `withBackground`, and the reason this file
 * can drive both states through one mount helper.
 */
async function withBackground(harness: Awaited<ReturnType<typeof seeded>>): Promise<void> {
	const loaded = expectOk(await harness.stack.assets.getById(harness.assetId));
	if (loaded === null) throw new Error('expected the seeded asset to be present');
	const changed = expectOk(
		loaded.entity.withChanges({ background: { path: 'Specs/oven.png', kind: 'image', page: null } }),
	);
	expectOk(await harness.stack.assets.save(changed, loaded.version));
}

function context(
	harness: Awaited<ReturnType<typeof seeded>>,
	picker: BackgroundPicker | null,
): AssetDesignerContext {
	const query = new GetAssetDesignQuery(harness.stack.assets, harness.sidecar);
	return {
		assetId: String(harness.assetId),
		queries: { getAssetDesign: (assetId) => query.execute(assetId as AssetId), listPlansUsingAsset: unwiredPlanUsage },
		commands: { designEdits: () => harness.reversible },
		logger: recorder,
		picker,
		vault: emptyBackgroundVault(),
		onDesignChanged: () => () => undefined,
		onThemeChange: () => () => undefined,
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => true,
		closeLeaf: () => undefined,
	};
}

async function mountDesigner(options: { background?: boolean; picker?: BackgroundPicker | null } = {}) {
	const harness = await seeded();
	await harness.seed(null);
	if (options.background === true) await withBackground(harness);
	const pinia = createPinia();
	const wrapper = mount(AssetDesignerRoot, {
		global: {
			plugins: [pinia, VueKonva],
			provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context(harness, options.picker ?? null) },
		},
	});
	await flushPromises();
	return { wrapper, harness, dialogs: useDialogStore(pinia) };
}

/** Every button inside the empty-state panel, by the words on it, in the order they draw. */
function panelButtons(wrapper: Awaited<ReturnType<typeof mountDesigner>>['wrapper']): string[] {
	return wrapper.findAll('.rp-empty-state button').map((button) => button.text());
}

/** One entry path by its label. Throws rather than answering a wrapper that does not exist. */
function entryPath(wrapper: Awaited<ReturnType<typeof mountDesigner>>['wrapper'], label: string) {
	const found = wrapper.findAll('.rp-empty-state button').find((button) => button.text() === label);
	if (found === undefined) throw new Error(`the empty state offers no path labelled ${label}`);
	return found;
}

const somePicker = (): BackgroundPicker => {
	const picker: BackgroundPicker = { pick: vi.fn<BackgroundPicker['pick']>() };
	vi.mocked(picker.pick).mockResolvedValue({ path: 'Specs/oven.pdf', kind: 'pdf', page: 1 });
	return picker;
};

describe('the three entry paths the designer empty state offers', () => {
	it('offers all three from the no-background state, the ranked one first', async () => {
		const { wrapper } = await mountDesigner({ picker: somePicker() });

		expect(panelButtons(wrapper)).toEqual([REFERENCE, MEASUREMENTS, PRESET]);
	});

	it('offers all three from the no-shape state, the ranked one first', async () => {
		const { wrapper } = await mountDesigner({ background: true, picker: somePicker() });

		expect(panelButtons(wrapper)).toEqual([MEASUREMENTS, REFERENCE, PRESET]);
	});

	/**
	 * Slice 14's Amendment 1 reaches the ALTERNATIVE the same way it reaches the primary action:
	 * an unbound picker is a gesture nothing can perform, so the path is withheld — and the other
	 * two, which need no port at all, are not.
	 */
	it('withholds the reference path when no picker is bound, and keeps the other two', async () => {
		const { wrapper } = await mountDesigner({ background: true, picker: null });

		expect(panelButtons(wrapper)).toEqual([MEASUREMENTS, PRESET]);
	});

	it('withholds it from the no-background state too, where it is the ranked path', async () => {
		const { wrapper } = await mountDesigner({ picker: null });

		expect(panelButtons(wrapper)).toEqual([MEASUREMENTS, PRESET]);
	});
});

describe('what each entry path actually does', () => {
	/**
	 * The MEASUREMENTS path reached from the state that does not rank it, dispatched against the
	 * real command: a 1200 × 450 rectangle written with no background picked and no calibration
	 * dialog anywhere in the gesture (AD07's first acceptance criterion).
	 */
	it('writes a measured rectangle from the no-background state, with no reference and no calibration', async () => {
		const { wrapper, harness, dialogs } = await mountDesigner({ picker: somePicker() });
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 1200, depth: 450 } as never);

		await entryPath(wrapper, MEASUREMENTS).trigger('click');
		await flushPromises();

		expect(vi.mocked(dialogs.openDialog).mock.calls[0][0]).toMatchObject({ kind: 'asset-dimensions' });
		const document = await harness.document();
		expect(document.calibration).toBeNull();
		expect(document.shape?.footprintOrigin).toBe('typed');
		expect(document.shape?.footprint.points).toHaveLength(4);
	});

	it('writes nothing when the measurements dialog is cancelled', async () => {
		const { wrapper, harness, dialogs } = await mountDesigner({ picker: somePicker() });
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue(null as never);

		await entryPath(wrapper, MEASUREMENTS).trigger('click');
		await flushPromises();

		expect((await harness.document()).shape).toBeNull();
	});

	/** The PRESET path, from the state that ranks neither of the other two above it. */
	it('opens the preset form from the no-shape state', async () => {
		const { wrapper, dialogs } = await mountDesigner({ background: true, picker: somePicker() });
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue('cancel' as never);

		await entryPath(wrapper, PRESET).trigger('click');
		await flushPromises();

		expect(vi.mocked(dialogs.openDialog).mock.calls[0][0]).toMatchObject({ kind: 'form', props: { replaces: false } });
	});

	/** The REFERENCE path from the state that ranks measurements first. */
	it('opens the picker from the no-shape state and stores what it returns', async () => {
		const picker = somePicker();
		const { wrapper, harness } = await mountDesigner({ background: true, picker });

		await entryPath(wrapper, REFERENCE).trigger('click');
		await flushPromises();

		expect(picker.pick).toHaveBeenCalled();
		const asset = expectOk(await harness.stack.assets.getById(harness.assetId));
		expect(asset?.entity.background).toEqual({ path: 'Specs/oven.pdf', kind: 'pdf', page: 1 });
	});

	/**
	 * One door per gesture, asserted as this repository asserts it everywhere else — by driving
	 * BOTH callers and watching the same thing happen. The alternative path and the primary action
	 * are the same `editDimensions`, so a second copy that opened a different dialog would show up
	 * here rather than in review.
	 */
	it('takes the same door for the measurements path and for the ranked action', async () => {
		const first = await mountDesigner({ background: true, picker: somePicker() });
		const firstOpen = vi.spyOn(first.dialogs, 'openDialog').mockResolvedValue(null as never);
		await first.wrapper.find('.rp-empty-state__action').trigger('click');
		await flushPromises();

		const second = await mountDesigner({ picker: somePicker() });
		const secondOpen = vi.spyOn(second.dialogs, 'openDialog').mockResolvedValue(null as never);
		await entryPath(second.wrapper, MEASUREMENTS).trigger('click');
		await flushPromises();

		// `toEqual` over the whole descriptor, not a field of it: what makes the two callers ONE
		// door is that they open the same dialog with the same arguments, and a comparison of two
		// titles would pass a build whose alternative path supplied a different `initial`.
		expect(secondOpen.mock.calls[0][0]).toEqual(firstOpen.mock.calls[0][0]);
	});
});

/**
 * The lease on `EmptyState.vue` was granted on one condition: the change is ADDITIVE and every
 * existing caller renders exactly as it did. The slot is the whole of the change, so these two
 * cases are the proof — a caller that passes no `actions` slot gets the markup it always got.
 *
 * FOUR other callers, counted rather than remembered (AD07 review, FIX 5.3):
 * `grep -rn "<EmptyState" src/ --include=*.vue` prints seven lines, two of which are prose — a
 * `computed<EmptyStateProps | null>` annotation in this very component and a sentence in
 * `DialogHost.vue`'s header. The five real mount sites are `AssetDesignerRoot` (this one),
 * `PlanEditorRoot`, `AssetLibraryBody`, `ProjectDetailState` and `ViewRoot`. The title said eight.
 */
describe('EmptyState stays what its four other callers already draw', () => {
	const PROPS = { headline: 'No zones yet', body: 'Draw the first zone.' };

	it('draws nothing of its own in the actions slot', () => {
		const wrapper = mount(EmptyState, { props: { ...PROPS, actionLabel: 'Draw a zone' } });

		// The slot is a BARE one, with no wrapper element of its own, so a caller that passes
		// nothing gets exactly the panel it got before: the heading, the body and one button.
		expect(wrapper.findAll('button')).toHaveLength(1);
		expect(wrapper.find('.rp-empty-state__panel').element.children).toHaveLength(4);
	});

	it('still renders no button at all for a caller with neither an action nor a slot', () => {
		expect(mount(EmptyState, { props: PROPS }).find('button').exists()).toBe(false);
	});
});
