/**
 * @vitest-environment jsdom
 *
 * The asset designer DRAWS the spec sheet Task B7 taught it to store.
 *
 * **This file exists because the increment shipped without it.** Task B4 built the background
 * layer empty and said why — `AssetDesignDto` carried no background reference yet. Task B7
 * added the field, the three frontmatter keys, the mapper, the port, the picker and the
 * composition binding, and named no canvas. Each task did what it was told; nothing drew. Every
 * gate was green throughout, because nothing was wrong with the code — the same shape as the
 * slice-7 tool registered in no list, and `regionsReachable.test.ts` could not see it either,
 * since the layer module WAS imported and the component WAS mounted.
 *
 * So the assertions here are deliberately about the SCENE (a Konva `Image` node with a world
 * size) and about the SHELL (a notice naming which of the two failures happened), never about
 * a prop this codebase passed. A case that read back `DesignerCanvas`'s own `:reference` would
 * have passed against the layer that drew nothing.
 *
 * The pipeline itself is the plan editor's — `loadBackground`, `BackgroundRenderModel`,
 * `pdfRaster` — and is covered by `tests/presentation/editor/background.test.ts` per format
 * and by `backgroundInEditor.test.ts` per surface. What is NOT covered there and is covered
 * here is that the second surface mounts it, feeds it the second entity's own reference type,
 * and has somewhere to put the two failures.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import VueKonva from 'vue-konva';
import Konva from 'konva';
import { TFile } from 'obsidian';
import AssetDesignerRoot from '../../../src/presentation/designer/AssetDesignerRoot.vue';
import {
	ASSET_DESIGNER_CONTEXT,
	type AssetDesignerContext,
} from '../../../src/presentation/designer/AssetDesignerContext';
import { unavailableAssetDesignerCommands } from '../../../src/presentation/designer/designerCommands';
import type { AssetDesignDto } from '../../../src/application/queries/GetAssetDesign';
import type { BackgroundVault } from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';
import { ok } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { emptyBackgroundVault } from '../../helpers/background';
import { pngFixture } from '../../helpers/backgroundFixtures';
import { clearResources, installCanvas, registerResource } from '../../helpers/canvas';
import { installObsidianDom } from '../../helpers/dom';
import { installResizeObserver, placeAt, resizeTo } from '../../helpers/layout';
import { recorder } from '../../helpers/logger';
import { settle, settleUntil } from '../../helpers/editor';

installObsidianDom();
installCanvas();
installResizeObserver();

const SHEET = 'Specs/oven.png';

/**
 * A vault holding exactly the named paths, answering the `app://` URL the real one does.
 *
 * `backgroundInEditor.test.ts`'s own `vaultWith`, restated rather than shared: that file's
 * copy is a Plan Editor fixture and this one is an Asset Designer fixture, and the moment
 * either grows a second file or a different URL scheme they are two fixtures anyway. What
 * IS shared is the thing under them — `emptyBackgroundVault` for the null case, and the
 * production `loadBackground` both surfaces reach.
 */
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

function context(design: AssetDesignDto, vault: BackgroundVault): AssetDesignerContext {
	return {
		assetId: String(design.assetId),
		queries: { getAssetDesign: () => Promise.resolve(ok(design)) },
		commands: unavailableAssetDesignerCommands(),
		logger: recorder,
		picker: null,
		vault,
		onDesignChanged: () => () => undefined,
		onThemeChange: () => () => undefined,
		indexScanCompleted: () => true,
	};
}

interface Mounted {
	readonly wrapper: ReturnType<typeof mount>;
	readonly stage: Konva.Stage | null;
	readonly unmount: () => void;
}

let mounted: Mounted | null = null;

async function mountDesigner(design: AssetDesignDto, vault: BackgroundVault): Promise<Mounted> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const wrapper = mount(AssetDesignerRoot, {
		attachTo: host,
		global: {
			plugins: [createPinia(), VueKonva],
			provide: { [ASSET_DESIGNER_CONTEXT as symbol]: context(design, vault) },
		},
	});
	await flushPromises();

	const canvas = wrapper.find('.rp-designer-canvas .rp-plan-canvas');
	// jsdom lays nothing out, so the stage would be 0x0 and the scene could not have drawn.
	if (canvas.exists()) {
		placeAt(canvas.element as HTMLElement, 0, 0, 800, 600);
		resizeTo(canvas.element as HTMLElement, 800, 600);
	}
	// `settle()` and not one tick: the decode behind `<img>` is `@napi-rs/canvas` doing real
	// work, and `flushPromises` above resolves before it.
	await settle();
	// `Konva.stages` is process-global, so the last entry is this mount's only because the
	// previous one was unmounted in `afterEach`.
	const stage = canvas.exists() ? (Konva.stages.at(-1) as Konva.Stage) : null;
	mounted = {
		wrapper,
		stage,
		unmount: () => {
			wrapper.unmount();
			host.remove();
		},
	};
	return mounted;
}

/** The Konva image node on the designer's own background layer, if the layer has one. */
function sheetImage(designer: Mounted): Konva.Image | undefined {
	return designer.stage?.findOne<Konva.Layer>('.asset-background')?.findOne<Konva.Image>('Image') ?? undefined;
}

/**
 * The raster, once it is really there — `settleUntil` and not `settle()`, which is a FIXED
 * four microtasks and one macrotask.
 *
 * Measured rather than anticipated: with `settle()` alone this file's first case passed in
 * isolation and failed inside the full `--coverage` run, where `@napi-rs/canvas` is decoding
 * beside 334 other files. That is the exact flake `settleUntil`'s own docblock records for the
 * plan editor's background, arriving on the second surface for the same reason.
 */
async function drawnSheet(designer: Mounted): Promise<Konva.Image> {
	await settleUntil(() => sheetImage(designer) !== undefined, 'the spec sheet to be drawn');
	return sheetImage(designer) as Konva.Image;
}

function notices(designer: Mounted): string[] {
	return designer.wrapper.findAll('.rp-designer-notice').map((node) => node.text());
}

/**
 * The notice, once the load has answered. `settleUntil` for `drawnSheet`'s reason: the decode
 * that FAILS is the same real work as the decode that succeeds, so a fixed tick count reads
 * the shell one beat before it has been told anything.
 */
async function shownNotice(designer: Mounted): Promise<string[]> {
	await settleUntil(() => notices(designer).length > 0, 'the background notice to appear');
	return notices(designer);
}

beforeEach(() => {
	clearResources();
});

afterEach(() => {
	mounted?.unmount();
	mounted = null;
});

describe('an asset with a spec sheet', () => {
	it('draws the sheet on the background layer, at the world size its placeholder scale implies', async () => {
		registerResource(`app://fake/${SHEET}`, pngFixture(400, 300));
		const designer = await mountDesigner(
			assetDesign({ background: { path: SHEET, kind: 'image', page: null } }),
			vaultWith([SHEET]),
		);

		const image = await drawnSheet(designer);

		// One source pixel is one world millimetre until a calibration says otherwise; the
		// calibrated case below is the one where the sheet grows with what was traced on it.
		expect({ width: image.width(), height: image.height() }).toEqual({ width: 400, height: 300 });
		expect({ x: image.x(), y: image.y() }).toEqual({ x: 0, y: 0 });
	});

	it('draws the sheet at the CALIBRATED scale, so a rescaled trace still sits on it', async () => {
		registerResource(`app://fake/${SHEET}`, pngFixture(400, 300));
		const designer = await mountDesigner(
			assetDesign({
				background: { path: SHEET, kind: 'image', page: null },
				// 0.5 source pixels per world millimetre: the user said a 400-unit bar was 800 mm.
				calibration: {
					pointA: { x: 0, y: 0 },
					pointB: { x: 800, y: 0 },
					knownDistance: 800,
					pixelsPerWorldUnit: 0.5,
				},
			}),
			vaultWith([SHEET]),
		);
		const image = await drawnSheet(designer);
		expect({ width: image.width(), height: image.height() }).toEqual({ width: 800, height: 600 });
		expect({ x: image.x(), y: image.y() }).toEqual({ x: 0, y: 0 });
	});

	/**
	 * The layer is BENEATH the three that draw the object, which is the order Task B4 reserved
	 * and the only order in which a traced outline is visible over the sheet it was traced on.
	 * Asserted with a raster actually present, because the order case in `layers.test.ts` reads
	 * an empty layer and would pass for a layer that can never hold anything.
	 */
	it('draws the sheet beneath the footprint, the clearance and the anchor', async () => {
		registerResource(`app://fake/${SHEET}`, pngFixture(400, 300));
		const designer = await mountDesigner(
			assetDesign({ background: { path: SHEET, kind: 'image', page: null } }),
			vaultWith([SHEET]),
		);

		await drawnSheet(designer);

		expect(designer.stage?.getLayers().map((layer) => layer.name())).toEqual([
			'asset-background',
			'asset-footprint',
			'asset-clearance',
			'asset-anchor',
			'asset-gesture',
		]);
	});

	it('draws nothing on that layer for an asset that has no sheet', async () => {
		const designer = await mountDesigner(assetDesign({ background: null }), emptyBackgroundVault());

		expect(sheetImage(designer)).toBeUndefined();
		expect(notices(designer)).toEqual([]);
	});
});

/**
 * A reference whose file cannot be drawn says so, and the empty state cannot say it for us:
 * `selectAssetDesignerEmptyState` retires `noBackground` the moment a reference EXISTS,
 * whatever became of the file it names. Without these the user is invited to trace an outline
 * over a blank canvas with nothing anywhere explaining the absence.
 */
describe('a spec sheet that cannot be drawn', () => {
	it('tells the user when the file is gone, rather than drawing an empty canvas', async () => {
		const designer = await mountDesigner(
			assetDesign({ background: { path: 'Specs/gone.png', kind: 'image', page: null } }),
			vaultWith([]),
		);

		expect(await shownNotice(designer)).toEqual([t('en', 'designer.background-missing')]);
	});

	it('says something DIFFERENT when the file is there but will not decode', async () => {
		// Registered so the resource RESOLVES and the decode is what fails — otherwise this
		// would be the missing-file case again under another name.
		registerResource(`app://fake/${SHEET}`, new Uint8Array([1, 2, 3, 4]));
		const designer = await mountDesigner(
			assetDesign({ background: { path: SHEET, kind: 'image', page: null } }),
			vaultWith([SHEET]),
		);

		expect(await shownNotice(designer)).toEqual([t('en', 'designer.background-failed')]);
	});
});
