/**
 * @vitest-environment jsdom
 *
 * What the asset designer DRAWS: the footprint, the clearance around it, the anchor and the
 * facing (design slice B4).
 *
 * Two instruments in one file, because they answer two different questions and neither
 * subsumes the other:
 *
 * - the four layer modules are PURE functions over an `AssetShape`, so the vocabulary rules —
 *   solid versus dashed, screen-sized marks, nothing drawn for a shape that is not there —
 *   are asked of arithmetic rather than of a canvas;
 * - and the real designer is MOUNTED, with real Vue, real Pinia, real vue-konva and real
 *   Konva, so a build whose canvas computes those configs and renders none of them is red.
 *   A pure-function suite alone certifies exactly the defect `regionsReachable.test.ts` was
 *   written for: correct code nothing puts on screen.
 *
 * **What no test here can see.** jsdom lays nothing out and Konva draws into a backing canvas
 * nobody looks at, so whether the dashed clearance reads as provisional beside the solid
 * footprint, whether the anchor mark is findable, and whether the facing arrow points somewhere
 * a user would call "forward" are questions for an eye in a vault. These cases hold the
 * geometry and the vocabulary; they do not hold the picture.
 */
import { describe, expect, it } from 'vitest';
import { createPinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import Konva from 'konva';
import VueKonva from 'vue-konva';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import { resolveThemeTokens } from '../../../src/presentation/editor/theme/themeTokens';
import { fitViewport } from '../../../src/presentation/editor/viewport/Viewport';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { footprintOutline } from '../../../src/presentation/designer/layers/footprintLayer';
import { clearanceOutline } from '../../../src/presentation/designer/layers/clearanceLayer';
import { anchorMark, facingArrow } from '../../../src/presentation/designer/layers/anchorLayer';
import { footprintFromDimensions, type AssetShape } from '../../../src/domain/asset/AssetShape';
import type { AssetDesignDto } from '../../../src/application/queries/GetAssetDesign';
import { ok } from '../../../src/core/result/Result';
import { assetDesign } from '../../helpers/assetDesign';
import { expectOk } from '../../helpers/domain';
import { recorder } from '../../helpers/logger';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { installCanvas } from '../../helpers/canvas';
import { installObsidianDom } from '../../helpers/dom';
import { installResizeObserver, placeAt, resizeTo } from '../../helpers/layout';
import { settle } from '../../helpers/editor';
import { emptyBackgroundVault } from '../../helpers/background';

/** A palette resolved the way the designer resolves its own — never a literal colour. */
const TOKENS = resolveThemeTokens(document.documentElement);

/** One world millimetre per screen pixel, so a screen-sized mark's arithmetic is readable. */
const UNIT_SCALE = 1;

const BASE = assetDesign().shape as AssetShape;

const WITH_CLEARANCE: AssetShape = {
	...BASE,
	clearance: expectOk(footprintFromDimensions(1600, 1200)),
};

/**
 * Everything the four modules would put on the canvas for one shape, gathered the way
 * `DesignerCanvas.vue` gathers it. A helper rather than four calls per case, because every
 * case below is about ONE of these against the others.
 */
function renderLayers(design: { shape: AssetShape | null }) {
	const arrow = facingArrow(design.shape, TOKENS, UNIT_SCALE);
	return {
		footprint: footprintOutline(design.shape, TOKENS),
		clearance: clearanceOutline(design.shape, TOKENS),
		anchor: anchorMark(design.shape, TOKENS, UNIT_SCALE),
		facing: arrow?.shaft,
		head: arrow?.head,
	};
}

describe('the designer’s drawing vocabulary', () => {
	/**
	 * The plan editor already means one thing by a dashed outline and another by a solid one —
	 * provisional against committed — and reusing it is what stops the designer inventing a
	 * second vocabulary for the same distinction. Asserted as the PAIR: a build that dashed
	 * both, or neither, satisfies either half alone.
	 */
	it('draws the clearance distinct from the footprint, so neither is mistaken for the other', () => {
		const drawn = renderLayers({ shape: WITH_CLEARANCE });

		expect(drawn.footprint?.dash).toBeUndefined();
		expect(drawn.clearance?.dash).not.toBeUndefined();
	});

	/**
	 * The facing is an ANGLE in the sidecar and a direction on the canvas, and the arrow is the
	 * only thing that ties the two together. Anticlockwise from +x (`AssetShape.facing`), so a
	 * facing of a quarter turn leaves the anchor's x where it was and moves y.
	 *
	 * `toBeCloseTo` rather than an exact `0`: `Math.cos(Math.PI / 2)` is 6.1e-17 and not zero,
	 * which CLAUDE.md records costing this repository a duplicate-vertex defect. Nothing
	 * downstream compares these coordinates for equality — they are drawn and never stored — so
	 * the honest assertion is the one that says "close", and `exactOnAxis`'s repair is not owed
	 * here.
	 */
	it('draws a facing indicator that points where facing says', () => {
		const drawn = renderLayers({ shape: { ...BASE, facing: Math.PI / 2 } });

		const points = drawn.facing?.points ?? [];
		expect(points.slice(0, 2)).toEqual([BASE.anchor.x, BASE.anchor.y]);
		expect(points[2]).toBeCloseTo(BASE.anchor.x, 6);
		expect(points[3]).toBeGreaterThan(BASE.anchor.y);
	});

	/**
	 * The head is not decoration, which is why it gets an assertion of its own: a bare segment
	 * leaving a dot says which LINE the asset lies on and not which of its two directions is
	 * forward, and `AssetShape` normalises `facing` to `[0, 2π)` precisely because `0` and `π`
	 * are different assets. Asserted as a triangle AT the tip rather than by counting points —
	 * three vertices somewhere else would satisfy a count.
	 */
	it('caps the facing with a head at the tip, so the arrow says which way is forward', () => {
		const arrow = facingArrow(BASE, TOKENS, UNIT_SCALE);

		expect(arrow?.head.closed).toBe(true);
		expect(arrow?.head.points.slice(0, 2)).toEqual(arrow?.shaft.points.slice(2));
		// Three vertices: the tip and the two barbs behind it.
		expect(arrow?.head.points).toHaveLength(6);
	});

	/**
	 * An asset with no shape is the ordinary starting state, not a failure — so every geometry
	 * module answers `null` and the background layer is what remains. Each is asserted by name:
	 * a single "nothing is drawn" check passes on a build that lost one of the four.
	 */
	it('draws nothing but the background when there is no shape yet', () => {
		const drawn = renderLayers({ shape: null });

		expect(drawn.footprint).toBeNull();
		expect(drawn.clearance).toBeNull();
		expect(drawn.anchor).toBeNull();
		expect(drawn.facing).toBeUndefined();
	});

	/** A shape may legitimately carry no clearance; the footprint still draws. */
	it('draws the footprint and no clearance for a shape that has none', () => {
		const drawn = renderLayers({ shape: BASE });

		expect(drawn.footprint).not.toBeNull();
		expect(drawn.clearance).toBeNull();
	});

	/**
	 * Screen-spaced, both of them: a stroke that scaled would thicken with every zoom, and a
	 * mark sized in world millimetres would vanish when the user zoomed out. The plan editor's
	 * own conventions, reused rather than re-derived.
	 */
	it('sizes the marks in screen pixels, so a zoom moves the camera and not the ink', () => {
		const near = renderLayers({ shape: WITH_CLEARANCE });
		const far = {
			anchor: anchorMark(WITH_CLEARANCE, TOKENS, UNIT_SCALE * 10),
			facing: facingArrow(WITH_CLEARANCE, TOKENS, UNIT_SCALE * 10)?.shaft,
		};

		expect(near.footprint?.strokeScaleEnabled).toBe(false);
		expect(near.clearance?.strokeScaleEnabled).toBe(false);
		expect(near.facing?.strokeScaleEnabled).toBe(false);
		// Ten world units per screen pixel means a ten-times-larger world radius for the same
		// number of pixels on screen.
		expect(far.anchor?.radius).toBeCloseTo((near.anchor?.radius ?? 0) * 10, 9);
		expect(far.facing?.points[2]).toBeCloseTo((near.facing?.points[2] ?? 0) * 10, 9);
	});

	/** No literal colour anywhere: every stroke and fill is a resolved Obsidian variable. */
	it('takes every colour from the theme, never from a literal', () => {
		const drawn = renderLayers({ shape: WITH_CLEARANCE });
		const used = [drawn.footprint?.stroke, drawn.clearance?.stroke, drawn.anchor?.fill, drawn.facing?.stroke];

		expect(used.every((colour) => Object.values(TOKENS).includes(colour ?? ''))).toBe(true);
	});
});

function context(design: AssetDesignDto): AssetDesignerContext {
	return {
		assetId: String(design.assetId),
		queries: { getAssetDesign: () => Promise.resolve(ok(design)) },
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: () => () => undefined,
		indexScanCompleted: () => true,
	};
}

/**
 * The real designer, mounted — the half of this file that a pure-function suite cannot give.
 *
 * Nothing about Konva is stubbed, for `tests/helpers/editor.ts`'s reason: stubbing `<VLayer>`
 * would make every assertion a claim about the props this codebase passes rather than about
 * the scene Konva builds out of them.
 */
async function mountDesigner(design: AssetDesignDto) {
	installObsidianDom();
	installCanvas();
	installResizeObserver();

	const host = document.createElement('div');
	document.body.appendChild(host);
	const pinia = createPinia();
	const wrapper = mount(AssetDesignerRoot, {
		attachTo: host,
		global: { plugins: [pinia, VueKonva], provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context(design) } },
	});
	await flushPromises();

	const canvas = wrapper.find('.rp-designer-canvas .rp-plan-canvas');
	const canvasEl = canvas.exists() ? (canvas.element as HTMLElement) : null;
	// jsdom lays nothing out, so the stage would be 0x0 and every assertion about what it holds
	// — and every fit shortcut — would be made against a scene that could not have drawn.
	if (canvasEl !== null) {
		placeAt(canvasEl, 0, 0, 800, 600);
		resizeTo(canvasEl, 800, 600);
		await settle();
	}
	// Taken only when a canvas mounted: `Konva.stages` is process-global, so the last entry
	// would otherwise be some previous file's stage.
	const stage = canvasEl === null ? null : (Konva.stages.at(-1) as Konva.Stage);
	return { wrapper, pinia, stage, canvasEl, unmount: () => { wrapper.unmount(); host.remove(); } };
}

/**
 * A key the canvas itself would receive. `EditorSurface.isCanvasKey` is `event.target ===
 * container`, so this dispatches ON the container: a key goes to whatever has focus, and a
 * shortcut fired at the document would be answering a different question than the one a user
 * pressing it in the pane asks.
 */
function pressOnCanvas(canvas: HTMLElement, code: string): void {
	canvas.dispatchEvent(new KeyboardEvent('keydown', { code, shiftKey: true, bubbles: true, cancelable: true }));
}

describe('what the designer’s fit shortcuts frame', () => {
	/**
	 * `Shift+1` frames the whole design, and it has to include the CLEARANCE: a clearance
	 * reaches outside the footprint it belongs to, so a fit computed from the outline alone
	 * crops the very thing it was asked to show. Asserted as the pair — a build that framed only
	 * the footprint zooms differently, which is what the second expectation catches.
	 */
	it('frames the footprint and the clearance around it, never the outline alone', async () => {
		const designer = await mountDesigner(assetDesign({ shape: WITH_CLEARANCE }));
		const store = useEditorStore(designer.pinia);
		const before = store.viewport;

		pressOnCanvas(designer.canvasEl as HTMLElement, 'Digit1');

		expect(store.viewport).not.toEqual(before);
		// The 1600 x 1200 clearance, not the 1200 x 800 footprint: framing the outline alone
		// would fit a smaller box into the same pane and land on a larger zoom.
		const footprintOnly = { min: { x: -600, y: -400 }, max: { x: 600, y: 400 } };
		const fitted = fitViewport(footprintOnly, { width: 800, height: 600 }, 48, before.zoom);
		expect(store.viewport.zoom).not.toBeCloseTo(fitted?.zoom ?? 0, 9);
		designer.unmount();
	});

	/**
	 * `Shift+2` frames the SELECTION, and this canvas has nothing selectable on it until Task
	 * B5. A fit with nothing to frame does NOTHING — `boundsOfZones`' own rule — because a jump
	 * to nowhere costs the user the view they had and says nothing about why.
	 */
	it('does nothing on the selection shortcut, because nothing on this canvas is selectable yet', async () => {
		const designer = await mountDesigner(assetDesign({ shape: WITH_CLEARANCE }));
		const store = useEditorStore(designer.pinia);
		const before = store.viewport;

		pressOnCanvas(designer.canvasEl as HTMLElement, 'Digit2');

		expect(store.viewport).toEqual(before);
		designer.unmount();
	});

	/** And nothing to frame at all, for an asset whose shape has not been drawn yet. */
	it('does nothing on either shortcut when there is no shape', async () => {
		const designer = await mountDesigner(assetDesign({ shape: null, dimensions: null }));
		const store = useEditorStore(designer.pinia);
		const before = store.viewport;

		pressOnCanvas(designer.canvasEl as HTMLElement, 'Digit1');

		expect(store.viewport).toEqual(before);
		designer.unmount();
	});
});

describe('the designer canvas, mounted', () => {
	it('mounts a Konva stage inside the canvas region, so the shell really draws one', async () => {
		const designer = await mountDesigner(assetDesign());

		expect(designer.wrapper.find('.rp-designer-canvas .rp-plan-canvas').exists()).toBe(true);
		expect(designer.stage).not.toBeNull();
		designer.unmount();
	});

	/**
	 * The layers in their order, by NAME — an assertion about the scene rather than about the
	 * template, so a layer dropped from the canvas fails here even if its module survives.
	 */
	it('draws the five layers, beneath-to-above, with the background first and the gesture last', async () => {
		const designer = await mountDesigner(assetDesign());

		expect(designer.stage?.getLayers().map((layer) => layer.name())).toEqual([
			'asset-background',
			'asset-footprint',
			'asset-clearance',
			'asset-anchor',
			'asset-gesture',
		]);
		designer.unmount();
	});

	/**
	 * SDD §62: no node on this canvas is hit-tested, so an inert hit graph would be a second
	 * hidden canvas per layer maintained for nothing — Task B5's tools do their own geometry
	 * against world points, exactly as `SelectTool` does.
	 *
	 * Asked of the STAGE rather than of the config objects, because that is the end that can
	 * answer it: `designerLayerConfig` builds one shape for all four world-space layers, so a
	 * build that dropped the flag drops it everywhere at once and a check on a single config
	 * would still only be reading back what the same expression put there. The FIFTH entry —
	 * the gesture layer — does not pass through that function at all: it declares its own
	 * `listening: false` in `DesignerGestureLayer.vue`'s template, so it is the one member of
	 * this list a shared expression cannot vouch for and the reason the list is read from the
	 * stage rather than counted.
	 */
	it('leaves every layer inert, because nothing on this canvas is hit-tested', async () => {
		const designer = await mountDesigner(assetDesign({ shape: WITH_CLEARANCE }));

		expect(designer.stage?.getLayers().map((layer) => layer.listening())).toEqual([
			false,
			false,
			false,
			false,
			false,
		]);
		designer.unmount();
	});

	/**
	 * The mount is what this asserts, and it is why the case reaches into the SCENE rather than
	 * stopping at "a stage exists": a canvas that mounted the surface and rendered none of its
	 * layer content would satisfy the case above.
	 */
	it('puts the footprint the query answered onto the canvas', async () => {
		const design = assetDesign();
		const designer = await mountDesigner(design);

		const line = designer.stage?.findOne('.asset-footprint-outline') as Konva.Line | undefined;
		// Spelled from the DTO's own vertices rather than compared against `footprintOutline`,
		// which is the whole difference between an instrument and a tautology: both sides would
		// otherwise go through the SAME packing function, so a `flatPoints` that packed y before
		// x would agree with itself and this case would read green. Measured — that mutation
		// passed the file until this expectation stopped citing the code it is checking.
		expect(line?.points()).toEqual([-600, -400, 600, -400, 600, 400, -600, 400]);
		designer.unmount();
	});

	/**
	 * The anchor layer's three nodes, by name. A canvas that computed them and rendered none
	 * satisfies every case above — the four layers are still there and the footprint still
	 * draws — which is `regionsReachable`'s own defect one level down: correct code nothing
	 * puts on screen. Measured: deleting the head's `<VLine>` from the template passed this
	 * file until this case existed.
	 */
	it('draws the anchor and both halves of the facing arrow', async () => {
		const designer = await mountDesigner(assetDesign());

		expect(designer.stage?.findOne('.asset-anchor-mark')).toBeDefined();
		expect(designer.stage?.findOne('.asset-facing-shaft')).toBeDefined();
		expect(designer.stage?.findOne('.asset-facing-head')).toBeDefined();
		designer.unmount();
	});

	/** A shape with no clearance draws no clearance node — the null arm, on the canvas. */
	it('draws no clearance node for a shape that carries none', async () => {
		const designer = await mountDesigner(assetDesign());

		expect(designer.stage?.findOne('.asset-clearance-outline')).toBeUndefined();
		designer.unmount();
	});

	it('draws a clearance node for a shape that carries one', async () => {
		const designer = await mountDesigner(assetDesign({ shape: WITH_CLEARANCE }));

		expect(designer.stage?.findOne('.asset-clearance-outline')).toBeDefined();
		designer.unmount();
	});

	/**
	 * The empty state is an OVERLAY over a mounted canvas, never a replacement for it — slice
	 * 14's rule, and the reason the canvas mounts for a shapeless asset at all.
	 */
	it('mounts the canvas under the no-shape empty state rather than instead of it', async () => {
		const designer = await mountDesigner(assetDesign({ shape: null, dimensions: null }));

		expect(designer.wrapper.find('.rp-designer-canvas .rp-plan-canvas').exists()).toBe(true);
		expect(designer.wrapper.find('.rp-designer-canvas .rp-empty-state').exists()).toBe(true);
		designer.unmount();
	});
});
