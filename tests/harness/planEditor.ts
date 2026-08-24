import { ok } from '../../src/core/result/Result';
import { PlanEditorView, type PlanEditorDeps } from '../../src/presentation/views/PlanEditorView';
import type { BackgroundVault } from '../../src/presentation/editor/layers/background/BackgroundRenderModel';
import type { PlanDto, ZoneDto } from '../../src/presentation/read-models/PlanDto';
import { installObsidianDom } from '../helpers/dom';
import { FakeLeaf } from '../helpers/workspace';

/**
 * The REAL Plan Editor, mounted outside Obsidian for LOOKING at — `npm run harness`
 * with `?view=plan-editor`.
 *
 * This is the only place the layered Konva scene can be seen against Obsidian's own
 * app.css, in both colour schemes, at a real size. jsdom draws nothing and the suite
 * asserts structure; a browser is what shows whether the shell's five regions actually fit
 * together and whether zone fills read against a real theme's background.
 *
 * **No background document**, deliberately. The harness has no vault, so a background
 * would have to come from a committed binary or from a data URI built on the page — and
 * the second is a model of the base64 embedding §55 forbids, sitting right next to the
 * code that must never do it. The background pipeline is covered by the suite, with a real
 * PNG and a real PDF rasterized through real pdf.js, and by `npm run test-build` in a live
 * vault. What this page is for is the SCENE.
 */

const HARNESS_PLAN: PlanDto = {
	id: 'harness-plan',
	projectId: 'harness-project',
	name: 'Ground floor',
	background: null,
	layers: [],
};

/**
 * A small flat we can recognise at a glance — rooms of plausible domestic sizes in
 * millimetres, one of each status so the non-colour channels (dash pattern, caption) can
 * be compared side by side, and one zone with a non-rectangular outline so the polygon
 * path is not being judged on rectangles alone.
 */
const HARNESS_ZONES: readonly ZoneDto[] = [
	{
		id: 'harness-kitchen',
		planId: HARNESS_PLAN.id,
		name: 'Kitchen',
		zoneType: 'Room',
		status: 'Planned',
		points: [
			{ x: 0, y: 0 },
			{ x: 4200, y: 0 },
			{ x: 4200, y: 3000 },
			{ x: 0, y: 3000 },
		],
	},
	{
		id: 'harness-bath',
		planId: HARNESS_PLAN.id,
		name: 'Bathroom',
		zoneType: 'Room',
		status: 'InProgress',
		points: [
			{ x: 4400, y: 0 },
			{ x: 6800, y: 0 },
			{ x: 6800, y: 2200 },
			{ x: 4400, y: 2200 },
		],
	},
	{
		id: 'harness-terrace',
		planId: HARNESS_PLAN.id,
		name: 'Terrace',
		zoneType: 'Terrace',
		status: 'Complete',
		points: [
			{ x: 0, y: 3200 },
			{ x: 6800, y: 3200 },
			{ x: 6800, y: 5400 },
			{ x: 3400, y: 6600 },
			{ x: 0, y: 5400 },
		],
	},
	{
		id: 'harness-garden',
		planId: HARNESS_PLAN.id,
		name: 'Garden',
		zoneType: 'Garden',
		status: 'Planned',
		points: [
			{ x: 7000, y: 0 },
			{ x: 12_000, y: 0 },
			{ x: 12_000, y: 6600 },
			{ x: 7000, y: 6600 },
		],
	},
];

/**
 * The dependencies a Plan Editor takes, answered from the fixtures above. Nothing here
 * reaches a vault: `getAbstractFileByPath` always answers `null`, which is the "no
 * background" path the header explains.
 */
function harnessDeps(): PlanEditorDeps {
	return {
		queries: {
			getPlan: () => Promise.resolve(ok(HARNESS_PLAN)),
			findZonesByPlan: () => Promise.resolve(ok(HARNESS_ZONES)),
		},
		vault: {
			getAbstractFileByPath: () => null,
			getResourcePath: () => '',
			readBinary: () => Promise.resolve(new ArrayBuffer(0)),
		} as unknown as BackgroundVault,
		// The page's own scheme toggle changes the body class, and the plugin's variables
		// resolve from it — so a "theme change" here is exactly what Obsidian's `css-change`
		// means, and the toggle drives it through this.
		onThemeChange: (listener) => {
			window.addEventListener('rp-harness-theme', listener);
			return () => window.removeEventListener('rp-harness-theme', listener);
		},
		// Nothing writes on this page, so nothing ever changes a plan under it.
		onPlanChanged: () => () => undefined,
	};
}

export interface MountedPlanEditor {
	leafEl: HTMLElement;
	view: PlanEditorView;
}

export function mountPlanEditorHarness(root: HTMLElement): MountedPlanEditor {
	// Obsidian's DOM prototype extensions and its global `createEl`. Installed first,
	// because the mount below uses them.
	installObsidianDom();
	root.empty();

	// The same real nesting `mountHarness` uses: `containerEl` is what the app hands a
	// view, and the leaf frame plus `tests/harness/theme.css` is what supplies the height
	// Obsidian's own pane would.
	const leafEl = root.createDiv('rp-harness-leaf');
	const view = new PlanEditorView(new FakeLeaf() as never, harnessDeps());
	leafEl.appendChild(view.containerEl);

	// State first, then open — the restored-leaf order. `void` rather than awaited: the
	// page entry cannot await, and both do their work synchronously before resolving.
	void view.setState({ planId: HARNESS_PLAN.id }, {} as never);
	void view.onOpen();

	return { leafEl, view };
}
