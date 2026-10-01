/**
 * @vitest-environment jsdom
 *
 * The read-only `Source & scale` block (AD18-R17, board 01). Both rows are READ off facts the design
 * DTO already carries — `shape.footprintOrigin` and `dimensionsUnscaled` — so each case varies exactly
 * one of them and asserts the sentence it selects. No control, because `Mark as needs verification`
 * is carved out of the ruling (it would be a stored field).
 */
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DesignerSourceScale from '../../../src/presentation/designer/inspector/DesignerSourceScale.vue';
import DesignerInspector from '../../../src/presentation/designer/inspector/DesignerInspector.vue';
import { ok } from '../../../src/core/result/Result';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { AssetDesignDto } from '../../../src/application/queries/GetAssetDesign';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { fitFootprintToDetails } from '../../../src/domain/asset/detailEdits';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import type { EditShape } from '../../../src/presentation/designer/selection/editShape';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { recorder } from '../../helpers/logger';
import { expectOk } from '../../helpers/domain';

function shapeWith(overrides: Partial<AssetShape>): AssetShape {
	const { shape } = assetDesign();
	if (shape === null) throw new Error('the fixture carries a shape');
	return { ...shape, ...overrides };
}

function rows(design: AssetDesignDto): string[][] {
	const wrapper = mount(DesignerSourceScale, { props: { design } });
	return wrapper.findAll('dt').map((term, index) => [term.text(), wrapper.findAll('dd')[index]?.text() ?? '']);
}

describe('the Source & scale block', () => {
	it('names a typed footprint, measured', () => {
		expect(rows(assetDesign())).toEqual([
			[t('en', 'designer.source'), t('en', 'designer.source.typed')],
			[t('en', 'designer.source.dimensions-set'), t('en', 'designer.source.dimensions-set.yes')],
		]);
	});

	/**
	 * `typed` is what the value MEANS (authored in millimetres, `validateAssetShape`'s own words),
	 * not the gesture "typed dimensions": Fit footprint to graphics writes it around a traced outline
	 * that nobody typed, and so does an outline copied off a plan item. The row must still be true.
	 */
	it('names a footprint fitted to its graphics as authored in millimetres, not as typed dimensions', () => {
		const traced = shapeWith({
			footprintOrigin: 'traced',
			details: [{ id: 'detail-1', name: 'top', line: 'solid', pending: false, outline: { points: [{ x: -300, y: -200 }, { x: 300, y: -200 }, { x: 300, y: 200 }, { x: -300, y: 200 }] } }],
		});
		const fitted = expectOk(fitFootprintToDetails(traced));
		expect(fitted.footprintOrigin).toBe('typed');
		expect(rows(assetDesign({ shape: fitted }))[0]).toEqual([t('en', 'designer.source'), t('en', 'designer.source.typed')]);
		expect(t('en', 'designer.source.typed')).toBe('Authored in millimetres');
	});

	it('names a traced footprint still awaiting a scale as not yet measured', () => {
		const design = assetDesign({ shape: shapeWith({ footprintOrigin: 'traced', footprintPending: true }), dimensionsUnscaled: true });
		expect(rows(design)).toEqual([
			[t('en', 'designer.source'), t('en', 'designer.source.traced')],
			[t('en', 'designer.source.dimensions-set'), t('en', 'designer.source.dimensions-set.no')],
		]);
	});

	/** A calibration converts a trace without changing where it came from: both facts, independently. */
	it('names a traced footprint a calibration has converted as measured', () => {
		const design = assetDesign({ shape: shapeWith({ footprintOrigin: 'traced', footprintPending: false }) });
		expect(rows(design)).toEqual([
			[t('en', 'designer.source'), t('en', 'designer.source.traced')],
			[t('en', 'designer.source.dimensions-set'), t('en', 'designer.source.dimensions-set.yes')],
		]);
	});

	it('is headed Source & scale and offers no control', () => {
		const wrapper = mount(DesignerSourceScale, { props: { design: assetDesign() } });
		expect(wrapper.find('h3').text()).toBe(t('en', 'designer.source.title'));
		expect(wrapper.findAll('button, input, select, textarea')).toHaveLength(0);
	});

	it('draws nothing for an asset with no footprint to describe', () => {
		const wrapper = mount(DesignerSourceScale, { props: { design: assetDesign({ shape: null, dimensions: null }) } });
		expect(wrapper.find('.rp-designer-source').exists()).toBe(false);
	});

	it('sits after the clearance review, last in the Object tab', () => {
		const editShape: EditShape = vi.fn<EditShape>().mockResolvedValue(ok('no-write'));
		const shape = shapeWith({
			clearance: { points: [{ x: -700, y: -500 }, { x: 700, y: -500 }, { x: 700, y: 500 }, { x: -700, y: 500 }] },
			clearanceNeedsReview: true,
		});
		const wrapper = mount(DesignerInspector, {
			props: {
				design: assetDesign({ shape }),
				setHeight: vi.fn<(height: number | null) => Promise<DispatchResult>>().mockResolvedValue(ok('wrote')),
				editDimensions: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
				activateAnchorTool: vi.fn<() => void>(),
				removeBackground: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
				logger: recorder,
				selection: null,
				lockedGraphics: new Set<string>(),
				editShape,
				select: vi.fn<(next: DesignerSelection | null) => void>(),
				selected: [],
			},
		});
		const panel = wrapper.find('[role="tabpanel"]').element;
		const source = panel.querySelector('.rp-designer-source');
		const review = [...panel.querySelectorAll('.rp-designer-clearance')].at(-1);
		expect(review?.querySelector('[role="status"]')).not.toBeNull();
		expect(source?.previousElementSibling).toBe(review);
		expect(panel.lastElementChild).toBe(source);
	});
});
