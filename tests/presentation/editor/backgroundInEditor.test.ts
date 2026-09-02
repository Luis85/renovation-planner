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

/**
 * A vault whose one file reports a stat the CALLER still owns, so a case can move `mtime` and
 * `size` under a mounted layer. `vaultWith` above cannot: its `TFile` carries whatever `TFile`
 * defaults to, which never changes.
 */
function statVault(statOf: () => { ctime: number; mtime: number; size: number }): BackgroundVault {
	return {
		getAbstractFileByPath(path: string) {
			if (path !== PNG) return null;
			const file = new TFile();
			file.path = path;
			file.stat = { ...statOf() };
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
		// One source pixel is one world millimetre for an uncalibrated plan; the calibrated
		// case below is where the raster follows what slice 7 rescaled.
		expect({ width: image?.width(), height: image?.height() }).toEqual({ width: 400, height: 300 });
		expect({ x: image?.x(), y: image?.y() }).toEqual({ x: 0, y: 0 });
	});

	it('draws the raster at the CALIBRATED scale, so the zones traced on it stay over it', async () => {
		registerResource(`app://fake/${PNG}`, pngFixture(400, 300));
		harness = await mountPlanEditor({
			plan: {
				...planWith({ path: PNG, kind: 'image' }),
				calibration: {
					pointA: { x: 0, y: 0 },
					pointB: { x: 800, y: 0 },
					knownDistance: 800,
					pixelsPerWorldUnit: 0.5,
				},
			},
			vault: vaultWith([PNG]),
		});
		await settle();
		const image = backgroundImage(harness);
		expect({ width: image?.width(), height: image?.height() }).toEqual({ width: 800, height: 600 });
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
	/**
	 * A rehydrate is not a new document, and the watch is what has to know the difference.
	 *
	 * Every successful command re-reads its subject, and both mappers MINT the background
	 * object — so a plan or an asset whose sheet has not moved still arrives as a fresh
	 * reference with identical fields. Watching identity therefore re-loaded on every
	 * unrelated edit: a footprint, an anchor, a facing, a height, a calibration. For an image
	 * it is a redundant decode; for a PDF it is `readBinary` plus a full page rasterization,
	 * per save, of a document that did not change.
	 *
	 * Counted at the VAULT rather than at the drawn node, because the redundant load produces
	 * a byte-identical picture — `backgroundImage(...)` reads the same either way, which is
	 * exactly why nothing caught this.
	 *
	 * **`getResourcePath` and not `getAbstractFileByPath`**, which the first version counted and
	 * which stopped discriminating the moment the key learned to read the file's `mtime:size`:
	 * the key itself now looks the file up on every rehydrate, so that counter answers "the key
	 * was recomputed" as well as "a load ran". `getResourcePath` is reached only from
	 * `loadBackground`, so it counts the thing this case is about.
	 */
	it('does not reload an unchanged sheet when the subject is rehydrated', async () => {
		registerResource(`app://fake/${PNG}`, pngFixture(64, 64));
		let loads = 0;
		const real = vaultWith([PNG]);
		const counting = {
			...real,
			getAbstractFileByPath: (path: string) => real.getAbstractFileByPath(path),
			getResourcePath(file: { path: string }) {
				loads += 1;
				return real.getResourcePath(file as never);
			},
		} as unknown as BackgroundVault;

		let plan = planWith({ path: PNG, kind: 'image' });
		harness = await mountPlanEditor({
			plan,
			vault: counting,
			queries: {
				getPlan: () => Promise.resolve(ok(plan)),
				getRequirementsForZone: () => Promise.resolve(ok([])),
				listAssets: () => Promise.resolve(ok([])),
				listRequirementsReferencing: () => Promise.resolve(ok([])),
				listReassignmentTargets: () => Promise.resolve(ok([])),
				findZonesByPlan: () => Promise.resolve(ok({ zones: [], unreadable: 0 })),
			},
		});
		await settleUntil(() => backgroundImage(harness) !== undefined, 'the background to land');
		const afterMount = loads;

		// The same sheet, a different object — what a mapper hands back after any edit.
		plan = planWith({ path: PNG, kind: 'image' });
		harness.changePlan();
		for (let round = 0; round < 5; round += 1) await settle();

		expect(loads).toBe(afterMount);
		// ...and the picture is still there, so "no reload" is not "no background".
		expect(backgroundImage(harness)).toBeDefined();
	});

	/** The other direction, so the key is not simply ignoring changes. */
	it('does reload when the sheet itself changes', async () => {
		registerResource(`app://fake/${PNG}`, pngFixture(64, 64));
		registerResource('app://fake/Plans/other.png', pngFixture(120, 120));

		let plan = planWith({ path: PNG, kind: 'image' });
		harness = await mountPlanEditor({
			plan,
			vault: vaultWith([PNG, 'Plans/other.png']),
			queries: {
				getPlan: () => Promise.resolve(ok(plan)),
				getRequirementsForZone: () => Promise.resolve(ok([])),
				listAssets: () => Promise.resolve(ok([])),
				listRequirementsReferencing: () => Promise.resolve(ok([])),
				listReassignmentTargets: () => Promise.resolve(ok([])),
				findZonesByPlan: () => Promise.resolve(ok({ zones: [], unreadable: 0 })),
			},
		});
		await settleUntil(() => backgroundImage(harness)?.width() === 64, 'the first sheet');

		plan = planWith({ path: 'Plans/other.png', kind: 'image' });
		harness.changePlan();

		// The wait is the discriminator and the `expect` is what makes that visible — a
		// `settleUntil` alone throws on timeout, which is a real failure and reads to both a
		// human and `expect-expect` as a case that asserts nothing.
		await settleUntil(() => backgroundImage(harness)?.width() === 120, 'the second sheet');
		expect(backgroundImage(harness)?.width()).toBe(120);
	});

	/**
	 * The other side of watching a KEY, reported the moment the key shipped: a reference whose
	 * three fields have not moved is not the same thing as a FILE that has not moved. Replace
	 * the PNG at that path — or delete it — and `{kind, page, path}` is unchanged, so a watch
	 * over those three alone would keep the decoded raster on screen and never emit `missing`.
	 *
	 * Watching identity used to repair this BY ACCIDENT, and only sometimes: a rehydrate minted
	 * a new object, so the next unrelated command re-decoded and picked the change up. The key
	 * fixed the redundant decode and took the accident with it, which is a fair description of
	 * how a fix earns its own follow-up.
	 *
	 * So the key carries the file's `mtime:size` too. It is read through
	 * `getAbstractFileByPath`, already on `BackgroundVault`, so nothing widens — and being a
	 * `computed` over `props.reference`, it is re-evaluated exactly when a rehydrate happens.
	 * That is strictly more than identity bought: a changed file reloads, an unchanged one does
	 * not.
	 *
	 * **What it did not cover, and the case below is what closes it:** a file changing while the
	 * surface sits idle. The key is a `computed` over `props.reference`, so a rehydrate is the
	 * only thing that ever re-evaluated it — this case supplies one. `onVaultFileChanged` is the
	 * door that supplies the other.
	 */
	it('reloads a sheet whose bytes changed under an unchanged reference', async () => {
		registerResource(`app://fake/${PNG}`, pngFixture(64, 64));
		const stat = { ctime: 1, mtime: 1, size: 10 };
		const vault = {
			getAbstractFileByPath(path: string) {
				if (path !== PNG) return null;
				const file = new TFile();
				file.path = path;
				file.stat = { ...stat };
				return file;
			},
			getResourcePath: (file: { path: string }) => `app://fake/${file.path}`,
			readBinary: () => Promise.resolve(new ArrayBuffer(0)),
		} as unknown as BackgroundVault;

		let plan = planWith({ path: PNG, kind: 'image' });
		harness = await mountPlanEditor({
			plan,
			vault,
			queries: {
				getPlan: () => Promise.resolve(ok(plan)),
				getRequirementsForZone: () => Promise.resolve(ok([])),
				listAssets: () => Promise.resolve(ok([])),
				listRequirementsReferencing: () => Promise.resolve(ok([])),
				listReassignmentTargets: () => Promise.resolve(ok([])),
				findZonesByPlan: () => Promise.resolve(ok({ zones: [], unreadable: 0 })),
			},
		});
		await settleUntil(() => backgroundImage(harness)?.width() === 64, 'the first bytes');

		// The user replaces the file: same path, same reference, different content.
		registerResource(`app://fake/${PNG}`, pngFixture(150, 150));
		stat.mtime = 2;
		stat.size = 4096;
		plan = planWith({ path: PNG, kind: 'image' });
		harness.changePlan();

		await settleUntil(() => backgroundImage(harness)?.width() === 150, 'the replaced bytes');
		expect(backgroundImage(harness)?.width()).toBe(150);
	});

	/**
	 * The residual the case above disclosed, closed: the sheet is replaced with NO rehydrate at
	 * all, and the layer notices because a vault event named its file.
	 *
	 * This is the half no document key could reach. `mtime:size` in the key is what makes a
	 * changed file DIFFERENT; it says nothing about when anybody looks. A `computed` over
	 * `props.reference` is re-evaluated when a new reference is minted, which happens on a
	 * rehydrate — so a user who replaced the PNG under an open plan and touched nothing else went
	 * on seeing the old raster, and a user who DELETED it never saw `missing`. Reported on PR 43,
	 * against the very key that had disclosed it.
	 *
	 * The distinction from the case above is `changeFile` versus `changePlan`, and the rig keeps
	 * them as two doors precisely so this case cannot pass through the other one's mechanism.
	 */
	it('reloads a sheet replaced while the surface sat idle, with no rehydrate', async () => {
		registerResource(`app://fake/${PNG}`, pngFixture(64, 64));
		const stat = { ctime: 1, mtime: 1, size: 10 };
		harness = await mountPlanEditor({
			plan: planWith({ path: PNG, kind: 'image' }),
			vault: statVault(() => stat),
		});
		await settleUntil(() => backgroundImage(harness)?.width() === 64, 'the first bytes');

		// The user replaces the file in the file explorer. Nothing re-reads the plan.
		registerResource(`app://fake/${PNG}`, pngFixture(150, 150));
		stat.mtime = 2;
		stat.size = 4096;
		harness.changeFile(PNG);

		await settleUntil(() => backgroundImage(harness)?.width() === 150, 'the replaced bytes');
		expect(backgroundImage(harness)?.width()).toBe(150);
	});

	/**
	 * The DELETE half, which is the one with a user-visible status rather than a different
	 * picture: the raster goes and the layer emits `missing`. Asserted separately because the
	 * replace case above passes against a build that reloads and finds the same file.
	 */
	it('drops the raster when the sheet is deleted while the surface sat idle', async () => {
		registerResource(`app://fake/${PNG}`, pngFixture(64, 64));
		let present = true;
		const vault = {
			getAbstractFileByPath(path: string) {
				if (path !== PNG || !present) return null;
				const file = new TFile();
				file.path = path;
				file.stat = { ctime: 1, mtime: 1, size: 10 };
				return file;
			},
			getResourcePath: (file: { path: string }) => `app://fake/${file.path}`,
			readBinary: () => Promise.resolve(new ArrayBuffer(0)),
		} as unknown as BackgroundVault;
		harness = await mountPlanEditor({ plan: planWith({ path: PNG, kind: 'image' }), vault });
		await settleUntil(() => backgroundImage(harness) !== undefined, 'the first bytes');

		present = false;
		harness.changeFile(PNG);

		await settleUntil(() => backgroundImage(harness) === undefined, 'the raster to go');
		expect(harness.wrapper.text()).toContain(t('en', 'editor.background-missing'));
	});

	/**
	 * The contrast case, and it is what stops the fix being "reload on every vault event". Every
	 * note this plugin writes fires `modify`, so a layer that reloaded unconditionally would
	 * re-decode its sheet — or re-rasterize a PDF page — on every zone the user draws.
	 */
	it('ignores a vault event that names a different file', async () => {
		registerResource(`app://fake/${PNG}`, pngFixture(64, 64));
		const stat = { ctime: 1, mtime: 1, size: 10 };
		harness = await mountPlanEditor({
			plan: planWith({ path: PNG, kind: 'image' }),
			vault: statVault(() => stat),
		});
		await settleUntil(() => backgroundImage(harness)?.width() === 64, 'the first bytes');

		// The bytes AND the stat move, so a reload would be visible; the event names another file.
		registerResource(`app://fake/${PNG}`, pngFixture(150, 150));
		stat.mtime = 2;
		stat.size = 4096;
		harness.changeFile('Zones/kitchen.md');
		await settle();

		expect(backgroundImage(harness)?.width()).toBe(64);
	});

	/**
	 * The subscription is disposed with the component. A vault listener outlives its element,
	 * and one left registered re-decodes a raster into a detached ref on every file the user
	 * ever touches — one more per plan editor they have opened this session. `onThemeChange`'s
	 * own leak check is the same shape.
	 */
	it('releases its vault-file subscription on unmount', async () => {
		const mounted = await mountPlanEditor({
			plan: planWith({ path: PNG, kind: 'image' }),
			vault: vaultWith([PNG]),
		});
		expect(mounted.fileListeners()).toBe(1);

		mounted.unmount();
		await settle();

		expect(mounted.fileListeners()).toBe(0);
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
