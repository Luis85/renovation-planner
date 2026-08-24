/**
 * @vitest-environment jsdom
 *
 * The Konva scene: §17's seven layers, and the render pipeline that turns a persisted Zone
 * into a shape on them.
 *
 * Real Konva throughout — see `tests/helpers/editor.ts` for why nothing here is stubbed.
 */
import Konva from 'konva';
import { afterEach, describe, expect, it } from 'vitest';
import { KONVA_LAYER_IDS } from '../../../src/presentation/editor/scene/KonvaLayers';
import { t } from '../../../src/presentation/i18n/strings';
import {
	layerNames,
	mountPlanEditor,
	settle,
	zoneLines,
	type EditorHarness,
} from '../../helpers/editor';
import { FIXTURE_ZONES } from '../../helpers/planFixtures';
import { connectedObservers } from '../../helpers/layout';

let harness: EditorHarness | null = null;

afterEach(() => {
	harness?.unmount();
	harness = null;
});

describe('the scene structure', () => {
	it('mounts all seven layers in the fixed order §17 draws them', async () => {
		harness = await mountPlanEditor();

		expect(layerNames(harness.stage)).toEqual([...KONVA_LAYER_IDS]);
	});

	/**
	 * The contract slice 6 builds against. "Present and mounted" is what makes it a place to
	 * put a `Transformer`; "empty" is what says nothing here has claimed it yet.
	 */
	it('mounts the interaction layer present and empty', async () => {
		harness = await mountPlanEditor();

		const interaction = harness.stage.findOne<Konva.Layer>('.interaction');

		expect(interaction).toBeDefined();
		expect(interaction?.getChildren()).toHaveLength(0);
	});

	/**
	 * The InteractionLayer is where slice 6's constant-size affordances go, so it must NOT
	 * carry the viewport transform while the six world-space layers do. Asserted after a
	 * zoom, because at the default viewport a scale of 1 would make the two cases look
	 * identical.
	 */
	it('binds the viewport transform to every world-space layer and to no other', async () => {
		harness = await mountPlanEditor();
		harness.stage.container().dispatchEvent(new WheelEvent('wheel', { deltaY: -400, bubbles: true }));
		await settle();

		const scaled = harness.stage.getChildren().filter((layer) => layer.scaleX() !== 1);
		const unscaled = harness.stage.getChildren().filter((layer) => layer.scaleX() === 1);

		expect(scaled.map((layer) => layer.name())).toEqual(
			KONVA_LAYER_IDS.filter((id) => id !== 'interaction'),
		);
		expect(unscaled.map((layer) => layer.name())).toEqual(['interaction']);
	});

	/** §62: an inert hit graph on layers nothing interacts with is a second canvas for nothing. */
	it('leaves every layer non-listening, since no tool exists yet', async () => {
		harness = await mountPlanEditor();

		expect(harness.stage.getChildren().map((layer) => layer.listening())).toEqual(
			KONVA_LAYER_IDS.map(() => false),
		);
	});
});

describe('a persisted zone on screen', () => {
	it('renders one closed outline per hydrated zone, keyed by domain id', async () => {
		harness = await mountPlanEditor();

		const lines = zoneLines(harness.stage);

		// Two nodes per zone: a translucent fill and a full-opacity outline.
		expect(lines).toHaveLength(FIXTURE_ZONES.length * 2);
		expect(lines.every((line) => line.closed())).toBe(true);
	});

	/**
	 * The heart of the pipeline: what reaches Konva is the WORLD geometry, unconverted. A
	 * `<v-line>` holding screen coordinates would still draw correctly at the viewport it
	 * was converted for, so the check is the numbers themselves, against the persisted
	 * millimetres.
	 */
	it('hands Konva the persisted world millimetres, not screen coordinates', async () => {
		harness = await mountPlanEditor();

		const kitchen = FIXTURE_ZONES[0];
		const expected = kitchen.points.flatMap((point) => [point.x, point.y]);

		expect(zoneLines(harness.stage)[0].points()).toEqual(expected);
	});

	/**
	 * DoD 5, asserted STRUCTURALLY rather than by timing — the defect is that someone
	 * reintroduced a per-vertex `worldToScreen`, and a frame-rate assertion for that is
	 * flaky on CI. If the points array survives a pan and a zoom by REFERENCE, no code
	 * rebuilt it, which is the same statement with a check behind it.
	 */
	it('changes no shape points when the camera moves', async () => {
		harness = await mountPlanEditor();
		const before = zoneLines(harness.stage).map((line) => line.points());

		const container = harness.stage.container();
		container.dispatchEvent(new WheelEvent('wheel', { deltaY: -240, bubbles: true }));
		await settle();
		container.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 100, bubbles: true }));
		container.dispatchEvent(new PointerEvent('pointermove', { clientX: 260, clientY: 190, bubbles: true }));
		container.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
		await settle();

		const after = zoneLines(harness.stage).map((line) => line.points());

		expect(after).toHaveLength(before.length);
		for (const [index, points] of after.entries()) expect(points).toBe(before[index]);
	});

	/** The camera moved something, or the assertion above passes for the wrong reason. */
	it('moves the layers themselves when the camera moves', async () => {
		harness = await mountPlanEditor();
		const zoneLayer = harness.stage.findOne<Konva.Layer>('.zone') as Konva.Layer;
		const before = { x: zoneLayer.x(), y: zoneLayer.y(), scale: zoneLayer.scaleX() };

		// Anchored AWAY from the origin. Zooming about (0, 0) with the pan already at (0, 0)
		// legitimately leaves the layer position alone, so an anchor at the stage corner would
		// make this assertion about arithmetic rather than about the camera.
		harness.stage
			.container()
			.dispatchEvent(new WheelEvent('wheel', { deltaY: -240, clientX: 400, clientY: 300, bubbles: true }));
		await settle();

		expect(zoneLayer.scaleX()).toBeGreaterThan(before.scale);
		expect({ x: zoneLayer.x(), y: zoneLayer.y() }).not.toEqual({ x: before.x, y: before.y });
	});

	/**
	 * Rehydrating the same plan produces the identical rendered geometry, with nothing
	 * carried by Konva itself between the two.
	 */
	it('renders identical points after a re-hydration', async () => {
		harness = await mountPlanEditor();
		const before = zoneLines(harness.stage).map((line) => [...line.points()]);

		harness.changePlan();
		await settle();

		expect(zoneLines(harness.stage).map((line) => [...line.points()])).toEqual(before);
	});

	/**
	 * Konva scales stroke width with the node, so a 1-pixel outline becomes 20 at 20× zoom.
	 * Silent when got wrong, which is why it is a test rather than a comment.
	 */
	it('does not scale zone outlines with the zoom', async () => {
		harness = await mountPlanEditor();

		const outlines = zoneLines(harness.stage).filter((line) => line.stroke() !== undefined);

		expect(outlines.length).toBeGreaterThan(0);
		expect(outlines.every((line) => line.strokeScaleEnabled() === false)).toBe(true);
	});
});

describe('theme and accessibility of a zone', () => {
	/**
	 * §84: a Konva shape cannot read a CSS variable, so the fill has to be RESOLVED — and
	 * resolved from the theme rather than from a constant in the source. The assertion is
	 * that the value tracks the variable: change what `--color-blue` resolves to, fire the
	 * theme event, and the shape follows.
	 */
	it('resolves a zone fill from an Obsidian variable and follows a theme change', async () => {
		document.documentElement.style.setProperty('--color-blue', 'rgb(1, 2, 3)');
		harness = await mountPlanEditor();

		const fillNode = zoneLines(harness.stage)[0];
		expect(fillNode.fill()).toBe('rgb(1, 2, 3)');

		document.documentElement.style.setProperty('--color-blue', 'rgb(9, 8, 7)');
		harness.changeTheme();
		await settle();

		expect(zoneLines(harness.stage)[0].fill()).toBe('rgb(9, 8, 7)');
		document.documentElement.style.removeProperty('--color-blue');
	});

	/**
	 * §85: status must not be encoded by colour alone. Two non-colour channels, and both are
	 * asserted because each fails differently — a dash pattern is invisible at a low zoom,
	 * and a caption is unreadable on a printed grayscale plan at a high one.
	 */
	it('distinguishes zone status without relying on colour', async () => {
		harness = await mountPlanEditor();

		const outlines = zoneLines(harness.stage).filter((line) => line.dash() !== undefined);
		const captions = harness.stage.findOne<Konva.Layer>('.zone')?.find('Text') ?? [];
		const texts = captions.map((node) => (node as Konva.Text).text());

		// 'Planned' is dashed and 'Complete' is solid: two statuses, two patterns.
		expect(outlines[0].dash()).not.toEqual(outlines[1].dash());
		expect(texts).toContain(t('en', 'zone.status.planned'));
		expect(texts).toContain(t('en', 'zone.status.complete'));
		expect(texts).toContain('Kitchen');
	});
});

describe("the editor own lifecycle", () => {
	it('leaves no Konva stage, theme listener or resize observer behind on unmount', async () => {
		const stagesBefore = Konva.stages.length;
		const observersBefore = connectedObservers();

		const mounted = await mountPlanEditor();
		expect(Konva.stages.length).toBe(stagesBefore + 1);
		expect(mounted.themeListeners()).toBe(1);

		mounted.unmount();
		await settle();

		expect(Konva.stages.length).toBe(stagesBefore);
		expect(mounted.themeListeners()).toBe(0);
		expect(connectedObservers()).toBe(observersBefore);
	});

	it('stacks nothing across repeated open and close cycles', async () => {
		const stagesBefore = Konva.stages.length;

		for (let cycle = 0; cycle < 3; cycle += 1) {
			const mounted = await mountPlanEditor();
			mounted.unmount();
			await settle();
		}

		expect(Konva.stages.length).toBe(stagesBefore);
		expect(connectedObservers()).toBe(0);
	});
});
