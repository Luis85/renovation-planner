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
import { DEFAULT_VIEWPORT, fitViewport } from '../../../src/presentation/editor/viewport/Viewport';
import { boundingBoxOf } from '../../../src/core/geometry/operations';
import { ringSector } from '../../../src/domain/asset/presets/presetGeometry';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { footprintOutline } from '../../../src/presentation/designer/layers/footprintLayer';
import { clearanceOutline } from '../../../src/presentation/designer/layers/clearanceLayer';
import { detailOutlines, footprintEdge } from '../../../src/presentation/designer/layers/detailsLayer';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
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
import { click, designerRig, move } from '../../helpers/designerRig';
import { t } from '../../../src/presentation/i18n/strings';

/** A palette resolved the way the designer resolves its own — never a literal colour. */
const TOKENS = resolveThemeTokens(document.documentElement);

/** One world millimetre per screen pixel, so a screen-sized mark's arithmetic is readable. */
const UNIT_SCALE = 1;

const BASE = assetDesign().shape as AssetShape;

const WITH_CLEARANCE: AssetShape = {
	...BASE,
	clearance: expectOk(footprintFromDimensions(1600, 1200)),
};

const QUARTER = Math.tan(Math.PI / 8);
const WITH_DETAILS: AssetShape = {
	...BASE,
	details: [
		{ id: 'd1', name: 'top', line: 'solid', pending: false, outline: { points: [{ x: 0, y: -300 }, { x: 300, y: 0 }, { x: 0, y: 300 }, { x: -300, y: 0 }], bulges: [QUARTER, QUARTER, QUARTER, QUARTER] } },
		{ id: 'd2', name: 'overhead', line: 'dashed', pending: false, outline: { points: [{ x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }, { x: -100, y: 100 }] } },
	],
};

/**
 * Everything the four modules would put on the canvas for one shape, gathered the way
 * `DesignerCanvas.vue` gathers it. A helper rather than four calls per case, because every
 * case below is about ONE of these against the others.
 */
function renderLayers(design: { shape: AssetShape | null }) {
	const arrow = facingArrow(design.shape, TOKENS, UNIT_SCALE);
	return {
		footprint: footprintOutline(design.shape, TOKENS, UNIT_SCALE),
		clearance: clearanceOutline(design.shape, TOKENS, UNIT_SCALE),
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
		// 1.5, not 1: a 1 px accent dash measured about 2.98:1 on the light canvas (critique finding 19).
		expect(drawn.clearance?.strokeWidth).toBe(1.5);
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

	it('fills a solid detail with the canvas colour and leaves a dashed one unfilled', () => {
		const [solid, dashed] = detailOutlines(WITH_DETAILS, TOKENS, UNIT_SCALE);
		expect(solid.fill).toBe(TOKENS.canvasBackground);
		expect(solid.dash).toBeUndefined();
		expect(dashed.fill).toBeUndefined();
		expect(dashed.dash).not.toBeUndefined();
	});

	it('draws curved outlines as their arcs rather than their corners', () => {
		const circular = { ...BASE, footprint: WITH_DETAILS.details[0].outline };
		expect(detailOutlines(WITH_DETAILS, TOKENS, UNIT_SCALE)[0].points.length).toBeGreaterThan(8);
		expect(footprintOutline(circular, TOKENS, UNIT_SCALE)?.points.length).toBeGreaterThan(8);
	});

	/**
	 * A solid detail is filled with the canvas colour, so one drawn against the footprint covers the
	 * inner half of the footprint's stroke. The footprint is stroked AGAIN, unfilled, over the details —
	 * and only when there are details, since otherwise nothing can cover it.
	 */
	it('restrokes the footprint over its details, unfilled, and only when there are details', () => {
		expect(footprintEdge(null, TOKENS, UNIT_SCALE)).toBeNull();
		expect(footprintEdge(BASE, TOKENS, UNIT_SCALE)).toBeNull();
		expect(footprintEdge(WITH_DETAILS, TOKENS, UNIT_SCALE)).toEqual(footprintOutline(WITH_DETAILS, TOKENS, UNIT_SCALE));
		expect(footprintEdge(WITH_DETAILS, TOKENS, UNIT_SCALE)).not.toHaveProperty('fill');
	});

	/** The canvas keys each detail node by its id, so a reorder moves nodes rather than repainting them. */
	it('carries each detail’s id on its config', () => {
		expect(detailOutlines(WITH_DETAILS, TOKENS, UNIT_SCALE).map((detail) => detail.id)).toEqual(['d1', 'd2']);
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
		// The design opened framed (`DesignerCanvas`); start from the default camera so the press has a fit to make.
		store.viewport = DEFAULT_VIEWPORT;
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
	 * A curved table's outer arc bows past its corner points. Framing the corners alone would crop
	 * it; the box `boundingBoxOf` draws around the arcs is what `Shift+1` has to fit. The sector
	 * is width-limited either way, so it is the CENTRING that tells the two boxes apart.
	 */
	it('frames an arc that bows past its corner points, not the corners alone', async () => {
		const sector = ringSector(1500, 600, 90);
		const designer = await mountDesigner(assetDesign({ shape: { ...BASE, footprint: sector } }));
		const store = useEditorStore(designer.pinia);
		const before = store.viewport;

		pressOnCanvas(designer.canvasEl as HTMLElement, 'Digit1');

		const pane = { width: 800, height: 600 };
		expect(store.viewport).not.toEqual(fitViewport(expectOk(boundingBoxOf({ points: sector.points })), pane, 48, before.zoom));
		expect(store.viewport).toEqual(fitViewport(expectOk(boundingBoxOf(sector)), pane, 48, before.zoom));
		designer.unmount();
	});

	/**
	 * `Shift+2` frames the SELECTION. A fit with nothing to frame does NOTHING — `boundsOfZones`' own
	 * rule — because a jump to nowhere costs the user the view they had and says nothing about why.
	 * Renamed deliberately: the canvas HAS a selection since the symbols spec's Decision 10, so the old
	 * title's reason ("nothing is selectable yet") stopped being true while the behaviour stood.
	 */
	it('does nothing on the selection shortcut while nothing is selected', async () => {
		const designer = await mountDesigner(assetDesign({ shape: WITH_CLEARANCE }));
		const store = useEditorStore(designer.pinia);
		const before = store.viewport;

		pressOnCanvas(designer.canvasEl as HTMLElement, 'Digit2');

		expect(store.viewport).toEqual(before);
		designer.unmount();
	});

	/** A selected detail is what `Shift+2` fits — its own box, not the design's. */
	it('frames the selected detail on the selection shortcut', async () => {
		const designer = await mountDesigner(assetDesign({ shape: WITH_DETAILS }));
		const store = useEditorStore(designer.pinia);
		const before = store.viewport;
		useAssetDesignStore(designer.pinia).select({ kind: 'detail', id: 'd2' });

		pressOnCanvas(designer.canvasEl as HTMLElement, 'Digit2');

		const d2 = { min: { x: -100, y: -100 }, max: { x: 100, y: 100 } };
		expect(store.viewport).toEqual(fitViewport(d2, { width: 800, height: 600 }, 48, before.zoom));
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
	it('draws the seven layers, beneath-to-above, with the background first and the gesture last', async () => {
		const designer = await mountDesigner(assetDesign());

		// `asset-selection` joined above the committed picture and below the gesture (symbols spec,
		// Decision 10): a handle sits over every part it can be drawn across, and a gesture over it.
		expect(designer.stage?.getLayers().map((layer) => layer.name())).toEqual([
			'asset-background',
			'asset-footprint',
			'asset-details',
			'asset-clearance',
			'asset-anchor',
			'asset-selection',
			'asset-gesture',
		]);
		designer.unmount();
	});

	/**
	 * Finding E9, ruling: the sketch and the measurement tape are one shared component now
	 * (`GestureSketch.vue`), rooted in a `<VGroup :config="{ name: 'gesture-sketch', … }">` so
	 * vue-konva's per-layer reindex never meets a fragment — the same hazard `ZoneShape.vue` and
	 * `RoomDraftSketch.vue` already carry a docblock about. Before this task only the plan
	 * editor's own `interactionLayer.test.ts` asserted that a gesture actually draws; these two
	 * cases are that same content assertion, applied to the designer, through the real tools
	 * (`designerRig`) rather than through the pure `gestureGeometry` functions the suite above
	 * already covers.
	 */
	it('draws the shared gesture sketch line for a two-point footprint trace', async () => {
		const designer = await designerRig();
		designer.toolbarButton(t('en', 'designer.toolbar.trace-footprint')).click();
		await settle();
		click(designer, { x: 0, y: 0 });
		move(designer, { x: 1000, y: 0 });
		await settle();

		const group = designer.stage.findOne<Konva.Group>('.gesture-sketch');
		expect(group).toBeDefined();
		const line = group?.findOne<Konva.Line>('Line');
		const start = designer.at({ x: 0, y: 0 });
		const end = designer.at({ x: 1000, y: 0 });
		expect(line?.points()).toEqual([start.x, start.y, end.x, end.y]);
		designer.unmount();
	});

	it('draws the shared gesture measurement tape for a two-point calibration', async () => {
		const designer = await designerRig();
		designer.toolbarButton(t('en', 'designer.toolbar.calibrate')).click();
		await settle();
		click(designer, { x: 0, y: 0 });
		move(designer, { x: 1000, y: 0 });
		await settle();

		const group = designer.stage.findOne<Konva.Group>('.gesture-sketch');
		expect(group).toBeDefined();
		expect(group?.findOne('.measurement-marks')).toBeDefined();
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
			false,
			false,
		]);
		designer.unmount();
	});

	/**
	 * The selection is DRAWN, not merely computed: the restroke and one mark per handle, on the stage.
	 * Handles only under Select — under another tool a drawn handle is one nothing grabs — while the
	 * accent outline stays, so a user drawing still sees what is selected.
	 */
	it('draws a selected detail’s outline, its eight box handles and its rotate arrow under Select, and only the outline under another tool', async () => {
		const designer = await designerRig({ shape: WITH_DETAILS });
		designer.toolbarButton(t('en', 'designer.toolbar.select')).click();
		useAssetDesignStore(designer.pinia).select({ kind: 'detail', id: 'd2' });
		await settle();

		expect(designer.stage.findOne('.asset-selection-outline')).toBeDefined();
		expect(designer.stage.find('.asset-selection-handle')).toHaveLength(8);
		expect(designer.stage.find('.asset-rotate-stem')).toHaveLength(1);
		expect(designer.stage.find('.rotation-handle-icon')).toHaveLength(1);

		designer.toolbarButton(t('en', 'designer.toolbar.draw-rect')).click();
		await settle();

		expect(designer.stage.findOne('.asset-selection-outline')).toBeDefined();
		expect(designer.stage.find('.asset-selection-handle')).toHaveLength(0);
		expect(designer.stage.find('.asset-rotate-stem')).toHaveLength(0);
		expect(designer.stage.find('.rotation-handle-icon')).toHaveLength(0);
		designer.unmount();
	});

	/**
	 * The anchor's and the facing's ring, over its halo, is that selection's ONLY mark — neither has an outline to restroke
	 * - so it stays under every tool, as an outline selection accent restroke does (follow-up A1).
	 */
	it.each([['anchor'], ['facing']] as const)('keeps the %s ring under Draw rectangle, its only selection mark', async (kind) => {
		const designer = await designerRig({ shape: WITH_DETAILS });
		designer.toolbarButton(t('en', 'designer.toolbar.select')).click();
		useAssetDesignStore(designer.pinia).select({ kind });
		await settle();

		expect(designer.stage.find('.asset-selection-handle')).toHaveLength(2);
		expect(designer.stage.findOne('.asset-selection-outline')).toBeUndefined();

		designer.toolbarButton(t('en', 'designer.toolbar.draw-rect')).click();
		await settle();

		expect(designer.stage.find('.asset-selection-handle')).toHaveLength(2);
		designer.unmount();
	});

	/** A gesture's preview replaces the committed design on the canvas until its write settles. */
	it('draws a gesture’s preview in place of the committed design', async () => {
		const designer = await mountDesigner(assetDesign());
		useAssetDesignStore(designer.pinia).setPreview({ ...BASE, footprint: expectOk(footprintFromDimensions(2000, 1000)) });
		await settle();

		const line = designer.stage?.findOne('.asset-footprint-outline') as Konva.Line | undefined;
		expect(line?.points()).toEqual([-1000, -500, 1000, -500, 1000, 500, -1000, 500]);
		designer.unmount();
	});

	it('restrokes the footprint as the details layer’s last node, and only over details', async () => {
		const detailed = await mountDesigner(assetDesign({ shape: WITH_DETAILS }));
		const layer = detailed.stage?.findOne<Konva.Layer>('.asset-details');
		expect(layer?.getChildren().at(-1)?.name()).toBe('asset-footprint-edge');
		detailed.unmount();

		const plain = await mountDesigner(assetDesign());
		expect(plain.stage?.findOne('.asset-footprint-edge')).toBeUndefined();
		plain.unmount();
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

	it('draws one detail node per detail', async () => {
		const designer = await mountDesigner(assetDesign({ shape: WITH_DETAILS }));

		expect(designer.stage?.find('.asset-detail')).toHaveLength(2);
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
