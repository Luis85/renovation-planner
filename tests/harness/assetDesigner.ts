import { createAssetId } from '../../src/domain/asset/AssetId';
import { createPlanId } from '../../src/domain/plan/PlanId';
import { createProjectId } from '../../src/domain/project/ProjectId';
import { dimensionsOf, type AssetShape } from '../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../src/domain/asset/presets/presetGeometry';
import { AssetDesignerView } from '../../src/presentation/designer/AssetDesignerView';
import type { AssetDesignerDeps } from '../../src/presentation/designer/AssetDesignerContext';
import type { AssetDesignDto } from '../../src/application/queries/GetAssetDesign';
import { unavailableAssetDesignerCommands } from '../../src/presentation/designer/designerCommands';
import type { BackgroundPicker } from '../../src/presentation/designer/ports';
import type { BackgroundVault } from '../../src/presentation/editor/layers/background/BackgroundRenderModel';
import type { Logger } from '../../src/application/ports/Logger';
import type { ObservationToken } from '../../src/application/ports/versioning';
import type { App } from 'vue';
import { ok } from '../../src/core/result/Result';
import { tr } from '../../src/presentation/i18n/strings';
import type { StringKey } from '../../src/presentation/i18n/locales/en';
import { useAssetDesignStore } from '../../src/presentation/designer/stores/assetDesignStore';
import { DESIGNER_TOOL_LABELS } from '../../src/presentation/designer/tools/registerDesignerTools';
import { useEditorStore } from '../../src/presentation/stores/EditorStore';
import { DEFAULT_VIEWPORT } from '../../src/presentation/editor/viewport/Viewport';
import type { DesignerSelection, SelectionMode } from '../../src/presentation/designer/selection/designerSelection';
import { installObsidianDom } from '../helpers/dom';
import { accessibleName } from '../helpers/accessibleName';
// `../helpers/settle` and not `../helpers/editor`, for the reason `itemKnob.ts` gives: this reaches a real browser.
import { settleUntil } from '../helpers/settle';
import { FakeLeaf } from '../helpers/workspace';
import { useWorkspaceStore } from '../../src/presentation/stores/WorkspaceStore';
import { pointer } from './itemKnob';

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
	category: 'furniture',
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

/**
 * The state an uncalibrated spec sheet leaves: a TRACED footprint and every detail, the clearance and the
 * anchor awaiting a scale — `validateAssetShape` refuses a typed footprint marked pending, so the origin
 * moves with the flag.
 */
function awaitingScale(shape: AssetShape): AssetShape {
	return {
		...shape,
		footprintOrigin: 'traced',
		footprintPending: true,
		clearancePending: shape.clearance !== null,
		anchorPending: true,
		details: shape.details.map((detail) => ({ ...detail, pending: true })),
	};
}

/**
 * `?preset=<id>` seeds the fixture with that preset at its defaults, so a capture draws curves and
 * details instead of the empty state (asset designer symbols spec, Testing). An unknown id is the
 * shapeless fixture.
 *
 * `&pending` seeds `awaitingScale`'s version of it, so the inspector's unscaled warnings can be
 * photographed. The SHEET itself is not drawn: this page has no vault and refuses a background document
 * (`planEditor.ts`'s header, §55), so the canvas is blank behind the design. `dimensionsUnscaled` follows
 * the footprint's flag exactly as `GetAssetDesign` derives it.
 */
function designFor(presetId: string | null, pending: boolean): AssetDesignDto {
	const preset = ASSET_PRESETS.find((item) => item.id === presetId);
	if (preset === undefined) return HARNESS_ASSET_DESIGN;
	const built = preset.build(defaultValues(preset));
	if (!built.ok) return HARNESS_ASSET_DESIGN;
	const shape = pending ? awaitingScale(built.value) : built.value;
	const measured = dimensionsOf(shape.footprint);
	return { ...HARNESS_ASSET_DESIGN, shape, dimensions: measured.ok ? measured.value : null, dimensionsUnscaled: shape.footprintPending };
}

function assetDesignerHarnessDeps(presetId: string | null, pending: boolean): AssetDesignerDeps {
	return {
		// A fresh DTO per call, not the constant — `planEditor.ts`'s `getPlan` carries the same
		// rule: the real query builds its DTO from a note it just read, and handing back the
		// module object would let a mutation through Pinia's reactive state edit the fixture.
		queries: {
			getAssetDesign: () => Promise.resolve(ok(structuredClone(designFor(presetId, pending)))),
			// A POPULATED scope rather than a refusal (AD13-R1), because this page exists to be
			// looked at: the state worth photographing is the one a user meets — two plans and a
			// placement count — and the refusal line is a sentence any capture of the library's
			// own panel already shows. Two plans and not one, so the capture measures a LIST's
			// spacing rather than a single row's.
			listPlansUsingAsset: () =>
				Promise.resolve(
					ok({
						plans: [
							{
								planId: createPlanId(),
								planName: 'Ground floor',
								projectId: createProjectId(),
								projectName: 'Flat renovation',
								placements: 2,
							},
							{
								planId: createPlanId(),
								planName: 'Loft conversion',
								projectId: createProjectId(),
								projectName: 'Garden studio',
								placements: 1,
							},
						],
						unreadable: 0,
					}),
				),
		},
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

/** `&select=` spells a part as `partKey` does, minus the `detail:` prefix a URL has no need for. */
function harnessSelection(select: string): DesignerSelection {
	return select === 'footprint' || select === 'clearance' || select === 'anchor' || select === 'facing'
		? { kind: select }
		: { kind: 'detail', id: select };
}

/** The draw tools `&draw=` can hold mid-gesture. */
const DRAW_KNOB_TOOLS = ['draw-rect', 'draw-circle', 'trace-detail'] as const;

/** A box and a circle, each pressed and moved at fractions of the canvas box and never released. */
const HELD_DRAGS = {
	'draw-rect': [[0.4, 0.38], [0.6, 0.62]],
	'draw-circle': [[0.5, 0.5], [0.58, 0.5]],
} as const;

/** Three clicks and no closing one: an open outline, which writes nothing until it is closed. */
const TRACED_VERTICES = [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6]] as const;

/**
 * Presses the REAL tool button with that label, in whatever language `?lang=` set.
 *
 * BOTH homes, exactly as `designerRig`'s `toolbarButton` resolves: AD18-R3 moved the four drawing
 * tools into the `Add` rail, and `&draw=` names two of them (`draw-rect`, `draw-circle`). A
 * selector naming the toolbar alone would have left every draw capture photographing a designer
 * with no gesture.
 *
 * **And a button this cannot find is REFUSED, loudly, rather than skipped** — which is the half
 * that made the selector hazard dangerous in the first place. `?.click()` answered a miss by doing
 * nothing, so `harness-shot` would have written `asset-designer-draw-rect.png` showing an idle
 * canvas and exited 0, with the picture then read as evidence about a gesture nobody performed.
 * That is a fake kinder than the real thing, and `drawInHarness` immediately below already refuses
 * an unknown `&draw=` value for the identical reason in its own words — this repository was
 * testing the loud refusal one level up and permitting silence one level down, one function apart.
 *
 * `console.error` rather than a throw, matching that function: `harness-shot` records a console
 * error as a failure, and a throw here would take down the whole page render instead of the one
 * capture. `designerRig.toolbarButton` throws because a suite has somewhere to put a stack trace.
 *
 * **Matched by ACCESSIBLE NAME (`../helpers/accessibleName`), not raw `textContent`, since a
 * regression this same fix round found.** `textContent === tr(label)` was correct only because
 * text and `aria-label` always agreed — true until Task 3 (AD18-R16) gave the Add rail's tile a
 * VISIBLE label shorter than its accessible name (`DesignerToolButton`'s `visibleLabel`), which
 * left `&draw=draw-rect`/`&draw=draw-circle` unable to find their own button and silently landing
 * `editor.activeToolId: null` — `assetDesignerSelectKnob.test.ts` caught it. `designerRig.ts`'s
 * `toolbarButton` broke identically for the same reason, so the fix is the shared module rather
 * than a second copy of the rule here.
 */
function pressTool(view: AssetDesignerView, label: StringKey): void {
	const found = Array.from(view.contentEl.querySelectorAll<HTMLButtonElement>('.rp-designer-tools button, .rp-designer-add button')).find(
		(candidate) => accessibleName(candidate) === tr(label),
	);
	if (found === undefined) {
		console.error(`no designer tool button labelled "${tr(label)}" in the toolbar or the Add rail`);
		return;
	}
	found.click();
}

/**
 * `&draw=<tool>` presses that tool and leaves its gesture UNFINISHED, so a capture shows the preview a user
 * steers by. The pointers are `itemKnob.ts`'s. An unknown tool is refused on the console — which
 * `harness-shot` records as a failure — rather than photographing a designer with no gesture under a draw
 * shot's name.
 */
function drawInHarness(view: AssetDesignerView, canvas: HTMLElement, draw: string): void {
	const tool = DRAW_KNOB_TOOLS.find((candidate) => candidate === draw);
	if (tool === undefined) {
		console.error(`the &draw knob wants one of ${DRAW_KNOB_TOOLS.join(', ')}; got "${draw}"`);
		return;
	}
	pressTool(view, DESIGNER_TOOL_LABELS[tool]);
	if (tool === 'trace-detail') {
		for (const [x, y] of TRACED_VERTICES) {
			pointer(canvas, 'pointerdown', x, y);
			pointer(canvas, 'pointerup', x, y);
		}
		return;
	}
	const [from, to] = HELD_DRAGS[tool];
	pointer(canvas, 'pointerdown', from[0], from[1]);
	pointer(canvas, 'pointermove', to[0], to[1]);
}

/**
 * What every `?preset=` capture waits on. It waits first for the leaf's mount, then for TWO things before
 * touching anything: the design, which the leaf reads after it mounts, and the canvas's first measured size
 * (`EditorStore.stageSize`) — the moment `DesignerCanvas` frames an opened design, so a capture taken before
 * it would photograph the unframed camera. A bare `setTimeout(0)` promised neither.
 *
 * Then, in order:
 * - `&select=`/`&mode=`, through the REAL Select button and the leaf's own store;
 * - `&camera=default`, which puts `DEFAULT_VIEWPORT` back — the camera a user zoomed out to, where the toilet
 *   is a few dozen pixels across. No fit is pressed otherwise: a capture shows the opening fit the product
 *   took, so a regression in that fit is photographed rather than repaired by this page;
 * - `&grid`, which shows the designer's own grid through the leaf's `WorkspaceStore`;
 * - `&view-menu`, which opens the View menu through the real summary click (F1's fix instrument:
 *   below 900px container width the menu used to open off-screen, and this is what a capture proves);
 * - `&draw=`, LAST, so the preview it leaves is drawn at the camera the capture keeps.
 *
 * Last of all it sets `data-rp-harness-ready` on the view: the mark `scripts/harness-shot.mjs`'s preset
 * shots wait on, since the view element itself is attached at mount, before any of this. The leaf's Pinia
 * is reached through the Vue app `AssetDesignerView` mounts on its host element. Harness-only: no
 * production seam exists for this, and none is added.
 */
async function driveHarness(
	view: AssetDesignerView,
	knobs: { readonly select?: string; readonly mode?: string; readonly draw?: string; readonly camera?: string; readonly grid?: boolean; readonly viewMenu?: boolean },
): Promise<void> {
	const host = (): (HTMLElement & { __vue_app__: App }) | null => view.contentEl.querySelector('.renovation-asset-designer-view');
	await settleUntil(() => host() !== null, 'the designer mount');
	const pinia = (host() as HTMLElement & { __vue_app__: App }).__vue_app__.config.globalProperties.$pinia;
	const store = useAssetDesignStore(pinia);
	const editor = useEditorStore(pinia);
	await settleUntil(() => store.design !== null && editor.stageSize.width > 0, 'the ?preset design on a measured canvas');
	if (knobs.select !== undefined) {
		pressTool(view, 'designer.toolbar.select');
		store.select(harnessSelection(knobs.select));
		const mode: SelectionMode = knobs.mode === 'points' || knobs.mode === 'bend' ? knobs.mode : 'transform';
		store.setMode(mode);
	}
	if (knobs.camera === 'default') editor.viewport = DEFAULT_VIEWPORT;
	if (knobs.grid === true) useWorkspaceStore(pinia).gridVisible = true;
	if (knobs.viewMenu === true) view.contentEl.querySelector<HTMLElement>('.rp-designer-tools .rp-view-menu > summary')?.click();
	if (knobs.draw !== undefined) drawInHarness(view, view.contentEl.querySelector('.rp-plan-canvas') as HTMLElement, knobs.draw);
	view.contentEl.dataset.rpHarnessReady = '';
}

/**
 * `knobs` are `page.ts`'s `&select=`, `&mode=`, `&draw=`, `&camera=`, `&grid`, `&view-menu` and
 * `&pending`, honoured only beside a preset: a shapeless fixture has no part to select or draw beside,
 * and a capture of one would photograph a state nobody could reach.
 */
export function mountAssetDesignerHarness(
	root: HTMLElement,
	presetId: string | null = null,
	knobs: { readonly select?: string; readonly mode?: string; readonly draw?: string; readonly camera?: string; readonly grid?: boolean; readonly viewMenu?: boolean; readonly pending?: boolean } = {},
): MountedAssetDesigner {
	// Obsidian's DOM prototype extensions. Installed first, because the mount below uses them.
	installObsidianDom();
	root.empty();

	const leafEl = root.createDiv('rp-harness-leaf');
	const view = new AssetDesignerView(new FakeLeaf() as never, assetDesignerHarnessDeps(presetId, knobs.pending === true));
	leafEl.appendChild(view.containerEl);

	// State first, then open — the restored-leaf order `mountPlanEditorHarness` uses. `void`
	// rather than awaited: the page entry cannot await, and both do their work synchronously
	// before resolving.
	void view.setState({ assetId: HARNESS_ASSET_ID }, {} as never);
	void view.onOpen();
	// `void`: a wait that times out rejects, which the page reports as an error and `harness-shot` fails on.
	if (presetId !== null) void driveHarness(view, knobs);

	return { leafEl, view };
}
