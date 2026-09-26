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
 * Three lists carry that geometry, because the producers draw at three different moments: the
 * COMMITTED design's marks (`GEOMETRY_NODES`, on the stage as soon as a shape is read), the
 * SELECTION's (`SELECTION_NODES`, only while something is selected under Select) and the
 * GESTURE's (`GESTURE_NODES`, only while a button is held). The last two are driven through
 * `designerRig` rather than this file's own `mountDesigner`, whose commands all refuse.
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
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { t } from '../../../src/presentation/i18n/strings';
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
import { click, designerRig, held, selecting } from '../../helpers/designerRig';

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

/**
 * **It answers `Konva.stages[0]`, and that registry is MODULE-level and shared with every rig this
 * file mounts.** Safe today only because both `designerRig` cases below take their stage off the
 * END of it (`Konva.stages.at(-1)`) and unmount in an `onTestFinished`, and Konva's
 * `Stage.destroy` splices itself out — so index 0 is this function's own stage whenever it runs. A
 * rig case added here WITHOUT that unmount would leave a stage in front of the queue and the
 * trailing device-pixel-ratio case would silently assert about the wrong one rather than fail.
 * Stated where the next author is standing, since nothing checks it.
 */
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
 * so they draw nothing here — they are `SELECTION_NODES`, asserted across the same flip by a case
 * that does select something, and the two lists together name all ten. The background and the
 * gesture layer name their nodes in their own components, so they are outside that grep's
 * universe — the gesture's one name is `GESTURE_NODES`; `CanvasGrid.vue` is outside it for a
 * DIFFERENT reason — it names no Konva node at all, being a `<div class="rp-canvas-grid">`
 * mounted outside `<VStage>` — and `editor/elements/RotateArrowIcon.vue` is outside it because it
 * lives in another file, while naming `rotation-handle`, `rotation-handle-button` and
 * `rotation-handle-icon` and taking `tokens`.
 *
 * **So what this list closes is the COMMITTED DESIGN's geometry and not the surface's**, which is
 * a statement about this list and no longer about the file: `selectionMarks`, `RotateArrowIcon`
 * and `DesignerGestureLayer` are token-consuming geometry producers too, and the describe below
 * this one asserts their coordinates across the same flip from a mount that selects something and
 * one that holds a gesture. Widening THIS list to reach them would instead add entries that are
 * empty on both sides of the flip, which is the tautology `emptySelectors` exists to refuse.
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
 * One node's coordinates, by what it is drawn AS rather than by which list named it, so the three
 * lists below share one reader. **Which ATTRIBUTES each branch compares is as load-bearing as which
 * NAMES the lists carry, and this docblock says both**, because the first version of it said only
 * the second and the gap was invisible: a capture that reads four of a mark's eight positioning
 * fields is green for a mutation that moves the mark on screen through one of the other four.
 *
 * - **A line**: its flat `points`, which is the WHOLE of what a line here positions with —
 *   `OutlineConfig` in `footprintLayer.ts` declares `points`, `closed`, the stroke pair,
 *   `strokeScaleEnabled`, `listening`, `perfectDrawEnabled` and an optional `dash`, and no `x`,
 *   `y`, offset or scale. So the branch is complete for its producers rather than merely short.
 * - **A circle**: centre and radius. The anchor mark is the only `<VCircle>` in `GEOMETRY_NODES`.
 * - **Anything else**: `x`, `y`, `width`, `height`, `offsetX`, `offsetY`, `cornerRadius`,
 *   `rotation`, `scaleX`, `scaleY`, in that order — every field of `selectionLayer.ts`'s `mark()`
 *   that decides where the mark lands or what shape it is, plus the two the rotate arrow's icon
 *   group scales by. `offsetX`/`offsetY` are `radius`, so they TRANSLATE the drawn mark;
 *   `cornerRadius` is what makes a round handle round and carries `3 * worldPerPixel` on
 *   `.rotation-handle-button`; `rotation` is the 45 that makes a Bend edges handle a diamond.
 *   Reading only the first four left all of those free to move — measured, not argued: mutating
 *   `mark()`'s `offsetX` rather than its `x` left this file green.
 *
 * Three kinds reach that last branch, not two: the selection's handle marks and the rotate arrow's
 * backing are `<VRect>`s, and `.rotation-handle-icon` is a `<VGroup>`. Konva's `Node` defaults
 * `width` and `height` to `0`, so two of the group's numbers are equal on both sides of every
 * possible flip — the same tautology `SELECTION_NODES` cites to EXCLUDE the outer `rotation-handle`
 * group, and it is named here rather than left for a reader to notice. The group stays in because
 * its `x`/`y` are `at.x - radius`/`at.y - radius` and its scales are `radius / 12`, which are four
 * real numbers pinning `radius`; the outer group has none at all.
 *
 * `cornerRadius` is read through `getAttr` because it is a `Rect` property, not a `Node` one, and
 * answers `undefined` on the group — `?? 0` rather than a branch, since a constant is what a
 * comparison across a flip wants from a field that node does not have.
 *
 * The line's `points()` is SPREAD rather than held: it is the node's live array, and a capture that
 * aliased it would compare the scene to itself if a builder ever mutated one in place. Not a defect
 * today — the layer builders allocate a fresh array per computed run — but
 * `tests/presentation/editor/scene.test.ts` already spells a before/after capture `[...line.points()]`
 * for this reason, and one character retires the question.
 */
function coordinatesOf(node: Konva.Node): number[] {
	if (node instanceof Konva.Line) return [...node.points()];
	if (node instanceof Konva.Circle) return [node.x(), node.y(), node.radius()];
	return [
		node.x(), node.y(), node.width(), node.height(),
		node.offsetX(), node.offsetY(),
		(node.getAttr('cornerRadius') as number | undefined) ?? 0,
		node.rotation(), node.scaleX(), node.scaleY(),
	];
}

/**
 * The drawn coordinates for a list of node names, read off the SCENE.
 *
 * Read from the stage rather than from the fixture on purpose. The fixture is what the theme
 * path cannot reach, so comparing it across a flip would be comparing a constant to itself; these
 * numbers are the output of `footprintOutline`, `detailOutlines`, `footprintEdge`,
 * `clearanceOutline`, `anchorMark` and `facingArrow` for `GEOMETRY_NODES`, and of `selectionMarks`,
 * `RotateArrowIcon` and `DesignerGestureLayer` for the two lists beside it — every one of which
 * takes the palette as a parameter.
 */
function drawnGeometry(stage: Konva.Stage | null, selectors: readonly string[]): Record<string, number[][]> {
	return Object.fromEntries(selectors.map((selector) => [
		selector,
		// Wrapped rather than passed by reference: oxlint's `unicorn/no-array-callback-reference`
		// refuses the bare identifier, and an iterator's extra arguments are exactly the hazard.
		nodesNamed(stage, selector).map((node) => coordinatesOf(node)),
	]));
}

/**
 * The selectors a capture reached NOTHING for. A list that is not empty is a capture comparing an
 * empty object to an empty object, which is green forever and evidence of nothing — a renamed node,
 * a layer that never rendered, a selection that was never made, a gesture that never started.
 */
function emptySelectors(captured: Record<string, number[][]>): string[] {
	return Object.entries(captured).filter(([, nodes]) => nodes.length === 0).map(([selector]) => selector);
}

/** One node's stroke, which IS a token: the flip-took guard for a list whose own subject is that node. */
const strokeOf = (stage: Konva.Stage | null, selector: string): string | undefined =>
	nodesNamed(stage, selector).at(0)?.getAttr('stroke') as string | undefined;

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
		const light = { stroke: footprintStroke(stage), geometry: drawnGeometry(stage, GEOMETRY_NODES) };
		// The capture has to have FOUND something. A selector that reached nothing — a renamed
		// node, a layer that never rendered, a stage that never mounted — would make the
		// comparison below an empty object against an empty object, green forever.
		expect(emptySelectors(light.geometry)).toEqual([]);

		applyPalette(5);
		for (const listener of themeListeners) listener();
		await settle();

		expect(footprintStroke(stage)).not.toBe(light.stroke);
		expect(drawnGeometry(stage, GEOMETRY_NODES)).toEqual(light.geometry);
	});
});

/**
 * The SELECTION's own marks, which the case above cannot reach because it selects nothing.
 *
 * Written from the grep `GEOMETRY_NODES`'s docblock carries rather than from memory. Run again
 * after this list was added, it prints the same ten names — `asset-anchor-mark`,
 * `asset-clearance-outline`, `asset-detail`, `asset-facing-head`, `asset-facing-shaft`,
 * `asset-footprint-edge`, `asset-footprint-outline`, `asset-rotate-stem`,
 * `asset-selection-handle`, `asset-selection-outline` — and the two lists together now name all
 * ten, where `GEOMETRY_NODES` alone named seven.
 *
 * Two names here are NOT in that grep's universe, because they are drawn in another file:
 * `grep -oE "name: '[a-z-]+'" src/presentation/editor/elements/RotateArrowIcon.vue | sort -u`
 * prints `rotation-handle`, `rotation-handle-button` and `rotation-handle-icon`. The middle one is
 * the arrow's canvas-coloured backing, at `at.x - backing`/`at.y - backing`; the last is the group
 * the lucide paths are drawn in, at `at.x - radius`/`at.y - radius`. The OUTER `rotation-handle`
 * group is deliberately out: it positions nothing — no `x`, no `y` — so it would be an entry equal
 * on both sides of any flip whatever the code did, which is the tautology `emptySelectors` exists
 * to refuse one direction of.
 *
 * **This list decides which NAMES are compared and `coordinatesOf` decides which ATTRIBUTES**, and
 * the second question is the one that hid a hole: every field of `selectionMarks`'s `mark()` that
 * positions or shapes a mark is compared, `offsetX`/`offsetY`/`cornerRadius`/`rotation` included,
 * and that docblock is where the list and the measurement behind it live.
 */
const SELECTION_NODES = [
	'.asset-selection-outline',
	'.asset-selection-handle',
	'.asset-rotate-stem',
	'.rotation-handle-button',
	'.rotation-handle-icon',
] as const;

/**
 * The GESTURE in flight. `grep -oE "name: '[a-z-]+'" src/presentation/designer/layers/DesignerGestureLayer.vue | sort -u`
 * prints exactly one name, `detail-preview`, which is the only node that layer's own template
 * draws; its three siblings — `GestureSketch`, `MarqueeOverlay` and `SnapGuides` — name their nodes
 * in `editor/layers/`, take `tokens` too, and are NOT covered here. Saying which gesture is
 * covered is the honest form: this list closes a draw tool's preview across a flip and says
 * nothing about a marquee, a sketch or a snap guide.
 */
const GESTURE_NODES = ['.detail-preview'] as const;

/**
 * The same flip as the case above, against the two things that case could not put on the stage:
 * marks that exist only while something is SELECTED, and a preview that exists only while a button
 * is HELD. Both are the real mounted designer, through `designerRig` — not this file's own
 * `mountDesigner`, whose context binds `unavailableAssetDesignerCommands()` and whose tools
 * therefore refuse before they draw anything. (Not "the rig every gesture case here drives":
 * `selecting()`'s own docblock measures that claim and falsifies it — three sweep-subject cases
 * under `tools/` and `selection/` drive no rig at all.)
 *
 * The flip travels the same seam: a whole palette on `document.body`, then Obsidian's `css-change`
 * through the context's own `onThemeChange`, which is `rig.fireThemeChange()`. The class half of a
 * real flip is as inert here as it is above, for the reason `applyPalette` states.
 *
 * **What these cases do NOT establish**, in the same words the geometry case uses: jsdom has no
 * rendering engine, so whether a handle is legible against the ground it lands on, or whether a
 * preview is occluded by the shape under it, is unobservable at any effort. What is checked is
 * that a palette change moves colours and moves no coordinate.
 */
describe('the designer selection, the gesture in flight, and a theme change', () => {
	/**
	 * A footprint selected under Select, which is the arm that puts all five of `SELECTION_NODES`
	 * on the stage at once: the accent restroke, eight box handle marks, the rotate stem, and the
	 * arrow's backing and icon group. `DesignerCanvas` drops the handles and the rotate mark under
	 * any tool but Select, so reaching the tool by its button is load-bearing rather than tidy —
	 * `selecting()` is that press.
	 *
	 * The flip-took guard is the SELECTION's own stroke rather than the footprint's, because the
	 * subject is the selection layer: `selectionMarks` strokes the outline in `tokens.accent`, so a
	 * build that re-resolved the palette everywhere except this layer fails here and would pass a
	 * guard read off `.asset-footprint`.
	 */
	it("moves the selection's palette and not one of its marks", async () => {
		onTestFinished(clearPalette);
		applyPalette(250);
		const rig = await selecting();
		onTestFinished(() => rig.unmount());
		// Inside `editableShape()`'s footprint (x -500..500, y -300..300), right of `detail-1` and
		// clear of `detail-2`'s circle at (250, 0) r 200 — so the pick is the footprint itself, and
		// the assertion below says so rather than leaving a mis-pick to show up as an empty capture.
		click(rig, { x: 450, y: -250 });
		await settle();
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'footprint' });
		const light = { stroke: strokeOf(rig.stage, '.asset-selection-outline'), geometry: drawnGeometry(rig.stage, SELECTION_NODES) };
		expect(emptySelectors(light.geometry)).toEqual([]);

		applyPalette(5);
		rig.fireThemeChange();
		await settle();

		expect(strokeOf(rig.stage, '.asset-selection-outline')).not.toBe(light.stroke);
		expect(drawnGeometry(rig.stage, SELECTION_NODES)).toEqual(light.geometry);
	});

	/**
	 * A theme switched MID-GESTURE, which is the only moment `detail-preview` exists: the layer
	 * draws it from `renderState.previewPolygon` and takes it away on the release.
	 *
	 * `held` rather than `drag`: the rig's `drag` releases in the same tick, so no render lands
	 * between its move and its release and there would be nothing on the stage to flip against.
	 * The release still comes, at the end — a press this rig sends is never left without one, and
	 * a gesture abandoned by the test would be an input no hand can produce.
	 */
	it("moves the gesture's palette and not one of its preview coordinates", async () => {
		onTestFinished(clearPalette);
		applyPalette(250);
		const rig = await designerRig({ shape: editableShape() });
		onTestFinished(() => rig.unmount());
		rig.toolbarButton(t('en', 'designer.toolbar.draw-rect')).click();
		await settle();
		held(rig, 'pointerdown', { x: 200, y: 200 }, 1);
		held(rig, 'pointermove', { x: 600, y: 500 }, 1);
		await settle();
		const light = { stroke: strokeOf(rig.stage, '.detail-preview'), geometry: drawnGeometry(rig.stage, GESTURE_NODES) };
		expect(emptySelectors(light.geometry)).toEqual([]);

		applyPalette(5);
		rig.fireThemeChange();
		await settle();

		expect(strokeOf(rig.stage, '.detail-preview')).not.toBe(light.stroke);
		expect(drawnGeometry(rig.stage, GESTURE_NODES)).toEqual(light.geometry);

		held(rig, 'pointerup', { x: 600, y: 500 }, 0);
		await settle();
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
