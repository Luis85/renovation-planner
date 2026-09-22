/**
 * @vitest-environment jsdom
 *
 * The designer's palette, kept current as the user changes theme.
 *
 * A canvas cannot read a CSS variable — `fill: var(--text-normal)` means nothing to a 2D
 * context — so `resolveThemeTokens` is the bridge, exactly as it is for the plan editor. What
 * the designer lacked was the plan editor's `onThemeChange`: it resolved ONCE at setup, so a
 * user who switched theme or toggled dark mode with a designer open kept a light-theme stroke
 * on a dark ground until the leaf was reopened. That was a stated limitation in
 * `DesignerCanvas`'s own header for two tasks; this file is what replaced the sentence.
 *
 * Asserted on the DRAWN stroke rather than on the token object, because the token object is
 * equally refreshed by a build that never hands the new value to a layer.
 *
 * The same reasoning is why the GEOMETRY is asserted across a flip here too (matrix row T32):
 * every config behind `GEOMETRY_NODES` is a `computed` over `tokens.value`, so a theme change
 * re-runs the point packing for all of them and the coordinates are a thing a theme change can
 * really move. **Not "every config on this canvas"** — `designerLayerConfig(…)` and its four
 * siblings are built inline in the template and take no tokens, and `transform`, `worldPerPixel`,
 * `grid`, `shape`, `background` and `pixelsPerWorldUnit` are `computed`s over things that are not
 * the palette. The narrower sentence is the one with a check under it.
 *
 * What no case in this file can reach is the other half of that row — whether the result is
 * VISIBLE, or occluded — for the reason `layers.test.ts`'s header already gives: jsdom draws
 * nothing and lays nothing out.
 *
 * The monitor's pixel ratio is the same shape of question — a canvas kept current as its
 * surroundings change — so its one wiring case lives here rather than in a file of its own.
 */
import { afterEach, beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import Konva from 'konva';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import { THEME_TOKENS } from '../../../src/presentation/editor/theme/themeTokens';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { ok } from '../../../src/core/result/Result';
import { assetDesign } from '../../helpers/assetDesign';
import { editableShape } from '../../helpers/assetShapes';
import { emptyBackgroundVault } from '../../helpers/background';
import { armedMediaQueries, installCanvas } from '../../helpers/canvas';
import { installObsidianDom } from '../../helpers/dom';
import { installResizeObserver, placeAt, resizeTo } from '../../helpers/layout';
import { recorder } from '../../helpers/logger';
import { settle } from '../../helpers/editor';
import { unwiredPlanUsage } from '../../helpers/designerQueries';

const ZONE_STROKE = '--text-normal';

/** The listeners a real `css-change` subscription would hold, so a case can fire one. */
const themeListeners = new Set<() => void>();

function context(shape?: AssetShape): AssetDesignerContext {
	const design = shape === undefined ? assetDesign() : assetDesign({ shape });
	return {
		assetId: String(design.assetId),
		queries: { getAssetDesign: () => Promise.resolve(ok(design)), listPlansUsingAsset: unwiredPlanUsage },
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		vault: emptyBackgroundVault(),
		onDesignChanged: () => () => undefined,
		indexScanCompleted: () => true,
		// A source that never fires, rather than one omitted: the member is required precisely so
		// no surface can forget to answer the question, and this suite's cases are not about a file
		// moving under the surface. `backgroundInEditor.test.ts` is where that door is driven.
		onVaultFileChanged: () => () => undefined,
		// Not the dangling state's suite: `assetDesignerRoot.test.ts` is where the tree is asked
		// whether it CALLS this, and `assetDesignerView.test.ts` whether calling it detaches the
		// leaf. Present rather than omitted because the member is required precisely so no surface
		// can forget to answer the question.
		closeLeaf: () => undefined,
		onThemeChange: (listener: () => void) => {
			themeListeners.add(listener);
			return () => themeListeners.delete(listener);
		},
	};
}

let wrapper: ReturnType<typeof mount> | null = null;

beforeEach(() => {
	installObsidianDom();
	installCanvas();
	installResizeObserver();
	themeListeners.clear();
	// Obsidian declares its palette on `body` (`.theme-light`/`.theme-dark` sit there too), never
	// on `:root`. The `<html>` decoy is what the designer drew before it read `body`: a white
	// stroke, invisible on a light theme's white ground.
	document.documentElement.style.setProperty(ZONE_STROKE, 'rgb(255, 255, 255)');
	document.body.style.setProperty(ZONE_STROKE, 'rgb(1, 2, 3)');
});

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	document.documentElement.style.removeProperty(ZONE_STROKE);
	document.body.style.removeProperty(ZONE_STROKE);
});

async function mountDesigner(shape?: AssetShape): Promise<Konva.Stage | null> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	wrapper = mount(AssetDesignerRoot, {
		attachTo: host,
		global: {
			plugins: [createPinia(), VueKonva],
			provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context(shape) },
		},
	});
	await flushPromises();
	const canvas = wrapper.find('.rp-designer-canvas .rp-plan-canvas');
	if (canvas.exists()) {
		placeAt(canvas.element as HTMLElement, 0, 0, 800, 600);
		resizeTo(canvas.element as HTMLElement, 800, 600);
		await settle();
	}
	return Konva.stages[0] ?? null;
}

const footprintStroke = (stage: Konva.Stage | null): string | undefined =>
	stage?.findOne<Konva.Layer>('.asset-footprint')?.findOne<Konva.Line>('Line')?.stroke() as string | undefined;

/**
 * Every DISTINCT variable the palette declares, derived from `THEME_TOKENS` rather than
 * transcribed, so a token added to that table joins the flip below instead of quietly sitting
 * outside it. Distinct because two token names share `--text-normal` and two share
 * `--text-muted`; setting a variable twice would leave the second value standing and make
 * "one value per token" false.
 */
const THEME_VARIABLES = [...new Set(Object.values(THEME_TOKENS))];

/**
 * A WHOLE palette on `body`, which is the element the designer resolves against — it passes
 * `ref(null)` as its root, so `useThemeTokens`'s fallback is all it ever reads.
 *
 * `channel` is the red channel of every variable, so one call is one scheme and two calls with
 * different channels are a light↔dark flip: every token moves, rather than the single variable
 * the `css-change` case above drives.
 *
 * **What a real flip carries that this one does not.** Obsidian toggles `.theme-light`/
 * `.theme-dark` on this same element and its stylesheet redeclares the variables under those
 * selectors. jsdom cascades no stylesheet, so a class here would be inert; what is driven is
 * the RESOLVED half, which is the half `resolveThemeTokens` reads and therefore the whole of
 * what reaches a Konva config.
 */
function applyPalette(channel: number): void {
	THEME_VARIABLES.forEach((variable, index) => {
		document.body.style.setProperty(variable, `rgb(${channel}, ${index}, 0)`);
	});
}

function clearPalette(): void {
	for (const variable of THEME_VARIABLES) document.body.style.removeProperty(variable);
}

/**
 * The COMMITTED DESIGN's own geometry, by node name — the output of the four layer modules the
 * palette is threaded through.
 *
 * Narrower than "every node the canvas draws", deliberately, and the difference is greppable:
 * `grep -oE "name: '[a-z-]+'" src/presentation/designer/DesignerCanvas.vue | sort -u` prints ten
 * names, and these are that ten less `asset-selection-outline`, `asset-selection-handle` and
 * `asset-rotate-stem`. Those three are the SELECTION's marks and the case below selects nothing,
 * so they draw nothing and a theme change could not move them. The background and the gesture
 * layer name their nodes in their own components, so they are outside that grep's universe;
 * `CanvasGrid.vue` is outside it for a DIFFERENT reason — it names no Konva node at all, being a
 * `<div class="rp-canvas-grid">` mounted outside `<VStage>` — and
 * `editor/elements/RotateArrowIcon.vue` is outside it because it lives in another file, while
 * naming `rotation-handle`, `rotation-handle-button` and `rotation-handle-icon` and taking
 * `tokens`.
 *
 * **So what this list closes is the COMMITTED DESIGN's geometry and not the surface's.**
 * `selectionMarks` takes `tokens` and emits `points: flatPoints(run.points)` and `x`/`y` marks;
 * `RotateArrowIcon` takes `tokens` and emits a `VRect` at real coordinates;
 * `DesignerGestureLayer` takes `tokens` too. All three are token-consuming geometry producers
 * whose coordinates NO case asserts across a theme flip, because covering them needs a mount that
 * selects something and one that draws a gesture — a card of its own, not a widening of this
 * list. A wider list here would instead add entries that are empty on both sides of the flip,
 * which is the tautology the non-empty check below exists to refuse.
 */
const GEOMETRY_NODES = [
	'.asset-footprint-outline',
	'.asset-footprint-edge',
	'.asset-detail',
	'.asset-clearance-outline',
	'.asset-anchor-mark',
	'.asset-facing-shaft',
	'.asset-facing-head',
] as const;

/**
 * Konva's selector lookup, wrapped for one reason worth stating where it is: `stage.find(name)`
 * with an identifier argument trips oxlint's `unicorn/no-array-callback-reference`, which takes
 * the identifier for a function reference handed to an array iterator.
 *
 * **The rule keys on a BARE-IDENTIFIER receiver**, which is narrower than "any `.find(ident)`" and
 * is measured rather than assumed: a probe of four call forms reports `stage.find(sel)` and stays
 * silent on `harness.wrapper.find(sel)`, on `obj.inner.find(sel)` and on the template-literal
 * form. That is why `rig.wrapper.find(OPACITY)` in `designerReferenceView.test.ts` and its
 * siblings pass an identifier to `.find` and lint clean, and why only the `stage.` receiver here
 * needs anything. The argument is a selector STRING and the template literal is what says so; an
 * explicit cast is the only other form the rule accepts, and it would be claiming a type rather
 * than building a string.
 */
const nodesNamed = (stage: Konva.Stage | null, selector: string): Konva.Node[] => stage?.find(`${selector}`) ?? [];

/**
 * The drawn coordinates, read off the SCENE: a line's flat `points`, and the anchor's centre and
 * radius, which is the only one of `GEOMETRY_NODES` drawn as a `<VCircle>` rather than a
 * `<VLine>` and so the only one carrying no points array.
 *
 * Read from the stage rather than from the fixture on purpose. The fixture is what the theme
 * path cannot reach, so comparing it across a flip would be comparing a constant to itself; these
 * numbers are the output of `footprintOutline`, `detailOutlines`, `footprintEdge`,
 * `clearanceOutline`, `anchorMark` and `facingArrow`, every one of which takes the palette as a
 * parameter and is a `computed` over it in `DesignerCanvas`.
 */
function drawnGeometry(stage: Konva.Stage | null): Record<string, number[][]> {
	return Object.fromEntries(GEOMETRY_NODES.map((selector) => [
		selector,
		// The line's `points()` is SPREAD rather than held: it is the node's live array, and a
		// capture that aliased it would compare the scene to itself if a builder ever mutated one
		// in place. Not a defect today — the layer builders allocate a fresh array per computed run
		// — but `tests/presentation/editor/scene.test.ts` already spells a before/after capture
		// `[...line.points()]` for this reason, and one character retires the question.
		nodesNamed(stage, selector).map((node) => (node instanceof Konva.Circle
			? [node.x(), node.y(), node.radius()]
			: [...(node as Konva.Line).points()])),
	]));
}

describe('the designer palette and a theme change', () => {
	it('re-resolves the drawn stroke when Obsidian reports a css-change', async () => {
		const stage = await mountDesigner();
		expect(footprintStroke(stage)).toBe('rgb(1, 2, 3)');

		document.body.style.setProperty(ZONE_STROKE, 'rgb(9, 8, 7)');
		for (const listener of themeListeners) listener();
		await settle();

		expect(footprintStroke(stage)).toBe('rgb(9, 8, 7)');
	});

	/**
	 * A listener outliving its view would re-resolve against a detached element for the rest of
	 * the session, and the next open would add a second one — the leak `useThemeTokens` states
	 * at its own registration and which this surface now inherits rather than restates.
	 */
	it('unsubscribes with the view', async () => {
		await mountDesigner();
		expect(themeListeners.size).toBe(1);

		wrapper?.unmount();
		wrapper = null;

		expect(themeListeners.size).toBe(0);
	});

	/**
	 * T32's GEOMETRY half (`docs/tasks/asset-designer-expansion/ACCEPTANCE-AND-QA.md`): a theme
	 * change moves the whole palette and moves nothing a user measures.
	 *
	 * The case above drives one variable and asserts one stroke; this one flips every variable
	 * `THEME_TOKENS` declares and asserts the coordinates of `GEOMETRY_NODES` — the committed
	 * design's own marks, which is narrower than "every node the canvas draws". Neither
	 * subsumes the other — a build that re-resolved the palette and rebuilt the footprint at new
	 * coordinates passes the case above, and a build that moved nothing because it re-resolved
	 * nothing would pass this one on the geometry alone, which is why the flip is asserted to have
	 * TAKEN before the geometry is compared.
	 *
	 * It can fail, which is the thing to check before trusting it. Every config behind
	 * `GEOMETRY_NODES` is a `computed` over `tokens.value` in `DesignerCanvas` — `footprintOutline`,
	 * `detailOutlines`, `footprintEdge`, `clearanceOutline`, `anchorMark` and `facingArrow` each
	 * take the palette as a parameter — so a theme change genuinely re-runs the point packing for
	 * all of them, and the comparison is between two SCENES rather than between the fixture and
	 * itself. (Not every config on the canvas: the `VLayer` configs and six other `computed`s take
	 * no tokens at all, and `GEOMETRY_NODES`'s own docblock carries that distinction.) Watched red:
	 * rebuilding the restroke's points from `tokens.zoneStroke.length` inside `footprintEdge`
	 * reddens exactly this case, on `.asset-footprint-edge`, with the rest of the file green.
	 *
	 * `editableShape()` rather than the file's default fixture because it carries every part at
	 * once — a footprint, a clearance, two details (so the restroke draws at all), an anchor and a
	 * facing — where `assetDesign()`'s own shape has no clearance and no details, and would leave
	 * three of the seven selectors reaching nothing. It is not the ONLY fixture that would do:
	 * `tests/helpers/assetShapes.ts` exports `toiletShape` and `shapeWithOpenGraphic` beside it,
	 * and either would also fill the list.
	 *
	 * **Two things this case does NOT close**, so the row is not graded from it alone. T32 asks
	 * for visibility and occlusion as well, and jsdom has no rendering engine: nothing in this
	 * suite can observe whether a line is legible against its ground or whether one covers
	 * another — a vault, or a capture in both schemes, is the only instrument for that. And the
	 * geometry half itself is closed for the COMMITTED DESIGN's marks only: the selection's and
	 * the gesture's geometry consume `tokens` too and are asserted across no flip, for the reason
	 * `GEOMETRY_NODES`'s docblock gives.
	 */
	it('moves the whole palette and not one drawn coordinate', async () => {
		onTestFinished(clearPalette);
		applyPalette(250);
		const stage = await mountDesigner(editableShape());
		const light = { stroke: footprintStroke(stage), geometry: drawnGeometry(stage) };
		// The capture has to have FOUND something. A selector that reached nothing — a renamed
		// node, a layer that never rendered, a stage that never mounted — would make the
		// comparison below an empty object against an empty object, green forever.
		expect(Object.entries(light.geometry).filter(([, nodes]) => nodes.length === 0)).toEqual([]);

		applyPalette(5);
		for (const listener of themeListeners) listener();
		await settle();

		expect(footprintStroke(stage)).not.toBe(light.stroke);
		expect(drawnGeometry(stage)).toEqual(light.geometry);
	});
});

describe('the designer canvas and the monitor the window is on', () => {
	/**
	 * `scene/followPixelRatio.test.ts` holds the follower itself; this is what proves
	 * `DesignerCanvas` MOUNTS it, which no unit case can see. The fake `matchMedia` never fires
	 * on its own, so the monitor move is the ratio write plus the `change` on the armed list.
	 */
	it('resizes every layer backing store when the device pixel ratio changes', async () => {
		const stage = await mountDesigner();
		const layers = stage?.getLayers() ?? [];
		expect(layers.length).toBeGreaterThan(0);
		onTestFinished(() => { Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 }); });

		Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
		armedMediaQueries().at(-1)?.dispatchEvent(new Event('change'));

		expect(layers.map((layer) => layer.getCanvas().getPixelRatio())).toEqual(layers.map(() => 2));
	});
});
