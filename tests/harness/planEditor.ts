import { isErr, ok } from '../../src/core/result/Result';
import { area } from '../../src/core/geometry/operations';
import type { ZoneId } from '../../src/domain/zone/ZoneId';
import { PlanEditorView, type PlanEditorDeps } from '../../src/presentation/views/PlanEditorView';
import { unavailablePlanEditorCommands } from '../../src/presentation/editor/planEditorCommands';
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
 *
 * `HARNESS_PLAN` and `HARNESS_ZONES` are EXPORTED because the harness index mounts single
 * components against the same world (`fixture.ts`). One fixture rather than two: a second
 * set would be a second derivation that can answer differently, and two components drawn
 * from two plans that differ in a way nobody notices is exactly the defect one world buys
 * its way out of. `harnessDeps` is exported for the same reason and carries more surface —
 * a cast vault, two always-answering queries and an Inspector query answered from the zones
 * above — that `fixture.ts`'s editor context now hands to every component the index mounts,
 * not only to this page's own view. Its WRITES all refuse; see `commands` below for why the
 * one read in that bundle does not.
 */

export const HARNESS_PLAN: PlanDto = {
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
export const HARNESS_ZONES: readonly ZoneDto[] = [
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
export function harnessDeps(): PlanEditorDeps {
	return {
		queries: {
			// Ignores the plan id it is given and always answers `HARNESS_PLAN` — the real
			// query answers `ok(null)` for one it does not recognise. Fine while only
			// `mountPlanEditorHarness` called this with `HARNESS_PLAN.id`; worth stating now
			// that exporting `harnessDeps` widens the audience to whatever id a caller passes.
			getPlan: () => Promise.resolve(ok(HARNESS_PLAN)),
			findZonesByPlan: () => Promise.resolve(ok(HARNESS_ZONES)),
		},
		/**
		 * Every WRITE refuses with `settings.unrecovered`, the honest answer for a page with no
		 * vault behind it — the buttons render and the gestures fail like any other failed write
		 * rather than pretending to persist.
		 *
		 * **`zoneInspector` is a READ, and it is answered here rather than refused.** The bundle
		 * carries it because SDD §59 groups the Inspector query with the commands it shares a
		 * selection with, and for that bundle's PRODUCTION purpose — settings unrecovered, no
		 * vault — refusing the read is correct, because there is nothing to read. On this page
		 * there is: `HARNESS_ZONES` is right there. Reaching for the refusal bundle wholesale
		 * made a stand-in HARSHER than the thing it stands in for, and the harness is a tool for
		 * LOOKING: `InspectorStore` maps a failed read onto `{ kind: 'empty' }` (its own docblock
		 * names the gap — `InspectorDto` has no error variant), so selecting the seeded Kitchen
		 * showed it selected on the canvas and empty in the Inspector, with no error anywhere and
		 * two of the five shell regions contradicting each other. `docs/actors/Designer.md` asks
		 * for the opposite: a component that cannot mount says so and names itself.
		 *
		 * The area is computed with the same `core/geometry` operation `Zone.area()` calls rather
		 * than being written down beside each fixture zone — a second derivation would answer
		 * differently the day either changes, and the number on screen has to be the one the
		 * domain would produce.
		 *
		 * **`zones` — the `ZoneRepository` — is deliberately left refusing**, and the reason is
		 * not that it matters less. Its reads are reached in this bundle only by the reversible
		 * adapters' RESTORE halves, i.e. only after a successful write, and no write on this page
		 * succeeds; nothing else here calls one. Answering them would mean handing back
		 * `Loaded<Zone>` — real domain entities with real revision handles — built from these
		 * DTOs, which is a second derivation of the fixture world in a second shape, maintained
		 * for a path the page cannot reach. When a harness entry does reach one, the honest fix
		 * is a fixture repository, not a cast; until then the refusal is what "nothing can be
		 * written, so nothing can be restored" actually means.
		 */
		commands: {
			...unavailablePlanEditorCommands(),
			zoneInspector: {
				execute: ({ zoneId }) => {
					const zone = HARNESS_ZONES.find((candidate) => candidate.id === zoneId);

					if (!zone) return Promise.resolve(ok(null));

					const measured = area({ points: zone.points });

					if (isErr(measured)) return Promise.resolve(measured);

					return Promise.resolve(ok({ id: zone.id as ZoneId, name: zone.name, areaMm2: measured.value }));
				},
			},
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
