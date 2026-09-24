/**
 * @vitest-environment jsdom
 *
 * The designer's canvas rulers (asset designer snapping spec 2026-09-15, §0 increment 3; AD18-R9) —
 * what they draw, where they refuse to draw, and where the mounted designer puts them.
 *
 * **What this file can and cannot reach, said before any case claims otherwise.** jsdom computes no
 * layout, so nothing here measures a rendered pixel, a band's width on screen or the canvas's share
 * of the shell — AD18-R10's binding is a browser measurement and is recorded in
 * `docs/tasks/asset-designer-expansion/reports/W17-B-canvas-rulers.md`. What it CAN reach is what a
 * rule DECLARES (read through lightningcss, since jsdom resolves no stylesheet either) and what the
 * template writes into an element's own `style` attribute, which is where the camera arithmetic
 * lands. The arithmetic itself is `rulerMarks.test.ts`'s.
 *
 * The camera every case reasons at is `DEFAULT_VIEWPORT` — zoom 0.1, pan (-480, -480) — so a screen
 * pixel is 10 mm and `screen = (world + 480) / 10`. `designerGrid` answers 500 mm at that camera
 * (the smallest step at least 12 px wide), and `assetDesign()`'s footprint is 1200 x 800 centred on
 * the origin, so the grid's origin — the ruler's zero — is (-600, -400).
 */
import { readFileSync } from 'node:fs';
import { createPinia, type Pinia } from 'pinia';
import { mount, type VueWrapper } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import DesignerRulers from '../../../../src/presentation/designer/rulers/DesignerRulers.vue';
import { DEFAULT_VIEWPORT } from '../../../../src/presentation/editor/viewport/Viewport';
import { useAssetDesignStore } from '../../../../src/presentation/designer/stores/assetDesignStore';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { t } from '../../../../src/presentation/i18n/strings';
import type { AssetDesignDto } from '../../../../src/application/queries/GetAssetDesign';
import type { DesignerSelection } from '../../../../src/presentation/designer/selection/designerSelection';
import { footprintFromDimensions, type AssetShape } from '../../../../src/domain/asset/AssetShape';
import { assetDesign } from '../../../helpers/assetDesign';
import { expectOk } from '../../../helpers/domain';
import { toiletShape } from '../../../helpers/assetShapes';
import { designerRig } from '../../../helpers/designerRig';
import { settle } from '../../../helpers/editor';
import { propertyOf, show, stylesheetRules, type StyleRule } from '../../../helpers/selectors';

const STAGE = { width: 800, height: 600 };

/**
 * The component alone over a seeded store — the three states the mounted designer cannot be put
 * into, since `AssetDesignerRoot` mounts the canvas only over a design it has already read. The
 * selection is the component's PROP — the selection as drawn, which `DesignerCanvas` passes — so a
 * case sets it there; `designerHiddenSelectionFrame.test.ts` drives what the canvas passes.
 */
function rulers(design: AssetDesignDto | null, selection: DesignerSelection | null = null): { wrapper: VueWrapper; pinia: Pinia } {
	const pinia = createPinia();
	const wrapper = mount(DesignerRulers, { props: { selection }, global: { plugins: [pinia] } });
	useAssetDesignStore(pinia).design = design;
	const editor = useEditorStore(pinia);
	editor.viewport = DEFAULT_VIEWPORT;
	editor.setStageSize(STAGE);
	return { wrapper, pinia };
}

/** The fixture's shape, refused loudly rather than asserted past: `assetDesign()` always has one. */
function shapeOf(view: AssetDesignDto): AssetShape {
	if (view.shape === null) throw new Error('this case needs a design with a shape');
	return view.shape;
}

/** A strip's own element, by its modifier. Throws rather than answering a silent `undefined`. */
function strip(wrapper: VueWrapper, side: 'top' | 'left'): HTMLElement {
	return wrapper.get(`.rp-designer-ruler--${side}`).element as HTMLElement;
}

/** Every label a strip draws, as `[text, offset]` pairs in DOM order. */
function labels(wrapper: VueWrapper, side: 'top' | 'left'): [string, string][] {
	return wrapper.findAll(`.rp-designer-ruler--${side} .rp-designer-ruler__label`).map((label) => {
		const element = label.element as HTMLElement;
		return [element.textContent ?? '', side === 'top' ? element.style.left : element.style.top];
	});
}

const partial = (file: string): StyleRule[] => stylesheetRules(readFileSync(`styles/${file}`, 'utf8'));

/** How this parser reads one declaration, so no case spells lightningcss's own AST by hand. */
function reference(property: string, value: string): unknown {
	const [rule] = stylesheetRules(`.reference { ${property}: ${value}; }`);
	const declaration = rule?.declarations[0];
	if (declaration === undefined) throw new Error(`no declaration parsed from: ${property}: ${value}`);
	return declaration.value;
}

/** Every value `property` takes in the rules whose selector list is exactly `selector`. */
function declared(rules: readonly StyleRule[], selector: string, property: string): unknown[] {
	const [reference_] = stylesheetRules(`${selector} { color: inherit; }`);
	const wanted = (reference_?.selectors ?? []).map((one) => show(one)).join(', ');
	if (wanted === '') throw new Error(`no selector parsed from: ${selector}`);
	return rules
		.filter((rule) => rule.condition === '' && rule.selectors.map((one) => show(one)).join(', ') === wanted)
		.flatMap((rule) => rule.declarations.filter((entry) => propertyOf(entry) === property).map((entry) => entry.value));
}

describe('what the designer’s rulers draw', () => {
	it('numbers both strips every five steps, at the stage pixel each mark sits on', async () => {
		const { wrapper } = rulers(assetDesign());
		await settle();

		// Visible world on x is -480 .. 7520, which is 120 .. 8120 from the origin's -600; the
		// labelled spacing is 2500 mm, so 2500 / 5000 / 7500 land at 238 / 488 / 738 px.
		expect(labels(wrapper, 'top')).toEqual([['2500', '238px'], ['5000', '488px'], ['7500', '738px']]);
		// On y the span reaches back past the origin, so the corner the grid counts from is on screen
		// and the ruler reads 0 there.
		//
		// **`['0', '8px']` asserts PRESENCE and not visibility**: 8 px is inside the top strip's own
		// 18 px band, and that strip is later in the DOM with an opaque background, so in a browser
		// this particular label is behind it — measured, at 1280, by panning until the mark entered
		// the corner. `styles/designer-rulers.css` carries why that is accepted; jsdom cannot see it.
		expect(labels(wrapper, 'left')).toEqual([['0', '8px'], ['2500', '258px'], ['5000', '508px']]);
		wrapper.unmount();
	});

	it('tiles the minor ticks at the step’s screen size, anchored on the grid’s own origin', async () => {
		const { wrapper } = rulers(assetDesign());
		await settle();

		// 500 mm at 0.1 px per mm is a 50 px tile; the origin (-600, -400) lands at (-12, 8).
		expect(strip(wrapper, 'top').style.backgroundSize).toBe('50px 100%');
		expect(strip(wrapper, 'top').style.backgroundPosition).toBe('-12px 0px');
		expect(strip(wrapper, 'left').style.backgroundSize).toBe('100% 50px');
		expect(strip(wrapper, 'left').style.backgroundPosition).toBe('0px 8px');
		wrapper.unmount();
	});

	it('marks the selected part’s extent on both strips, and marks nothing while nothing is selected', async () => {
		const { wrapper } = rulers(assetDesign());
		await settle();
		expect(wrapper.findAll('.rp-designer-ruler__extent')).toHaveLength(0);

		await wrapper.setProps({ selection: { kind: 'footprint' } });
		await settle();

		// The 1200 x 800 footprint spans 120 px across and 80 px down, from its own corner.
		const top = wrapper.get('.rp-designer-ruler--top .rp-designer-ruler__extent').element as HTMLElement;
		expect([top.style.left, top.style.width]).toEqual(['-12px', '120px']);
		const left = wrapper.get('.rp-designer-ruler--left .rp-designer-ruler__extent').element as HTMLElement;
		expect([left.style.top, left.style.height]).toEqual(['8px', '80px']);
		wrapper.unmount();
	});

	/**
	 * **Every other reading of "where the selection is" on this surface follows the gesture's
	 * preview** — `DesignerCanvas`'s `shape` is `preview ?? design.shape`, and both `selectionMarks`
	 * and `framedBounds` are computed from it — so a band left on the committed millimetres would be
	 * the two-answers defect rather than the avoidance of it. The spec's increment 2 says its
	 * dimensions are "updated live from the drag preview"; this is the same direction.
	 *
	 * **The FRAME stays committed and that is the other half of the case.** §2.4 argues the
	 * committed origin so that dragging the footprint does not slide the grid under the drag, so the
	 * tiling is asserted NOT to move in the same breath: the ruler stands still and the mark on it
	 * travels, which is what a ruler does.
	 */
	it('moves the extent band with a gesture’s preview while the ruler itself stands still', async () => {
		const committed = assetDesign();
		const { wrapper, pinia } = rulers(committed, { kind: 'footprint' });
		const store = useAssetDesignStore(pinia);
		await settle();
		const band = () => {
			const element = wrapper.get('.rp-designer-ruler--top .rp-designer-ruler__extent').element as HTMLElement;
			return [element.style.left, element.style.width];
		};
		expect(band()).toEqual(['-12px', '120px']);

		store.setPreview({ ...shapeOf(committed), footprint: expectOk(footprintFromDimensions(2400, 1600)) });
		await settle();

		// The preview's footprint spans -1200..1200, which is -72 px wide of 240 px.
		expect(band()).toEqual(['-72px', '240px']);
		const left = wrapper.get('.rp-designer-ruler--left .rp-designer-ruler__extent').element as HTMLElement;
		expect([left.style.top, left.style.height]).toEqual(['-32px', '160px']);
		// The grid's origin is still the COMMITTED footprint's corner, so the ticks have not moved.
		expect(strip(wrapper, 'top').style.backgroundPosition).toBe('-12px 0px');
		wrapper.unmount();
	});

	it('draws from the world origin for a design nobody has traced yet', async () => {
		const { wrapper } = rulers(assetDesign({ shape: null, dimensions: null }));
		await settle();

		// No footprint, so `designerGrid` counts from (0, 0), which is 48 px in on both axes.
		expect(strip(wrapper, 'top').style.backgroundPosition).toBe('48px 0px');
		expect(labels(wrapper, 'left')).toEqual([['0', '48px'], ['2500', '298px'], ['5000', '548px']]);
		// There is no shape, so there is nothing to have selected and no extent to mark.
		expect(wrapper.findAll('.rp-designer-ruler__extent')).toHaveLength(0);
		wrapper.unmount();
	});

	it('draws no ruler at all over an unscaled design, and none before a design is read', async () => {
		const unscaled = rulers(assetDesign({ dimensionsUnscaled: true }));
		await settle();
		expect(unscaled.wrapper.find('.rp-designer-rulers').exists()).toBe(false);
		unscaled.wrapper.unmount();

		const unread = rulers(null);
		await settle();
		expect(unread.wrapper.find('.rp-designer-rulers').exists()).toBe(false);
		unread.wrapper.unmount();
	});

	/**
	 * The ticks are numbers a screen reader would otherwise read as a list of loose integers, so the
	 * pair is one `role="img"` naming the scale instead. The step in that name is `designerGrid`'s,
	 * which is what makes it agree with the status row rather than with a second reading of the
	 * camera.
	 */
	it('announces the pair as one image naming the step', async () => {
		const { wrapper } = rulers(assetDesign());
		await settle();

		const root = wrapper.get('.rp-designer-rulers').element;
		expect(root.getAttribute('role')).toBe('img');
		expect(root.getAttribute('aria-label')).toBe(t('en', 'designer.rulers', { step: '500' }));
		wrapper.unmount();
	});
});

describe('where the mounted designer puts its rulers', () => {
	/**
	 * The wiring nothing else mounts: the rulers have to be INSIDE `EditorSurface`'s overlay slot, not
	 * merely somewhere in the tree, because that is what resolves their `position: absolute` against
	 * the canvas region and what puts them behind the slot's own pointer stops.
	 */
	it('mounts them in the canvas overlay, above the stage and before the empty state’s slot', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			const overlay = rig.canvasEl.querySelector('.rp-plan-overlay');
			const drawn = rig.wrapper.get('.rp-designer-rulers').element;
			expect(overlay?.contains(drawn)).toBe(true);
			expect(drawn.getAttribute('aria-label')).toBe(t('en', 'designer.rulers', { step: '500' }));
		} finally {
			rig.unmount();
		}
	});
});

describe('the rulers’ stylesheet', () => {
	/**
	 * `pointer-events: none` on a CONTAINER is what lets its children opt back in with `auto`, and a
	 * ruler has no child that should: it is a reading and not a control, so a press on one must reach
	 * the canvas underneath and start the pan the user meant. Declared on the pair's root and
	 * inherited, exactly as `.rp-dimension-labels` declares it — and as `.rp-designer-dimensions`
	 * does, which takes the other half, because its children ARE buttons.
	 *
	 * **The reason this docblock gave was a non-sequitur, and AD18-R11 refused it.** It said the
	 * overlay slot's wrapper carries `@pointerdown.stop` and its three siblings, *"so a ruler that
	 * accepted a press would eat the gesture rather than sit over it"*. Those modifiers are
	 * BUBBLE-phase: a child's own handler runs first, in the target phase, untouched, so they shield
	 * the canvas FROM the overlay rather than the overlay from the user. That ruling corrected the
	 * same sentence in `DesignerRulers.vue` and in `styles/designer-rulers.css`, and predicted a
	 * sibling would carry a third copy; this was it.
	 */
	it('takes no pointer and no layout from the canvas', () => {
		const rules = partial('designer-rulers.css');

		expect(declared(rules, '.rp-designer-rulers', 'pointer-events')).toEqual([reference('pointer-events', 'none')]);
		expect(declared(rules, '.rp-designer-rulers', 'position')).toEqual([reference('position', 'absolute')]);
		expect(declared(rules, '.rp-designer-ruler', 'position')).toEqual([reference('position', 'absolute')]);
		for (const side of ['.rp-designer-ruler--top', '.rp-designer-ruler--left']) {
			expect(declared(rules, side, 'top')).toEqual([reference('top', '0')]);
		}
	});

	/**
	 * The left strip's numbers are TURNED, and that is a defect fix rather than a style: at 1280 in a
	 * browser, `250` drew as `25(` because three horizontal digits do not fit an 18 px strip, and a
	 * four-digit step is the ordinary case at a zoomed-out camera. jsdom lays nothing out, so this
	 * pins what the rule DECLARES — the rendered proof is the card's own browser measurement, and no
	 * check here can see a clipped glyph.
	 */
	it('turns the left strip’s numbers rather than widening the strip', () => {
		const rules = partial('designer-rulers.css');

		expect(declared(rules, '.rp-designer-ruler--left .rp-designer-ruler__label', 'writing-mode'))
			.toEqual([reference('writing-mode', 'vertical-rl')]);
		expect(declared(rules, '.rp-designer-ruler--top .rp-designer-ruler__label', 'writing-mode')).toEqual([]);
	});
});
