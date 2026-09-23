/**
 * @vitest-environment jsdom
 *
 * AD12's three inspector blocks — the reference's status, the placement presets and the
 * four-side clearance helper — mounted BARE against a fake `editShape` that applies the edit it
 * is handed to a live shape, so a case asserts the SHAPE a control would write rather than which
 * function it happened to name. The last describe mounts the real `DesignerInspector`, because a
 * component proven bare and bound to nothing is the shape this repository refuses.
 *
 * The fixture footprint is `footprintFromDimensions(1200, 800)` through `assetDesign` — centred
 * on the origin, so the default anchor at (0, 0) already sits on the `centre` preset and a case
 * about `back-centre` cannot pass by landing on the value that was there.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import DesignerReferenceStatus from '../../../src/presentation/designer/inspector/DesignerReferenceStatus.vue';
import DesignerReferencePlacement from '../../../src/presentation/designer/inspector/DesignerReferencePlacement.vue';
import DesignerClearanceHelper from '../../../src/presentation/designer/inspector/DesignerClearanceHelper.vue';
import DesignerInspector from '../../../src/presentation/designer/inspector/DesignerInspector.vue';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { AssetDesignDto } from '../../../src/application/queries/GetAssetDesign';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import type { Calibration } from '../../../src/domain/plan/Calibration';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { recorder } from '../../helpers/logger';

type NullableEdit = (shape: AssetShape) => Result<AssetShape, ValidationError> | null;

const CALIBRATION: Calibration = {
	pointA: { x: 0, y: 0 },
	pointB: { x: 800, y: 0 },
	knownDistance: 800,
	pixelsPerWorldUnit: 1,
};

/**
 * `DesignerReferenceStatus.removeBackground` is REQUIRED, so every mount must bind one. None of the
 * cases in this file presses Remove — they are all about what the block SAYS — so this is a no-op
 * rather than a spy: a `vi.fn()` nobody asserts on reads as an assertion somebody forgot to write.
 * The gesture itself is driven, through the real inspector, in `designerReferenceView.test.ts`.
 */
const removeBackground = async (): Promise<void> => {};

/** The fixture shape, which `assetDesign` always supplies — read once so cases can vary one flag. */
function baseShape(design: AssetDesignDto = assetDesign()): AssetShape {
	if (design.shape === null) throw new Error('the fixture carries a shape');
	return design.shape;
}

/**
 * The fake write chain, `designerArrangePanel.test.ts`'s: `writes` counts the shapes that would
 * actually be DISPATCHED, which is not the same as the calls — an edit answering `null` resolves
 * `no-write` and pushes no undo entry, and that difference is contract C05's no-op half.
 */
function chain(shape: AssetShape, refusal?: ValidationError) {
	let live = shape;
	const writes: AssetShape[] = [];
	const editShape = vi.fn<(edit: NullableEdit) => Promise<DispatchResult>>((edit) => {
		if (refusal !== undefined) return Promise.resolve(err(refusal));
		const result = edit(live);
		if (result === null) return Promise.resolve(ok('no-write'));
		if (result.ok) {
			live = result.value;
			writes.push(result.value);
		}
		return Promise.resolve(result.ok ? ok('wrote') : err(result.error));
	});
	return {
		editShape,
		writes,
		written: (): AssetShape => live,
		/** What a PEER leaf wrote between this render and the press — the one window a drawn control cannot close. */
		advance: (next: AssetShape): void => {
			live = next;
		},
	};
}

async function press(wrapper: VueWrapper, name: string): Promise<void> {
	await wrapper.find(`[name="${name}"]`).trigger('click');
	await flushPromises();
}

async function type(wrapper: VueWrapper, name: string, value: string): Promise<void> {
	const field = wrapper.find(`[name="${name}"]`);
	(field.element as HTMLInputElement).value = value;
	await field.trigger('input');
}

describe('the reference status block', () => {
	// The FACTS BLOCK is what draws nothing here, and since AD18 item 7 that is no longer the whole
	// component: the trace checklist is a SIBLING of this block, so the Reference panel itself draws
	// five rows in exactly this state. This case measures the block's own predicate, which is
	// unchanged and still right — a block of "none" rows would be the noise its docblock always said
	// it would be. The name used to say "draws nothing at all" and stopped being true the moment the
	// checklist landed beside it.
	it('draws no reference FACTS block for an asset typed from dimensions with no sheet', () => {
		const design = assetDesign({ background: null, calibration: null });
		const wrapper = mount(DesignerReferenceStatus, { props: { design, removeBackground } });
		expect(wrapper.find('.rp-designer-reference').exists()).toBe(false);
	});

	it('names the sheet and its page, so a trace off page 4 of a catalogue is not read as page 1', () => {
		const design = assetDesign({ background: { path: 'Specs/deep/catalogue.pdf', kind: 'pdf', page: 4 } });
		const wrapper = mount(DesignerReferenceStatus, { props: { design, removeBackground } });
		expect(wrapper.text()).toContain(t('en', 'designer.reference.sheet.page', { name: 'catalogue.pdf', page: '4' }));
	});

	it.each([
		[null, 'designer.reference.scale.none' as const],
		[CALIBRATION, 'designer.reference.scale.set' as const],
	])('says whether the sheet carries a scale', (calibration, key) => {
		const wrapper = mount(DesignerReferenceStatus, { props: { design: assetDesign({ calibration }), removeBackground } });
		expect(wrapper.text()).toContain(t('en', key));
	});

	/**
	 * The warning AD12's third acceptance criterion is about. All four groups, because the
	 * inspector's existing `designer.dimensions.unscaled` warns about the footprint alone and a
	 * pending clearance, anchor or graphic had nothing anywhere saying so.
	 */
	it('names every coordinate group still in reference pixels, not just the footprint', () => {
		const shape: AssetShape = {
			...baseShape(),
			footprintPending: true,
			clearance: { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
			clearancePending: true,
			anchorPending: true,
			details: [{ id: 'd1', name: 'top', outline: { points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] }, line: 'solid', pending: true }],
		};
		const wrapper = mount(DesignerReferenceStatus, { props: { design: assetDesign({ shape }), removeBackground } });
		expect(wrapper.findAll('.rp-designer-unscaled')).toHaveLength(4);
		expect(wrapper.text()).toContain(t('en', 'designer.reference.pending.hint'));
	});

	it('names the sheet for an asset with nothing traced on it yet', () => {
		const design = assetDesign({ shape: null });
		const wrapper = mount(DesignerReferenceStatus, { props: { design, removeBackground } });
		expect(wrapper.find('.rp-designer-reference').exists()).toBe(true);
		expect(wrapper.findAll('.rp-designer-unscaled')).toHaveLength(0);
	});

	/** A pending group is enough on its own: those numbers are not millimetres whatever the note says. */
	it('draws while a group is pending even with no sheet and no scale recorded', () => {
		const shape: AssetShape = { ...baseShape(), footprintOrigin: 'traced', footprintPending: true };
		const design = assetDesign({ background: null, calibration: null, shape });
		const wrapper = mount(DesignerReferenceStatus, { props: { design, removeBackground } });
		expect(wrapper.find('.rp-designer-reference').exists()).toBe(true);
	});

	it('names none, and offers no hint, for a design whose every group is measured', () => {
		const wrapper = mount(DesignerReferenceStatus, { props: { design: assetDesign({ calibration: CALIBRATION }), removeBackground } });
		expect(wrapper.findAll('.rp-designer-unscaled')).toHaveLength(0);
		expect(wrapper.text()).not.toContain(t('en', 'designer.reference.pending.hint'));
	});
});

describe('the placement presets', () => {
	it('reads the anchor as the preset it is sitting on', () => {
		const { editShape } = chain(baseShape());
		const wrapper = mount(DesignerReferencePlacement, { props: { design: assetDesign(), editShape } });
		expect(wrapper.text()).toContain(t('en', 'designer.placement.centre'));
		expect(wrapper.find('[name="placement-centre"]').attributes('aria-pressed')).toBe('true');
	});

	it('reads an anchor on neither preset as a custom point', () => {
		const shape: AssetShape = { ...baseShape(), anchor: { x: 123, y: 45 } };
		const { editShape } = chain(shape);
		const wrapper = mount(DesignerReferencePlacement, { props: { design: assetDesign({ shape }), editShape } });
		expect(wrapper.text()).toContain(t('en', 'designer.placement.custom'));
	});

	it('moves the anchor to the back of the facing frame, and changes nothing else', async () => {
		const shape = baseShape();
		const { editShape, writes, written } = chain(shape);
		const wrapper = mount(DesignerReferencePlacement, { props: { design: assetDesign({ shape }), editShape } });

		await press(wrapper, 'placement-back-centre');

		expect(writes).toHaveLength(1);
		// Facing 0 on a 1200 x 800 rectangle centred on the origin: the back edge's middle.
		expect(written().anchor.x).toBeCloseTo(-600, 9);
		expect(written().anchor.y).toBeCloseTo(0, 9);
		expect(written().footprint).toEqual(shape.footprint);
		expect(written().facing).toBe(shape.facing);
	});

	/** C05: a press that would change nothing dispatches nothing, so it pushes no undo entry. */
	it('writes nothing when the anchor is already on the preset pressed', async () => {
		const { editShape, writes } = chain(baseShape());
		const wrapper = mount(DesignerReferencePlacement, { props: { design: assetDesign(), editShape } });

		await press(wrapper, 'placement-centre');

		expect(editShape).toHaveBeenCalledTimes(1);
		expect(writes).toHaveLength(0);
	});

	/**
	 * C07's coordinate spaces. A preset point is DERIVED from the footprint, so an anchor derived
	 * from an outline still in sheet pixels is itself in sheet pixels — and the calibration that
	 * converts the outline must convert this too. Watched failing first: leaving `anchorPending`
	 * alone reported `false` here, which is a silent claim of millimetres.
	 */
	it('marks a derived anchor pending exactly when the footprint it came from is', async () => {
		// `footprintOrigin: 'traced'` beside the flag, because `validateAssetShape` refuses a TYPED
		// footprint that claims to be pending — typed geometry is authored in millimetres and was
		// never in the sheet's space. The first draft of this case set the flag alone, the edit was
		// refused, and the assertion read the fixture's own untouched `false`.
		const shape: AssetShape = { ...baseShape(), footprintOrigin: 'traced', footprintPending: true, anchorPending: false };
		const { editShape, written } = chain(shape);
		const wrapper = mount(DesignerReferencePlacement, { props: { design: assetDesign({ shape }), editShape } });

		await press(wrapper, 'placement-back-centre');

		expect(written().anchorPending).toBe(true);
	});

	it.each([
		[0, 'designer.placement.front.right' as const],
		[Math.PI / 2, 'designer.placement.front.down' as const],
		[Math.PI, 'designer.placement.front.left' as const],
		[(3 * Math.PI) / 2, 'designer.placement.front.up' as const],
	])('says where the front points at facing %s', (facing, key) => {
		const shape: AssetShape = { ...baseShape(), facing };
		const { editShape } = chain(shape);
		const wrapper = mount(DesignerReferencePlacement, { props: { design: assetDesign({ shape }), editShape } });
		expect(wrapper.text()).toContain(t('en', key));
	});

	it('falls back to an angle measured from a named direction for a front between two axes', () => {
		const shape: AssetShape = { ...baseShape(), facing: Math.PI / 4 };
		const { editShape } = chain(shape);
		const wrapper = mount(DesignerReferencePlacement, { props: { design: assetDesign({ shape }), editShape } });
		expect(wrapper.text()).toContain(t('en', 'designer.placement.front.angle', { degrees: '45' }));
	});

	/**
	 * The anchor is already ON the preset and its FLAG disagrees with the footprint's, which is a
	 * real difference: the point means millimetres or sheet pixels depending on that flag alone. The
	 * coincidence check is therefore not the whole no-op question, and this is the case that says so.
	 */
	it('writes when only the pending flag is wrong, because the flag is what the point means', async () => {
		const shape: AssetShape = { ...baseShape(), footprintOrigin: 'traced', footprintPending: true, anchorPending: false };
		const { editShape, writes, written } = chain(shape);
		const wrapper = mount(DesignerReferencePlacement, { props: { design: assetDesign({ shape }), editShape } });

		await press(wrapper, 'placement-centre');

		expect(writes).toHaveLength(1);
		expect(written().anchor).toEqual(shape.anchor);
		expect(written().anchorPending).toBe(true);
	});

	/** A footprint the frame cannot measure is nothing to do, not a throw and not a refusal. */
	it('writes nothing for a footprint with no coordinates to measure', async () => {
		const shape: AssetShape = { ...baseShape(), footprint: { points: [] } };
		const { editShape, writes } = chain(shape);
		const wrapper = mount(DesignerReferencePlacement, { props: { design: assetDesign({ shape }), editShape } });

		await press(wrapper, 'placement-back-centre');

		expect(editShape).toHaveBeenCalledTimes(1);
		expect(writes).toHaveLength(0);
	});

	it('shows a refused write beside the controls rather than swallowing it', async () => {
		const refusal: ValidationError = { category: 'Validation', code: 'asset.invalid-footprint', message: 'no' };
		const { editShape } = chain(baseShape(), refusal);
		const wrapper = mount(DesignerReferencePlacement, { props: { design: assetDesign(), editShape } });

		await press(wrapper, 'placement-back-centre');

		expect(wrapper.find('[role="alert"]').exists()).toBe(true);
	});

	it('draws nothing for an asset with no shape to place', () => {
		const { editShape } = chain(baseShape());
		const wrapper = mount(DesignerReferencePlacement, { props: { design: assetDesign({ shape: null }), editShape } });
		expect(wrapper.find('.rp-designer-placement').exists()).toBe(false);
	});
});

describe('the four-side clearance helper', () => {
	function mountHelper(shape: AssetShape, refusal?: ValidationError) {
		const built = chain(shape, refusal);
		return {
			...built,
			wrapper: mount(DesignerClearanceHelper, { props: { design: assetDesign({ shape }), editShape: built.editShape } }),
		};
	}

	it('offers four fields for a rectangular outline whose front lies on an axis', () => {
		const { wrapper } = mountHelper(baseShape());
		for (const side of ['front', 'back', 'left', 'right']) {
			expect(wrapper.find(`[name="clearance-${side}"]`).exists()).toBe(true);
		}
		expect(wrapper.text()).toContain(t('en', 'designer.clearance.hint'));
	});

	/**
	 * AD18-R16 Task 5's follow-up: the same compact-row PRESENTATION `DesignerFieldRow` draws,
	 * without swapping the component in — the draft stays raw text (C03, asserted below by the
	 * cases that still commit only on the Generate press). A short visible label, the existing
	 * sentence carried over as the accessible name, and the `mm` suffix withheld from it.
	 */
	it('draws each side as a compact row: a short visible label, the full sentence as the accessible name, and an mm suffix', () => {
		const { wrapper } = mountHelper(baseShape());
		const rows = wrapper.findAll('.rp-designer-field-row');

		expect(rows).toHaveLength(4);
		([
			['front', 'designer.clearance.front.short', 'designer.clearance.front'],
			['back', 'designer.clearance.back.short', 'designer.clearance.back'],
			['left', 'designer.clearance.left.short', 'designer.clearance.left'],
			['right', 'designer.clearance.right.short', 'designer.clearance.right'],
		] as const).forEach(([side, shortKey, labelKey], index) => {
			expect(rows[index].find('.rp-designer-field-row__label').text()).toBe(t('en', shortKey));
			expect(wrapper.find(`[name="clearance-${side}"]`).attributes('aria-label')).toBe(t('en', labelKey));
			expect(rows[index].find('.rp-designer-field-row__unit').text()).toBe('mm');
		});
	});

	/**
	 * C07: four setbacks are not what an arbitrary curved outline means. WITHHELD rather than
	 * disabled — a live control that can only refuse is the defect AD10's review already found.
	 */
	it('withholds every field for a curved outline and says what it needs', () => {
		const shape: AssetShape = { ...baseShape(), footprint: { ...baseShape().footprint, bulges: [0, 0.4, 0, 0] } };
		const { wrapper } = mountHelper(shape);
		expect(wrapper.find('[name="clearance-front"]').exists()).toBe(false);
		expect(wrapper.find('[name="generate-clearance"]').exists()).toBe(false);
		expect(wrapper.text()).toContain(t('en', 'designer.clearance.unsupported'));
	});

	it('withholds every field while the front points between two axes, because left and right name nothing', () => {
		const { wrapper } = mountHelper({ ...baseShape(), facing: Math.PI / 3 });
		expect(wrapper.find('[name="clearance-front"]').exists()).toBe(false);
		expect(wrapper.text()).toContain(t('en', 'designer.clearance.unsupported'));
	});

	it('generates a boundary standing off each side by its own number', async () => {
		const { wrapper, written, writes } = mountHelper(baseShape());
		await type(wrapper, 'clearance-front', '300');
		await type(wrapper, 'clearance-back', '50');
		await type(wrapper, 'clearance-left', '20');
		await type(wrapper, 'clearance-right', '30');

		await press(wrapper, 'generate-clearance');

		expect(writes).toHaveLength(1);
		// Footprint x −600…600, y −400…400; facing 0, so front is +x and the object's left is −y.
		expect(written().clearance?.points).toEqual([
			{ x: -650, y: -420 },
			{ x: 900, y: -420 },
			{ x: 900, y: 430 },
			{ x: -650, y: 430 },
		]);
	});

	it('marks a generated boundary pending exactly when the footprint it was measured off is', async () => {
		// Traced, for the reason the placement case beside it records: a typed footprint may not be pending.
		const { wrapper, written } = mountHelper({ ...baseShape(), footprintOrigin: 'traced', footprintPending: true });
		await type(wrapper, 'clearance-front', '300');

		await press(wrapper, 'generate-clearance');

		expect(written().clearancePending).toBe(true);
	});

	/**
	 * The preservation half of C07: an arbitrary traced boundary is never READ BACK into four
	 * numbers. The fields stay empty beside one, and the only thing that touches it is the press.
	 */
	it('never turns an existing boundary into four numbers, and warns that generating replaces it', () => {
		const traced = { points: [{ x: -700, y: -500 }, { x: 700, y: -500 }, { x: 0, y: 900 }] };
		const { wrapper } = mountHelper({ ...baseShape(), clearance: traced });
		expect((wrapper.find('[name="clearance-front"]').element as HTMLInputElement).value).toBe('');
		expect(wrapper.text()).toContain(t('en', 'designer.clearance.replaces'));
	});

	it('leaves the traced boundary alone until the button is pressed', async () => {
		const traced = { points: [{ x: -700, y: -500 }, { x: 700, y: -500 }, { x: 0, y: 900 }] };
		const { wrapper, written } = mountHelper({ ...baseShape(), clearance: traced });
		await type(wrapper, 'clearance-front', '300');
		expect(written().clearance).toEqual(traced);

		await press(wrapper, 'generate-clearance');

		expect(written().clearance).not.toEqual(traced);
	});

	/**
	 * No local number guard: a setback that collapses the rectangle reaches `validateAssetShape`
	 * through the same door every other edit takes, and comes back as a coded refusal this panel
	 * shows.
	 *
	 * Each side is pulled in by exactly the footprint's 400 mm half-depth, which lands both edges on
	 * y = 0 and leaves a rectangle with no area. A first draft used -700 either side and the write
	 * SUCCEEDED: pulling past the middle does not collapse a rectangle, it turns it inside out, and
	 * the result still encloses an area. The refusal is about area, not about the sign of a number.
	 */
	it('draws nothing for an asset with no outline to stand off', () => {
		const built = chain(baseShape());
		const wrapper = mount(DesignerClearanceHelper, {
			props: { design: assetDesign({ shape: null }), editShape: built.editShape },
		});
		expect(wrapper.find('.rp-designer-clearance').exists()).toBe(false);
	});

	/**
	 * The one window a drawn control cannot close: a peer leaf replaces the outline with a curve
	 * between this render and the press. The step re-derives from the shape it was HANDED, so the
	 * press writes nothing rather than generating a rectangle around an outline that is no longer
	 * rectangular.
	 */
	it('writes nothing when a peer leaf made the outline unsupported since the fields were drawn', async () => {
		const { wrapper, writes, advance } = mountHelper(baseShape());
		await type(wrapper, 'clearance-front', '300');
		advance({ ...baseShape(), footprint: { ...baseShape().footprint, bulges: [0, 0.4, 0, 0] } });

		await press(wrapper, 'generate-clearance');

		expect(writes).toHaveLength(0);
	});

	it('shows the domain’s refusal for allowances that collapse the boundary', async () => {
		const { wrapper, writes } = mountHelper(baseShape());
		await type(wrapper, 'clearance-left', '-400');
		await type(wrapper, 'clearance-right', '-400');

		await press(wrapper, 'generate-clearance');

		expect(writes).toHaveLength(0);
		expect(wrapper.find('[role="alert"]').exists()).toBe(true);
	});
});

describe('mounted in the real inspector', () => {
	it('draws all three blocks, bound to the leaf’s own write door', async () => {
		const shape = baseShape();
		const { editShape, writes } = chain(shape);
		const wrapper = mount(DesignerInspector, {
			props: {
				design: assetDesign({ shape, calibration: CALIBRATION }),
				setHeight: vi.fn<(height: number | null) => Promise<DispatchResult>>().mockResolvedValue(ok('wrote')),
				editDimensions: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
				logger: recorder,
				removeBackground,
				selection: null,
				lockedGraphics: new Set<string>(),
				editShape,
				select: vi.fn<(next: DesignerSelection | null) => void>(),
				selected: [],
			},
		});

		expect(wrapper.find('.rp-designer-reference').exists()).toBe(true);
		expect(wrapper.find('.rp-designer-placement').exists()).toBe(true);
		expect(wrapper.find('.rp-designer-clearance').exists()).toBe(true);

		await press(wrapper, 'placement-back-centre');
		expect(writes).toHaveLength(1);
	});
});
