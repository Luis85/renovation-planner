/**
 * @vitest-environment jsdom
 *
 * The designer's canvas scale bar (AD18-R17 Task 6, board 02's `0 250 500 mm`) — what it reads at a
 * camera, where it refuses to draw, and where the mounted designer puts it.
 *
 * jsdom lays nothing out, so no case here measures the bar on screen or its distance from the
 * legend, the rulers or the canvas edge; those are the report's predictions and the integrator's
 * browser measurement. What IS reachable is the camera arithmetic, which lands in the text and in the
 * bar's own `style` attribute, and what `styles/designer-legend.css` DECLARES, read through
 * lightningcss.
 *
 * Zoom is stage pixels per millimetre (`worldPerScreenPixel` is its inverse), so at 0.1 a pixel is
 * 10 mm and `designerGrid` answers 500 mm (the smallest step at least 12 px wide).
 */
import { readFileSync } from 'node:fs';
import { createPinia } from 'pinia';
import { mount, type VueWrapper } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DesignerScaleBar from '../../../../src/presentation/designer/legend/DesignerScaleBar.vue';
import { useAssetDesignStore } from '../../../../src/presentation/designer/stores/assetDesignStore';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import type { AssetDesignDto } from '../../../../src/application/queries/GetAssetDesign';
import { assetDesign } from '../../../helpers/assetDesign';
import { editableShape } from '../../../helpers/assetShapes';
import { designerRig } from '../../../helpers/designerRig';
import { settle } from '../../../helpers/editor';
import { propertyOf, show, stylesheetRules } from '../../../helpers/selectors';

/** The component alone over a seeded store at `zoom` — the states a mounted designer cannot be put in. */
async function scaleBar(design: AssetDesignDto | null, zoom = 0.1): Promise<VueWrapper> {
	const pinia = createPinia();
	const wrapper = mount(DesignerScaleBar, { global: { plugins: [pinia] } });
	useAssetDesignStore(pinia).design = design;
	useEditorStore(pinia).viewport = { pan: { x: 0, y: 0 }, zoom };
	await settle();
	return wrapper;
}

/** What the bar reads, mark by mark, and how wide it is drawn. */
function reading(wrapper: VueWrapper): { marks: string[]; width: string } {
	const ruler = wrapper.get('.rp-designer-scale-bar__ruler').element as HTMLElement;
	const marks = wrapper.findAll('.rp-designer-scale-bar__mark, .rp-designer-scale-bar__end').map((mark) => mark.text());
	return { marks, width: ruler.style.width };
}

describe('what the scale bar reads at a camera', () => {
	it('reads board 02’s own 0 250 500 mm where a 50 mm step is 12.5 px', async () => {
		// 4 mm a pixel: 10 mm is 2.5 px, under the 12 px floor, so the step is 50 mm — and ten of them
		// are 125 px, inside the bar's width budget.
		const wrapper = await scaleBar(assetDesign(), 0.25);
		expect(reading(wrapper)).toEqual({ marks: ['0', '250', '500 mm'], width: '125px' });
		wrapper.unmount();
	});

	it('spans two steps where ten or four would be too wide', async () => {
		// 500 mm is 50 px at 0.1, so four steps are 200 px; two are 100.
		const wrapper = await scaleBar(assetDesign(), 0.1);
		expect(reading(wrapper)).toEqual({ marks: ['0', '500', '1000 mm'], width: '100px' });
		wrapper.unmount();
	});

	it('spans four steps where ten would be too wide and four fit', async () => {
		// 20 mm a pixel: 500 mm is 25 px, so ten are 250 px and four are 100.
		const wrapper = await scaleBar(assetDesign(), 0.05);
		expect(reading(wrapper)).toEqual({ marks: ['0', '1000', '2000 mm'], width: '100px' });
		wrapper.unmount();
	});

	it('is hidden from a screen reader and names nothing a user can press', async () => {
		const wrapper = await scaleBar(assetDesign());
		expect(wrapper.get('.rp-designer-scale-bar').attributes('aria-hidden')).toBe('true');
		expect(wrapper.findAll('button, input, a')).toHaveLength(0);
		wrapper.unmount();
	});
});

describe('where the scale bar refuses to draw', () => {
	it('draws nothing before the design has been read', async () => {
		const wrapper = await scaleBar(null);
		expect(wrapper.find('.rp-designer-scale-bar').exists()).toBe(false);
		wrapper.unmount();
	});

	it('draws nothing for a shapeless asset — the empty state', async () => {
		const wrapper = await scaleBar(assetDesign({ shape: null }));
		expect(wrapper.find('.rp-designer-scale-bar').exists()).toBe(false);
		wrapper.unmount();
	});

	it('draws nothing over an unscaled design, whose coordinates are no millimetres', async () => {
		const wrapper = await scaleBar(assetDesign({ dimensionsUnscaled: true }));
		expect(wrapper.find('.rp-designer-scale-bar').exists()).toBe(false);
		wrapper.unmount();
	});
});

describe('where the mounted designer puts the scale bar', () => {
	it('draws it in the canvas overlay, below the legend in one bottom-left key, and keeps it when the legend is switched off', async () => {
		const rig = await designerRig({ shape: editableShape(), camera: 'default' });
		try {
			const key = rig.wrapper.get('.rp-designer-key').element;
			expect(rig.canvasEl.querySelector('.rp-plan-overlay')?.contains(key)).toBe(true);
			expect([...key.children].map((child) => child.classList[0])).toEqual(['rp-designer-legend', 'rp-designer-scale-bar']);

			await rig.wrapper.get('.rp-designer-tools [data-rp-view="legend"]').setValue(false);
			expect(rig.wrapper.find('.rp-designer-legend').exists()).toBe(false);
			expect(rig.wrapper.find('.rp-designer-key .rp-designer-scale-bar').exists()).toBe(true);
		} finally {
			rig.unmount();
		}
	});

	it('draws no scale bar over the empty-state overlay a shapeless asset draws', async () => {
		const rig = await designerRig({ shape: null });
		try {
			expect(rig.wrapper.find('.rp-empty-state').exists()).toBe(true);
			expect(rig.wrapper.find('.rp-designer-scale-bar').exists()).toBe(false);
		} finally {
			rig.unmount();
		}
	});
});

/** How the parser reads `property: value`, so no case spells lightningcss's AST by hand. */
const parsed = (property: string, value: string): unknown[] =>
	stylesheetRules(`.reference { ${property}: ${value}; }`)[0]?.declarations.map((entry) => entry.value) ?? [];

describe('what styles/designer-legend.css declares for the key', () => {
	const rules = stylesheetRules(readFileSync('styles/designer-legend.css', 'utf8'));
	const valuesOf = (selector: string, property: string): unknown[] =>
		rules
			.filter((rule) => rule.condition === '' && rule.selectors.map(show).includes(selector))
			.flatMap((rule) => rule.declarations.filter((entry) => propertyOf(entry) === property).map((entry) => entry.value));

	it('takes no press anywhere in the key, so a press over it still reaches the canvas', () => {
		expect(valuesOf('.rp-designer-key', 'pointer-events')).toEqual(parsed('pointer-events', 'none'));
	});

	it('hides only the legend below the narrow breakpoint, so the scale bar outlives it', () => {
		const narrow = stylesheetRules('@container rp-designer (width < 35rem) { .reference { color: inherit; } }')[0]?.condition ?? '';
		expect(narrow).not.toBe('');
		const hidden = rules
			.filter((rule) => rule.condition === narrow && rule.declarations.some((entry) => propertyOf(entry) === 'display'))
			.flatMap((rule) => rule.selectors.map(show));
		expect(hidden).toEqual(['.renovation-asset-designer .rp-designer-legend']);
	});
});
