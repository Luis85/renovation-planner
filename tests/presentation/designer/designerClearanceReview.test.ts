/**
 * @vitest-environment jsdom
 *
 * AD14's inspector block: the notice a PRESERVED clearance carries after a resize, and the one
 * action that answers it.
 *
 * Mounted BARE against a fake `editShape` that applies the edit it is handed to a live shape, so a
 * case asserts the SHAPE a press would write rather than which function it happened to name —
 * `designerReferencePanels.test.ts`'s rig, and its last describe's rule too: a component proven
 * bare and bound to nothing is the shape this repository refuses, so the real `DesignerInspector`
 * is mounted as well.
 *
 * The fixture design has NO clearance, so every case here supplies one. That is deliberate rather
 * than awkward: `validateAssetShape` refuses `clearanceNeedsReview` on a shape with no boundary, so
 * a case that forgot the clearance would be describing a state the domain cannot hold.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import DesignerClearanceReview from '../../../src/presentation/designer/inspector/DesignerClearanceReview.vue';
import DesignerClearanceHelper from '../../../src/presentation/designer/inspector/DesignerClearanceHelper.vue';
import DesignerInspector from '../../../src/presentation/designer/inspector/DesignerInspector.vue';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { AssetDesignDto } from '../../../src/application/queries/GetAssetDesign';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { validateAssetShape } from '../../../src/domain/asset/AssetShape';
import { scaleDesign } from '../../../src/domain/asset/shapeEdits';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { expectOk } from '../../helpers/domain';
import { recorder } from '../../helpers/logger';

type NullableEdit = (shape: AssetShape) => Result<AssetShape, ValidationError> | null;

/**
 * The Reviewed control, found through a FUNCTION rather than through a shared selector constant:
 * `oxlint`'s `unicorn/no-array-callback-reference` refuses an identifier handed to anything named
 * `find`, and a `VueWrapper` has one. `data-rp-action` is what the suites select on here, the same
 * attribute `DesignerUsePlan` uses — a class is for appearance, an action attribute for identity.
 */
const control = (wrapper: VueWrapper): ReturnType<VueWrapper['find']> => wrapper.find('[data-rp-action="clearance-reviewed"]');

/** A rectangle wide enough to stand outside the fixture's 1200 x 800 footprint. */
const BOUNDARY = { points: [{ x: -900, y: -700 }, { x: 900, y: -700 }, { x: 900, y: 700 }, { x: -900, y: 700 }] };

/**
 * The fixture design with a MEASURED clearance, optionally already flagged. Built through
 * `validateAssetShape` rather than as a literal, so a case cannot describe a shape the domain would
 * refuse — which is exactly the state this flag has a validation rule about.
 */
function designWithClearance(clearanceNeedsReview: boolean): AssetDesignDto {
	const base = assetDesign();
	if (base.shape === null) throw new Error('the fixture carries a shape');
	const shape = expectOk(validateAssetShape({ ...base.shape, clearance: BOUNDARY, clearanceNeedsReview }));
	return assetDesign({ shape, clearanceExtent: { width: 1800, depth: 1400 } });
}

/** `designerReferencePanels.test.ts`'s fake write chain: `writes` are the shapes that really dispatch. */
function chain(shape: AssetShape) {
	let live = shape;
	const writes: AssetShape[] = [];
	const editShape = vi.fn<(edit: NullableEdit) => Promise<DispatchResult>>((edit) => {
		const result = edit(live);
		if (result === null) return Promise.resolve(ok('no-write'));
		if (result.ok) {
			live = result.value;
			writes.push(result.value);
		}
		return Promise.resolve(result.ok ? ok('wrote') : err(result.error));
	});
	return { editShape, writes };
}

async function pressReviewed(wrapper: VueWrapper): Promise<void> {
	await control(wrapper).trigger('click');
	await flushPromises();
}

/**
 * **THIS DESCRIBE IS DELIBERATELY RED, and the candidate is not broken.** It is the assertion that
 * fails without an integration change request AD14 may not apply itself, in the idiom the wave-4
 * ledger prescribed for exactly this shape and `ADQ-reference-view-and-deletion.md` already used:
 * the worker writes the case, the integrator applies the line, and this is what turns green.
 *
 * **The gap.** AD14-R1 states the rule as *cleared by any write whose SUBJECT is the clearance
 * itself*, and names the four-side helper's regeneration as one of them. That write lives in
 * `DesignerClearanceHelper.vue` — a file in NO wave-5 row — and its `validateAssetShape({ ...design,
 * clearance: …, clearancePending: … })` spread carries the review flag through unchanged, so a user
 * who answers the notice by generating a fresh boundary gets a new clearance with the old notice
 * still standing over it. The request is one line, `clearanceNeedsReview: false`, in that call.
 *
 * It is a stale NOTICE and not lost data, which is why the card ships rather than waiting: every
 * other clearing site is inside this card's lease and is driven above and in
 * `tests/application/commands/asset/assetClearanceReview.test.ts`.
 */
describe('the four-side helper, which is the one clearing site AD14 cannot reach', () => {
	it('clears the review flag when it regenerates the boundary, once the integrator adds the line', async () => {
		const design = designWithClearance(true);
		const { editShape, writes } = chain(design.shape as AssetShape);
		const wrapper = mount(DesignerClearanceHelper, { props: { design, editShape } });

		await wrapper.find('[name="generate-clearance"]').trigger('click');
		await flushPromises();

		expect(writes).toHaveLength(1);
		expect(writes[0].clearanceNeedsReview).toBe(false);
	});
});

describe('the clearance review block', () => {
	it('draws nothing while the flag is down, which is every ordinary state of this panel', () => {
		const design = designWithClearance(false);
		const { editShape } = chain(design.shape as AssetShape);
		const wrapper = mount(DesignerClearanceReview, { props: { design, editShape } });

		expect(control(wrapper).exists()).toBe(false);
		expect(wrapper.text()).toBe('');
	});

	it('draws nothing for a design with no shape at all, rather than reading through a null', () => {
		const design = assetDesign({ shape: null, dimensions: null });
		const wrapper = mount(DesignerClearanceReview, { props: { design, editShape: chain({} as AssetShape).editShape } });

		expect(control(wrapper).exists()).toBe(false);
	});

	/**
	 * **Drawn, never `:disabled`.** A control that is drawn and can only refuse is the live control
	 * that does nothing, which this expansion has shipped three times — so this case asserts the
	 * button's ABSENCE above and its presence here, rather than an attribute on a permanent one.
	 */
	it('says what happened and offers the action once the flag is set', () => {
		const design = designWithClearance(true);
		const { editShape } = chain(design.shape as AssetShape);
		const wrapper = mount(DesignerClearanceReview, { props: { design, editShape } });

		expect(wrapper.text()).toContain(t('en', 'designer.clearance.review.notice'));
		expect(control(wrapper).text()).toBe(t('en', 'designer.clearance.review.action'));
		expect(control(wrapper).attributes('disabled')).toBeUndefined();
	});

	it('writes the flag down and moves not one coordinate when it is pressed', async () => {
		const design = designWithClearance(true);
		const { editShape, writes } = chain(design.shape as AssetShape);
		const wrapper = mount(DesignerClearanceReview, { props: { design, editShape } });

		await pressReviewed(wrapper);

		expect(writes).toHaveLength(1);
		expect(writes[0].clearanceNeedsReview).toBe(false);
		expect(writes[0].clearance?.points).toEqual(BOUNDARY.points);
		expect(writes[0].footprint.points).toEqual(design.shape?.footprint.points);
	});

	/**
	 * The whole gesture end to end through the REAL inspector, which is what C12 asks for — *"tests
	 * must exercise actual command wiring, not only component existence"*. The shape handed in is
	 * the one `scaleDesign` really produces, so the premise of the notice is the domain's own
	 * answer rather than a flag a fixture set by hand.
	 */
	it('appears in the real inspector after a real resize, and the real press answers it', async () => {
		const design = designWithClearance(false);
		const resized = expectOk(scaleDesign(design.shape as AssetShape, 0.5, 0.5));
		expect(resized.clearanceNeedsReview).toBe(true);

		const { editShape, writes } = chain(resized);
		const wrapper = mount(DesignerInspector, {
			props: {
				design: assetDesign({ shape: resized }),
				setHeight: vi.fn<(height: number | null) => Promise<DispatchResult>>().mockResolvedValue(ok('wrote')),
				editDimensions: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
				activateAnchorTool: vi.fn<() => void>(),
				removeBackground: async (): Promise<void> => {},
				logger: recorder,
				selection: null,
				lockedGraphics: new Set<string>(),
				editShape,
				select: vi.fn<(next: DesignerSelection | null) => void>(),
				selected: [],
			},
		});

		expect(control(wrapper).exists()).toBe(true);

		await pressReviewed(wrapper);

		expect(writes).toHaveLength(1);
		expect(writes[0].clearanceNeedsReview).toBe(false);
	});
});
