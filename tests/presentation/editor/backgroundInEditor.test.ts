/**
 * @vitest-environment jsdom
 *
 * The background, all the way through: a Plan whose reference names a real Vault file ends
 * up as a Konva image on the background layer, at the world size its scale implies — and a
 * Plan whose file is gone says so instead.
 */
import Konva from 'konva';
import { afterEach, describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { ok } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import type { BackgroundVault } from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';
import type { PlanDto } from '../../../src/presentation/read-models/PlanDto';
import { clearResources, registerResource, releaseResource } from '../../helpers/canvas';
import { pngFixture } from '../../helpers/backgroundFixtures';
import { mountPlanEditor, settle, settleUntil, type EditorHarness } from '../../helpers/editor';
import { FIXTURE_PLAN } from '../../helpers/planFixtures';

let harness: EditorHarness | null = null;

afterEach(() => {
	harness?.unmount();
	harness = null;
	clearResources();
});

const PNG = 'Plans/ground.png';

function vaultWith(paths: readonly string[]): BackgroundVault {
	return {
		getAbstractFileByPath(path: string) {
			if (!paths.includes(path)) return null;
			const file = new TFile();
			file.path = path;
			return file;
		},
		getResourcePath: (file: { path: string }) => `app://fake/${file.path}`,
		readBinary: () => Promise.resolve(new ArrayBuffer(0)),
	} as unknown as BackgroundVault;
}

function planWith(background: PlanDto['background']): PlanDto {
	return { ...FIXTURE_PLAN, background };
}

/** The Konva image node on the background layer, if the layer has one. */
function backgroundImage(mounted: EditorHarness | null): Konva.Image | undefined {
	return mounted?.stage?.findOne<Konva.Layer>('.background')?.findOne<Konva.Image>('Image') ?? undefined;
}

describe('a plan with a background', () => {
	it('draws the raster at the world size its placeholder scale implies', async () => {
		registerResource(`app://fake/${PNG}`, pngFixture(400, 300));
		harness = await mountPlanEditor({
			plan: planWith({ path: PNG, kind: 'image' }),
			vault: vaultWith([PNG]),
		});
		await settle();

		const image = backgroundImage(harness);

		expect(image).toBeDefined();
		// One source pixel is one world millimetre until slice 7 calibrates, so the node's
		// world size is the raster's own pixel count.
		expect({ width: image?.width(), height: image?.height() }).toEqual({ width: 400, height: 300 });
		expect({ x: image?.x(), y: image?.y() }).toEqual({ x: 0, y: 0 });
	});

	it('draws nothing on the background layer for a plan that has none', async () => {
		harness = await mountPlanEditor();

		expect(backgroundImage(harness)).toBeUndefined();
	});

	/**
	 * The background is the layer §18 says redraws rarely, and under the per-layer viewport
	 * transform that is true of the CONTENT: a zoom moves the layer node and leaves the
	 * image's own size and position alone.
	 */
	it('does not resize the raster when the camera zooms', async () => {
		registerResource(`app://fake/${PNG}`, pngFixture(400, 300));
		harness = await mountPlanEditor({
			plan: planWith({ path: PNG, kind: 'image' }),
			vault: vaultWith([PNG]),
		});
		await settle();
		const before = { width: backgroundImage(harness)?.width(), x: backgroundImage(harness)?.x() };

		harness.canvasEl?.dispatchEvent(
			new WheelEvent('wheel', { deltaY: -300, clientX: 400, clientY: 300, bubbles: true }),
		);
		await settle();

		expect({ width: backgroundImage(harness)?.width(), x: backgroundImage(harness)?.x() }).toEqual(before);
		expect(harness.stage?.findOne('.background')?.scaleX()).toBeGreaterThan(0.1);
	});
});

describe('a background that cannot be drawn', () => {
	it('tells the user when the file is gone, rather than drawing an empty canvas', async () => {
		harness = await mountPlanEditor({
			plan: planWith({ path: 'Plans/gone.png', kind: 'image' }),
			vault: vaultWith([]),
		});
		await settle();

		expect(harness.wrapper.find('.rp-editor-notice').text()).toBe(t('en', 'editor.background-missing'));
	});

	it('says something DIFFERENT when the file is there but will not decode', async () => {
		// Registered so the resource resolves and the DECODE is what fails — otherwise this
		// would be the missing-file case again under another name.
		registerResource(`app://fake/${PNG}`, new Uint8Array([1, 2, 3, 4]));
		harness = await mountPlanEditor({
			plan: planWith({ path: PNG, kind: 'image' }),
			vault: vaultWith([PNG]),
		});
		await settle();

		expect(harness.wrapper.find('.rp-editor-notice').text()).toBe(t('en', 'editor.background-failed'));
	});

	it('shows no notice at all for a plan with no background', async () => {
		harness = await mountPlanEditor();

		expect(harness.wrapper.find('.rp-editor-notice').exists()).toBe(false);
	});
});

/**
 * A load is asynchronous and a background reference can change while one is in flight — a
 * slice-7 calibration re-import, or simply a fast second `SetPlanBackground`. Without the
 * stamp the SLOWER load wins and the canvas shows the previous document, which looks like
 * the command silently failed.
 */
describe('two background loads racing', () => {
	it('keeps the newest reference, not the slowest load', async () => {
		// The first load is held open, so the second genuinely overlaps it — the only way to
		// be on the far side of the gap this guard exists for. Without the stamp, releasing
		// the slow decode below overwrites the fast one that already landed.
		registerResource('app://fake/Plans/slow.png', pngFixture(800, 600), { defer: true });
		registerResource('app://fake/Plans/fast.png', pngFixture(100, 100));

		let plan = planWith({ path: 'Plans/slow.png', kind: 'image' });
		harness = await mountPlanEditor({
			plan,
			vault: vaultWith(['Plans/slow.png', 'Plans/fast.png']),
			queries: {
				getPlan: () => Promise.resolve(ok(plan)),
			getRequirementsForZone: () => Promise.resolve(ok([])),
			listAssets: () => Promise.resolve(ok([])),
			// The two the contract requires and this fixture omitted until `tests/**` was
			// type-checked. A fixture thinner than its own annotation is the shape this
			// repository keeps recording: the view can reach these, and here they answered
			// `undefined`.
			listRequirementsReferencing: () => Promise.resolve(ok([])),
			listReassignmentTargets: () => Promise.resolve(ok([])),
				findZonesByPlan: () => Promise.resolve(ok({ zones: [], unreadable: 0 })),
			},
		});

		// Nothing drawn yet: the first decode is still held.
		expect(backgroundImage(harness)).toBeUndefined();

		plan = planWith({ path: 'Plans/fast.png', kind: 'image' });
		harness.changePlan();
		// Condition, not a fixed number of ticks: the decode behind `<img>` is a REAL one
		// (`tests/helpers/canvas.ts`), so how long it takes depends on the machine. A bare
		// `settle()` here failed once in a full-suite run and never in isolation.
		await settleUntil(() => backgroundImage(harness)?.width() === 100, 'the fast background to land');

		releaseResource('app://fake/Plans/slow.png');
		// The remaining assertion is that something did NOT happen, which no condition can
		// wait for — so the slow decode is given several rounds to land and win before being
		// asked whether it did.
		for (let round = 0; round < 5; round += 1) await settle();

		expect(backgroundImage(harness)?.width()).toBe(100);
	});
	/** Nothing in flight may land after the view is gone and write to a detached ref. */
	it('drops a load that finishes after the editor was closed', async () => {
		registerResource(`app://fake/${PNG}`, pngFixture(64, 64));
		const mounted = await mountPlanEditor({
			plan: planWith({ path: PNG, kind: 'image' }),
			vault: vaultWith([PNG]),
		});

		mounted.unmount();
		await settle();

		// Nothing to assert on the model — it is gone with the component. What is asserted is
		// that the late resolution neither threw nor resurrected a stage.
		expect(Konva.stages).toHaveLength(0);
	});
});
