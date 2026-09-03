import { createAssetId } from '../../src/domain/asset/AssetId';
import { AssetDesignerView } from '../../src/presentation/designer/AssetDesignerView';
import type { AssetDesignerDeps } from '../../src/presentation/designer/AssetDesignerContext';
import type { AssetDesignDto } from '../../src/application/queries/GetAssetDesign';
import { unavailableAssetDesignerCommands } from '../../src/presentation/designer/designerCommands';
import type { BackgroundPicker } from '../../src/presentation/designer/ports';
import type { BackgroundVault } from '../../src/presentation/editor/layers/background/BackgroundRenderModel';
import type { Logger } from '../../src/application/ports/Logger';
import type { ObservationToken } from '../../src/application/ports/versioning';
import { ok } from '../../src/core/result/Result';
import { installObsidianDom } from '../helpers/dom';
import { FakeLeaf } from '../helpers/workspace';

/**
 * The REAL Asset Designer, mounted outside Obsidian for LOOKING at — `npm run harness`
 * with `?view=asset-designer`, and Task B10's own axe scan, which mounts through this exact
 * function so a screenshot and a semantics check agree on what "the mounted designer" means.
 * `planEditor.ts`'s shape for the plugin's third workspace view.
 *
 * **No shape and no background**, which is `selectAssetDesignerEmptyState`'s `noBackground`
 * entry — the empty state this task exists to grade — and the picker is BOUND rather than
 * `null`: `AssetDesignerRoot`'s overlay withholds `noBackground`'s action label whenever
 * `context.picker === null` (slice 14's Amendment 1 — a live control that does nothing must
 * not render), so a `null` picker here would photograph and scan a buttonless nag rather than
 * the button-carrying state Task B10's own axe case has to prove present. Nothing on this page
 * ever presses it; `pick()` answering `null` (a cancelled pick) is the honest inert answer.
 *
 * Every WRITE refuses with `settings.unrecovered`, the same honest stand-in `planEditor.ts`'s
 * `harnessDeps` uses — the buttons render and a gesture fails like any other failed write
 * rather than pretending to persist against a vault this page does not have.
 */

// Module-private: unlike `planEditor.ts`'s `HARNESS_PLAN`/`HARNESS_ZONES`/`harnessDeps`, nothing
// outside this file needs these three individually yet — there is no `fixture.ts`-style
// per-component mount of the designer's own world to hand them to. `mountAssetDesignerHarness`
// is the one door out; export the rest again the day a second caller needs one.
const HARNESS_ASSET_ID = createAssetId();

const HARNESS_VERSION = { revision: 1, observed: 'harness-asset-design' as ObservationToken };

const HARNESS_ASSET_DESIGN: AssetDesignDto = {
	assetId: HARNESS_ASSET_ID,
	name: 'Kitchen island',
	height: null,
	background: null,
	calibration: null,
	shape: null,
	dimensions: null,
	clearanceExtent: null,
	dimensionsUnscaled: false,
	noteVersion: HARNESS_VERSION,
	geometryVersion: HARNESS_VERSION,
};

/** Never resolves to a real reference — see the header for why `null` is the honest answer. */
const inertPicker: BackgroundPicker = {
	pick: () => Promise.resolve(null),
};

const inertLogger: Logger = {
	debug: () => undefined,
	info: () => undefined,
	warn: () => undefined,
	error: () => undefined,
};

function assetDesignerHarnessDeps(): AssetDesignerDeps {
	return {
		// A fresh DTO per call, not the constant — `planEditor.ts`'s `getPlan` carries the same
		// rule: the real query builds its DTO from a note it just read, and handing back the
		// module object would let a mutation through Pinia's reactive state edit the fixture.
		queries: { getAssetDesign: () => Promise.resolve(ok(structuredClone(HARNESS_ASSET_DESIGN))) },
		commands: unavailableAssetDesignerCommands(),
		logger: inertLogger,
		picker: inertPicker,
		// A vault with nothing in it, which is the honest stand-in rather than a thin one: the
		// fixture's `background` is `null`, so `loadBackground` never reaches a member of this.
		// `planEditor.ts`'s own harness vault is the same three inert answers for the same
		// reason. The day this page fixtures a real sheet, this is what has to grow one.
		vault: {
			getAbstractFileByPath: () => null,
			getResourcePath: () => '',
			readBinary: () => Promise.resolve(new ArrayBuffer(0)),
		} as unknown as BackgroundVault,
		// The harness holds a fixed fixture and publishes no domain events; both change doors on
		// the Plan Editor's harness page are inert for the identical reason.
		indexScanCompleted: () => true,
		onDesignChanged: () => () => undefined,
		// No theme switching in the harness page: the palette it resolves at setup is the one it
		// keeps. A source that never fires, rather than one omitted, because the member is
		// required precisely so no surface can forget to answer the question.
		onThemeChange: () => () => undefined,
		// And no file events either: the harness draws a fixed fixture in a page with no Obsidian
		// and therefore no vault to fire them. The `background` in that fixture is `null`, so the
		// layer this feeds has nothing to reload. Present rather than omitted, for the reason the
		// theme door above gives.
		onVaultFileChanged: () => () => undefined,
	};
}

export interface MountedAssetDesigner {
	leafEl: HTMLElement;
	view: AssetDesignerView;
}

export function mountAssetDesignerHarness(root: HTMLElement): MountedAssetDesigner {
	// Obsidian's DOM prototype extensions. Installed first, because the mount below uses them.
	installObsidianDom();
	root.empty();

	const leafEl = root.createDiv('rp-harness-leaf');
	const view = new AssetDesignerView(new FakeLeaf() as never, assetDesignerHarnessDeps());
	leafEl.appendChild(view.containerEl);

	// State first, then open — the restored-leaf order `mountPlanEditorHarness` uses. `void`
	// rather than awaited: the page entry cannot await, and both do their work synchronously
	// before resolving.
	void view.setState({ assetId: HARNESS_ASSET_ID }, {} as never);
	void view.onOpen();

	return { leafEl, view };
}
