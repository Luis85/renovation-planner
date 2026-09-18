/**
 * @vitest-environment jsdom
 *
 * Task B8's Step 1a: the dimensions dialog reached from BOTH callers — the `noShape` empty
 * state's action, and `DesignerInspector`'s own "Edit dimensions" control once a shape exists —
 * both dispatching `SetAssetFootprintFromDimensions` for the asset already OPEN rather than
 * `NewAssetForm`'s different one.
 *
 * Driven against the REAL `ReversibleAssetDesignCommands` over the in-memory vault
 * (`tests/helpers/assetDesignHarness.ts`), with only the DIALOG faked — a real `openDialog`
 * would need a user to type into a mounted `AssetDimensionsDialog`, which `dialogKinds.test.ts`
 * already covers on its own; this file is about the WIRING, the same split
 * `backgroundPicker.test.ts` draws for Task B7's picker.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { GetAssetDesignQuery } from '../../../src/application/queries/GetAssetDesign';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import { isOk } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { recorder } from '../../helpers/logger';
import { expectOk } from '../../helpers/domain';
import { seeded, drawn } from '../../helpers/assetDesignHarness';
import { emptyBackgroundVault } from '../../helpers/background';
import { installCanvas } from '../../helpers/canvas';
import { installResizeObserver } from '../../helpers/layout';
import type { Point } from '../../../src/core/geometry/Point';
import { circle } from '../../../src/domain/asset/presets/presetGeometry';
import { toiletShape } from '../../helpers/assetShapes';
import { Notice } from '../../helpers/obsidian-mock';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';
import { unwiredPlanUsage } from '../../helpers/designerQueries';

installCanvas();
installResizeObserver();
installObsidianDom();

/**
 * `selectAssetDesignerEmptyState` answers `noShape` only for a SHAPELESS asset that already
 * has a background (`shape === null && background !== null`) — the harness's own `makeAsset`
 * seeds neither, and every fixture in this file needs the `noShape` state specifically, so the
 * background half is given here rather than left to the selector's other arm, `noBackground`,
 * which `backgroundPicker.test.ts` already owns.
 */
async function withBackground(harness: Awaited<ReturnType<typeof seeded>>): Promise<void> {
	const loaded = expectOk(await harness.stack.assets.getById(harness.assetId));
	if (loaded === null) throw new Error('expected the seeded asset to be present');
	const changed = expectOk(
		loaded.entity.withChanges({ background: { path: 'Specs/oven.png', kind: 'image', page: null } }),
	);
	expectOk(await harness.stack.assets.save(changed, loaded.version));
}

function context(harness: Awaited<ReturnType<typeof seeded>>): AssetDesignerContext {
	// The real query, over the harness's own repositories — the same join `GetAssetDesign` runs
	// in production, so `dimensions` and `dimensionsUnscaled` are the query's own answers rather
	// than a fixture's guess about what they should be.
	const query = new GetAssetDesignQuery(harness.stack.assets, harness.sidecar);
	return {
		assetId: String(harness.assetId),
		queries: { getAssetDesign: (assetId) => query.execute(assetId as AssetId), listPlansUsingAsset: unwiredPlanUsage },
		commands: { designEdits: () => harness.reversible },
		logger: recorder,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: () => () => undefined,
		onThemeChange: () => () => undefined,
		// A source that never fires, rather than one omitted: the member is required precisely so
		// no surface can forget to answer the question, and this suite's cases are not about a file
		// moving under the surface. `backgroundInEditor.test.ts` is where that door is driven.
		onVaultFileChanged: () => () => undefined,
		indexScanCompleted: () => true,
		// Not the dangling state's suite: `assetDesignerRoot.test.ts` is where the tree is asked
		// whether it CALLS this, and `assetDesignerView.test.ts` whether calling it detaches the
		// leaf. Present rather than omitted because the member is required precisely so no surface
		// can forget to answer the question.
		closeLeaf: () => undefined,
	};
}

async function mountDesigner(harness: Awaited<ReturnType<typeof seeded>>) {
	const pinia = createPinia();
	const wrapper = mount(AssetDesignerRoot, {
		global: {
			plugins: [pinia, VueKonva],
			provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context(harness) },
		},
	});
	await flushPromises();
	return { wrapper, dialogs: useDialogStore(pinia) };
}

function expectNear(
	points: readonly Point[] | undefined,
	expected: readonly (readonly [number, number])[],
	precision = 6,
): void {
	expect(points).toHaveLength(expected.length);
	points?.forEach((point, index) => {
		expect(point.x).toBeCloseTo(expected[index][0], precision);
		expect(point.y).toBeCloseTo(expected[index][1], precision);
	});
}

/** 380 × 700, anchored at the origin: a round front, a tank, a stadium bowl and a front clearance. */
const TOILET = toiletShape();

describe('the designer’s dimensions dialog', () => {
	it('opens the dimensions dialog from the empty state and writes the rectangle to the OPEN asset', async () => {
		const harness = await seeded();
		await harness.seed(null); // no footprint at all
		await withBackground(harness); // and a background, so the state is `noShape` and not `noBackground`
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 1200, depth: 800 });
		const setFootprintFromDimensions = vi.spyOn(
			harness.bundle.setFootprintFromDimensions,
			'executeWithVersion',
		);

		await wrapper.find('.rp-empty-state__action').trigger('click');
		await flushPromises();

		expect(dialogs.openDialog).toHaveBeenCalledWith(expect.objectContaining({ kind: 'asset-dimensions' }));
		expect(setFootprintFromDimensions).toHaveBeenCalledWith(
			expect.objectContaining({ assetId: harness.assetId, width: 1200, depth: 800 }),
		);
		// And it really reached the vault, for the same reason `backgroundPicker.test.ts` checks
		// the note rather than trusting the spy alone.
		const stored = expectOk(await harness.sidecar.read(harness.assetId));
		expect(stored.document.shape?.footprint).toEqual({
			points: [
				{ x: -600, y: -400 },
				{ x: 600, y: -400 },
				{ x: 600, y: 400 },
				{ x: -600, y: 400 },
			],
		});
	});

	it('does nothing when the dialog is cancelled', async () => {
		const harness = await seeded();
		await harness.seed(null);
		await withBackground(harness);
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue(null);
		const setFootprintFromDimensions = vi.spyOn(
			harness.bundle.setFootprintFromDimensions,
			'executeWithVersion',
		);

		await wrapper.find('.rp-empty-state__action').trigger('click');
		await flushPromises();

		expect(setFootprintFromDimensions).not.toHaveBeenCalled();
	});

	/**
	 * **A pre-filled default is a value the user can save with one click, so a form must not
	 * offer numbers that are not measurements.** Trace a footprint on an uncalibrated
	 * background and the inspector says so — "traced before a scale existed, so these numbers
	 * are not real measurements yet" — and *Edit dimensions* then offered those exact
	 * placeholder-space numbers as the default, where Save writes them as a `typed` rectangle
	 * in true millimetres and the warning correctly disappears, because the footprint really is
	 * typed now. `DesignerInspector` was the ONLY reader of `dimensionsUnscaled` in the tree.
	 *
	 * Both halves are asserted here, because they close different things: no `initial` is the
	 * one that stops the laundering, and the `warning` is what
	 * `docs/requirements/Asset designer.md`'s "an uncalibrated surface says so wherever a
	 * measurement would otherwise appear" actually asks for. A build that only declined to
	 * pre-fill leaves the user staring at an empty form with no reason given.
	 *
	 * The dimensions are read from the REAL query rather than asserted, so `dimensionsUnscaled`
	 * here is `GetAssetDesign`'s own answer over a shape the sidecar really holds.
	 */
	it('offers no default and says why, for a footprint whose numbers are not measurements yet', async () => {
		const harness = await seeded();
		await harness.seed({ ...drawn(), footprintPending: true });
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue(null);

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		const descriptor = vi.mocked(dialogs.openDialog).mock.calls[0][0];
		expect(descriptor).not.toHaveProperty('initial');
		expect(descriptor).toHaveProperty('warning', t('en', 'designer.dimensions.unscaled'));
	});

	/** And the ordinary case keeps its default, which is what makes the absence above a decision. */
	it('offers the current rectangle back when its numbers ARE measurements', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue(null);

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		const descriptor = vi.mocked(dialogs.openDialog).mock.calls[0][0];
		expect(descriptor).toHaveProperty('initial', { width: 100, depth: 100 });
		expect(descriptor).not.toHaveProperty('warning');
	});

	/** A default is a value Save writes in one click, so it is offered in the whole millimetres the inspector shows. */
	it('offers the current dimensions back in whole millimetres', async () => {
		const harness = await seeded();
		await harness.seed({ ...drawn(), footprint: { points: [{ x: 0, y: 0 }, { x: 100.4, y: 0 }, { x: 100.4, y: 99.6 }, { x: 0, y: 99.6 }] } });
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue(null);

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		expect(vi.mocked(dialogs.openDialog).mock.calls[0][0]).toHaveProperty('initial', { width: 100, depth: 100 });
	});

	/**
	 * **Typing back the offered numbers is not an edit.** `SetAssetShapeCommand` compares nothing by
	 * design — `ALWAYS_CHANGED`, symbols spec Decision 7 — so a re-applied identical shape writes,
	 * costs a revision and pushes an undo entry that visibly undoes nothing. The guard is at
	 * `editDimensions` rather than in the command, because the command's rule is about a WHOLE shape
	 * arriving from anywhere while this is about one form's own round trip.
	 *
	 * Compared against what the form OFFERED and not against the canonical extent: `drawn()` is
	 * exactly 100 × 100, but a footprint measuring 100.4 is offered as 100, and a user typing 100
	 * back into that field means "leave it" rather than "trim four tenths".
	 *
	 * Both halves asserted, because a guard that returned early from the wrong branch would still
	 * pass one of them: nothing is dispatched, and the stored document is byte-identical — revision
	 * included, which is the half a shape comparison alone would miss.
	 */
	it('writes nothing and pushes no undo entry when the offered dimensions are typed back', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 100, depth: 100 });
		const setShape = vi.spyOn(harness.bundle.setShape, 'executeWithVersion');
		const fromDimensions = vi.spyOn(harness.bundle.setFootprintFromDimensions, 'executeWithVersion');
		const before = expectOk(await harness.sidecar.read(harness.assetId));

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		expect(setShape).not.toHaveBeenCalled();
		expect(fromDimensions).not.toHaveBeenCalled();
		const after = expectOk(await harness.sidecar.read(harness.assetId));
		expect(after.version.revision).toBe(before.version.revision);
		expect(after.document).toEqual(before.document);
	});

	/** The other arm: one number moved is an edit, so the same gesture writes. */
	it('writes when one of the offered dimensions is changed', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 100, depth: 120 });
		const setShape = vi.spyOn(harness.bundle.setShape, 'executeWithVersion');

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		expect(setShape).toHaveBeenCalled();
	});

	it('offers the same editor from the inspector once a shape exists', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue(null);

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		expect(dialogs.openDialog).toHaveBeenCalledWith(expect.objectContaining({ kind: 'asset-dimensions' }));
	});

	/**
	 * Retyping is the REPLACE path's own act — it claims an authorship the coordinates do not have.
	 * A measured TRACED footprint takes the scaling path (§3a): its corners came from the drawing and
	 * only their scale changes, so `footprintOrigin` stays `'traced'`. Nothing is put at risk by that:
	 * `CalibrateAsset`'s own docblock already states that provenance and the pending flag have no
	 * conjunction, and a calibration converts a PENDING group alone, so a non-pending, traced
	 * footprint like this one is never rescaled by a later calibration.
	 */
	it('scales a TRACED footprint and keeps it traced, since its coordinates are still measured', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 200, depth: 200 });

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		const stored = await harness.sidecar.read(harness.assetId);
		expect(isOk(stored) && stored.value.document.shape?.footprintOrigin).toBe('traced');
		expect(isOk(stored) && stored.value.document.shape?.footprintPending).toBe(false);
		// `drawn()`'s square is 100 × 100 anchored at (5, 5); doubling both axes doubles the offset
		// from the anchor on every corner.
		expectNear(
			isOk(stored) ? stored.value.document.shape?.footprint.points : undefined,
			[[-5, -5], [195, -5], [195, 195], [-5, 195]],
		);
	});

	/**
	 * Symbols spec, Decision 9 and Amendment 1: a design with details is SCALED about its anchor, not
	 * replaced by a rectangle that would throw the tank and the bowl away. ×2 on both axes, so every
	 * coordinate doubles and every bulge stays what it was.
	 */
	it('scales a design with details about its anchor, keeping every curve, as one undoable write', async () => {
		const harness = await seeded();
		await harness.seed(TOILET);
		const before = (await harness.document()).shape;
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 760, depth: 1400 });
		const fromDimensions = vi.spyOn(harness.bundle.setFootprintFromDimensions, 'executeWithVersion');

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		expect(fromDimensions).not.toHaveBeenCalled();
		const scaled = (await harness.document()).shape;
		expectNear(scaled?.footprint.points, [[-380, -700], [380, -700], [380, 320], [-380, 320]]);
		expect(scaled?.footprint.bulges).toEqual([0, 0, 1, 0]);
		// **AMENDED at AD14, not replaced.** This pinned `[[-780, -700], [780, -700], [780, 1900],
		// [-780, 1900]]` — the toilet preset's own 780 x 1300 clearance put through the same 2 x 2
		// the footprint takes — and that was the shipped behaviour ruling AD14-R1 / ADR-0034
		// supersedes deliberately. The preset's clearance is MEASURED, so it is now preserved at the
		// size its author drew and flagged for review; the numbers below are `toiletShape()`'s own,
		// unmoved. The two fixtures the card named are in `tests/domain/asset/shapeEdits.test.ts`;
		// this is the third, found by running the suite rather than by reading the card.
		expectNear(scaled?.clearance?.points, [[-390, -350], [390, -350], [390, 950], [-390, 950]]);
		expect(scaled?.clearanceNeedsReview).toBe(true);
		expectNear(scaled?.details[0].outline.points, [[-380, -700], [380, -700], [380, -300], [-380, -300]]);
		expectNear(scaled?.details[1].outline.points, [[-304, 54], [304, 54], [304, 346], [-304, 346]]);
		expect(scaled?.details[1].outline.bulges).toEqual([1, 0, 1, 0]);
		expect(scaled?.anchor).toEqual({ x: 0, y: 0 });

		const undo = wrapper.findAll('.rp-designer-tools button').find((button) => button.text() === t('en', 'designer.toolbar.undo'));
		await undo?.trigger('click');
		await flushPromises();

		expect((await harness.document()).shape).toEqual(before);
	});

	/** The other arm of the same rule: no details, but a curved footprint, is still scaled — about an anchor that is NOT the origin. */
	it('scales a design whose footprint curves, even with no details', async () => {
		const harness = await seeded();
		await harness.seed({ ...drawn(), footprint: circle(1000), clearance: null });
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 2000, depth: 2000 });
		const fromDimensions = vi.spyOn(harness.bundle.setFootprintFromDimensions, 'executeWithVersion');
		const setShape = vi.spyOn(harness.bundle.setShape, 'executeWithVersion');

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		expect(fromDimensions).not.toHaveBeenCalled();
		expect(setShape).toHaveBeenCalledTimes(1);
		const footprint = (await harness.document()).shape?.footprint;
		// Solved per axis (`scaleDesignToDimensions`), not divided: pass 1 (width) moves depth off
		// 1000 to about 1081.1388 as a side effect — a circle's bulge keeps its sagitta tied to its
		// chord, so widening x alone bows the y-reach too — and pass 2 then solves 2000 / 1081.1388
		// rather than dividing by 2. That secant lands within `solveScale`'s 1e-6 tolerance rather
		// than exactly on the target, which is why the last digits below are not whole millimetres;
		// asserted to 3 decimal places rather than the usual 6 for that reason. `drawn()`'s anchor
		// is (5, 5).
		expectNear(footprint?.points, [[-5, -1005], [995, -5], [-5, 995], [-1005, -5]], 3);
		const quarter = Math.tan(Math.PI / 8);
		expect(footprint?.bulges).toEqual([quarter, quarter, quarter, quarter]);
	});

	/**
	 * …but not while the footprint is still PENDING (Amendment 1): its coordinates are placeholder
	 * pixels, so a scale would write the typed millimetres into a footprint that goes on reading as
	 * unscaled, and a later calibration would multiply them. The typed rectangle replaces it instead.
	 */
	it('replaces a PENDING curved footprint with a typed rectangle rather than scaling its placeholder pixels', async () => {
		const harness = await seeded();
		await harness.seed({ ...drawn(), footprint: circle(1000), clearance: null, footprintPending: true });
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 2000, depth: 1000 });
		const setShape = vi.spyOn(harness.bundle.setShape, 'executeWithVersion');

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		expect(setShape).not.toHaveBeenCalled();
		const shape = (await harness.document()).shape;
		expect(shape?.footprintOrigin).toBe('typed');
		expect(shape?.footprintPending).toBe(false);
		expect(shape?.footprint.bulges).toBeUndefined();
	});

	/** A scale the domain refuses is REPORTED, and dispatches nothing — never swallowed as a silent no-op. */
	it('reports a scale the domain refuses and writes nothing', async () => {
		activateNotices();
		Notice.shown.length = 0;
		const harness = await seeded();
		await harness.seed(TOILET);
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 0, depth: 1400 });
		const setShape = vi.spyOn(harness.bundle.setShape, 'executeWithVersion');

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		expect(setShape).not.toHaveBeenCalled();
		expect(Notice.shown).toEqual([t('en', 'asset.invalid-scale')]);
		expect((await harness.document()).shape).toEqual(TOILET);
	});

	/**
	 * A footprint in real millimetres is SCALED whatever it is drawn as. The old branch scaled only a
	 * design with details or a curved edge, so a straight traced outline with a notch — an L-shaped
	 * counter — was silently squared off into a centred rectangle (consolidation spec §3).
	 */
	it('scales a calibrated L-shaped footprint instead of squaring it off', async () => {
		const harness = await seeded();
		// 1000 x 600 overall, six corners, the notch in the +x/+y quadrant.
		await harness.seed({
			...drawn(),
			footprint: {
				points: [
					{ x: -500, y: -300 },
					{ x: 500, y: -300 },
					{ x: 500, y: 0 },
					{ x: 0, y: 0 },
					{ x: 0, y: 300 },
					{ x: -500, y: 300 },
				],
			},
			clearance: null,
			anchor: { x: 0, y: 0 },
		});
		const { wrapper, dialogs } = await mountDesigner(harness);
		vi.spyOn(dialogs, 'openDialog').mockResolvedValue({ width: 2000, depth: 300 });
		const fromDimensions = vi.spyOn(harness.bundle.setFootprintFromDimensions, 'executeWithVersion');

		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');
		await flushPromises();

		expect(fromDimensions).not.toHaveBeenCalled();
		const footprint = (await harness.document()).shape?.footprint;
		// x doubled and y halved about the anchor at the origin; the notch is still there.
		expectNear(footprint?.points, [[-1000, -150], [1000, -150], [1000, 0], [0, 0], [0, 150], [-1000, 150]]);
	});
});

/**
 * `DesignerInspector.test.ts` drives the height field against a MOCKED `setHeight` prop, which
 * proves the field's own commit/error/reset behaviour without touching a vault at all. This is
 * the wiring proof for the prop itself — `DesignerRuntime.commitHeight`, dispatched through the
 * real `SetAssetHeightCommand` over the harness's own note — the same split the dimensions
 * dialog above draws between its component test and this file's end-to-end one.
 */
describe('the inspector’s height field, wired for real', () => {
	it('writes the height to the OPEN asset’s note through the real command', async () => {
		const harness = await seeded();
		await harness.seed(drawn());
		const { wrapper } = await mountDesigner(harness);

		const input = wrapper.find('input[name="height"]');
		await input.setValue('1300');
		await input.trigger('blur');
		await flushPromises();

		expect(await harness.height()).toBe(1300);
	});
});
