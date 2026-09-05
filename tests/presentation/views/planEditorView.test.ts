/**
 * @vitest-environment jsdom
 *
 * The Plan Editor's Obsidian lifecycle: one isolated Vue app per leaf, keyed to a Plan
 * that travels in the leaf's own view state.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Konva from 'konva';
import { ok } from '../../../src/core/result/Result';
import {
	PLAN_EDITOR_ICON,
	PLAN_EDITOR_VIEW,
	PlanEditorView,
	type PlanEditorDeps,
} from '../../../src/presentation/views/PlanEditorView';
import { EDITOR_RUNTIME, type EditorRuntime } from '../../../src/presentation/editor/runtime';
import { t } from '../../../src/presentation/i18n/strings';
import type { BackgroundVault } from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';
import { unavailablePlanEditorCommands } from '../../../src/presentation/editor/planEditorCommands';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installEditorEnvironment, settle, sizedShellRoot } from '../../helpers/editor';
import { resizeTo } from '../../helpers/layout';
import { FIXTURE_PLAN, FIXTURE_PROJECT, FIXTURE_ZONES } from '../../helpers/planFixtures';
// Mock-only surface, imported BY NAME — see `tests/plugin/sequenceNoticeWiring.test.ts`'s own
// comment for why this is the same class the `'obsidian'` alias resolves to.
import { Notice } from '../../helpers/obsidian-mock';
import { FakeLeaf } from '../../helpers/workspace';
import { planEditorQueriesFor } from '../../helpers/planEditorRig';
import { expectOk } from '../../helpers/domain';
import { makePlan, makeProject, makeZone } from '../../helpers/entities';
import { createPolygon } from '../../../src/core/geometry/Polygon';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { GetZoneInspector } from '../../../src/application/queries/GetZoneInspector';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';

installEditorEnvironment();

let themeListeners = 0;
let planListeners = 0;
let catalogueListeners = 0;
let priceListeners = 0;
let figureListeners = 0;
let fileListeners = 0;

function deps(plan: typeof FIXTURE_PLAN | null = FIXTURE_PLAN): PlanEditorDeps {
	return {
		queries: {
			getPlan: () => Promise.resolve(ok(plan)),
			getProject: () => Promise.resolve(ok(FIXTURE_PROJECT)),
			getRequirementsForZone: () => Promise.resolve(ok([])),
			listAssets: () => Promise.resolve(ok([])),
			// The two the contract requires and this fixture omitted until `tests/**` was
			// type-checked. A fixture thinner than its own annotation is the shape this
			// repository keeps recording: the view can reach these, and here they answered
			// `undefined`.
			listRequirementsReferencing: () => Promise.resolve(ok([])),
			listReassignmentTargets: () => Promise.resolve(ok([])),
			findZonesByPlan: () => Promise.resolve(ok({ zones: FIXTURE_ZONES, unreadable: 0 })),
		},
		// The lifecycle tests here dispatch nothing; the refusal commands keep that honest.
		commands: unavailablePlanEditorCommands(),
		openNote: vi.fn<(entityId: string) => Promise<'opened' | 'missing' | 'failed'>>().mockResolvedValue('opened'),
		vault: {
			getAbstractFileByPath: () => null,
			getResourcePath: () => '',
			readBinary: () => Promise.resolve(new ArrayBuffer(0)),
		} as unknown as BackgroundVault,
		onThemeChange: () => {
			themeListeners += 1;
			return () => {
				themeListeners -= 1;
			};
		},
		onPlanChanged: () => {
			planListeners += 1;
			return () => {
				planListeners -= 1;
			};
		},
		onCatalogueChanged: () => {
			catalogueListeners += 1;
			return () => {
				catalogueListeners -= 1;
			};
		},
		onProjectPricesChanged: () => {
			priceListeners += 1;
			return () => {
				priceListeners -= 1;
			};
		},
		onRequirementFiguresChanged: () => {
			figureListeners += 1;
			return () => {
				figureListeners -= 1;
			};
		},
		// COUNTED like every sibling above, so this file's subscription-leak cases cover this
		// door too: a view that stopped releasing it would leak a vault listener per leaf, which is
		// exactly what those cases exist to refuse.
		onVaultFileChanged: () => {
			fileListeners += 1;
			return () => {
				fileListeners -= 1;
			};
		},
	};
}

/**
 * Every view a test opened, closed automatically afterwards.
 *
 * Not tidiness: `Konva.stages` is process-global, so ONE test that forgets to close leaves
 * a stage behind and every later assertion counting stages is measuring the wrong thing —
 * which is how the first version of this file reported four failures that were all the
 * same missing `onClose`.
 */
const openViews: PlanEditorView[] = [];

function makeView(
	leaf: FakeLeaf = new FakeLeaf(),
	plan: typeof FIXTURE_PLAN | null = FIXTURE_PLAN,
): PlanEditorView {
	const view = new PlanEditorView(leaf as never, deps(plan));
	openViews.push(view);
	return view;
}

/**
 * Give the just-mounted shell a pane width, the way Obsidian's own layout would.
 *
 * `ResponsiveEditorShell` (Task 19) reads its root's `clientWidth` and jsdom answers 0 for
 * every element, which `layoutModeFor` reads — correctly — as `unsupported`: the width at which
 * the editor draws a notice instead of a canvas. So a view mounted here has no Konva stage at
 * all until something says how wide its pane is, and every case below that counts stages is
 * really about a pane an Obsidian user would have. `sizedShellRoot`'s own docblock carries the
 * rest; the mount paths in `tests/helpers/editor.ts` call it for the same reason.
 */
async function sizeShell(view: PlanEditorView): Promise<void> {
	sizedShellRoot(view.contentEl);
	await settle();
}

/**
 * Reaches a mounted view's `EditorRuntime` the way `tests/helpers/editor.ts`'s `runtimeOf`
 * reaches a `@vue/test-utils`-mounted one: `provide()` sets it on `PlanEditorRoot`'s OWN
 * component instance. This file mounts through the real `PlanEditorView` rather than through
 * `mountPlanEditor`, so there is no `VueWrapper` here — the root Vue `App` Obsidian's own
 * `createApp(...).mount(...)` returns sets its `_instance` to that same root instance once
 * mounted, which is the one other place `provides` is reachable from outside the tree.
 *
 * Only this file's own binding test needs it: everything else here asserts through the DOM,
 * which is the honest instrument for a lifecycle case.
 */
function runtimeOfView(view: PlanEditorView): EditorRuntime {
	const app = (view as unknown as { vueApp: { _instance: { provides: Record<symbol, unknown> } } | null }).vueApp;
	if (app === null) {
		throw new Error('expected the view to have mounted a Vue app');
	}
	const runtime = app._instance.provides[EDITOR_RUNTIME as unknown as symbol];
	if (runtime === undefined) {
		throw new Error('expected the mounted tree to have provided an EditorRuntime');
	}
	return runtime as EditorRuntime;
}

/** Opening a view that already knows which Plan it shows — the restored-leaf path. */
async function opened(planId = FIXTURE_PLAN.id): Promise<PlanEditorView> {
	const view = makeView();
	await view.setState({ planId }, {} as never);
	await view.onOpen();
	await settle();
	await sizeShell(view);
	return view;
}

beforeEach(() => {
	themeListeners = 0;
	planListeners = 0;
	catalogueListeners = 0;
	priceListeners = 0;
	figureListeners = 0;
	fileListeners = 0;
	// Only the two `openPlanNote` notify-arm cases below read `Notice.shown`; activating here
	// rather than inside each of them keeps this file's one `beforeEach` the single place
	// state resets, and `activateNotices()` itself is safe to call repeatedly — it disposes
	// whatever the previous call built before replacing it.
	activateNotices();
});

afterEach(async () => {
	for (const view of openViews.splice(0)) await view.onClose();
	await settle();
});

describe('what the view tells Obsidian about itself', () => {
	/**
	 * The view type is DATA: Obsidian persists it in the workspace layout, so renaming it
	 * orphans every Plan Editor leaf a user has open. The display name beside it is text.
	 */
	it('answers its persisted type, its icon, and a translated display name', () => {
		const view = makeView();

		expect(view.getViewType()).toBe(PLAN_EDITOR_VIEW);
		expect(view.getIcon()).toBe(PLAN_EDITOR_ICON);
		expect(view.getDisplayText()).toBe(t('en', 'view.plan-editor.name'));
	});

	/**
	 * The pairing between the persisted type and the stylesheet selector keyed on it.
	 * Renaming the type without the sheet leaves a rule matching nothing, which no other
	 * check here can see — jsdom applies no stylesheet and the harness draws one view.
	 */
	it('is the view type styles/chrome.css keys its rule on', () => {
		// Relative to the working directory, like every other path in this suite: under jsdom
		// `import.meta.url` is an http URL and `new URL(…)` resolves to a scheme node:fs refuses.
		const chrome = readFileSync('styles/chrome.css', 'utf8');

		expect(chrome).toContain(`.workspace-leaf-content[data-type="${PLAN_EDITOR_VIEW}"]`);
	});
});

describe('the plan a leaf is showing', () => {
	it('round-trips the plan id through the leaf view state', async () => {
		const view = await opened('plan-first-floor');

		expect(view.getState()).toEqual({ planId: 'plan-first-floor' });
	});

	/**
	 * The workspace layout is a file a user can edit and an older version of this plugin
	 * wrote — the same trust boundary `settingsFrom` draws around `data.json`. A state with
	 * no usable plan id leaves the view showing its loading message rather than hydrating a
	 * plan called `undefined`.
	 */
	it.each([
		['no state at all', null],
		['a state with no plan id', {}],
		['a plan id that is not a string', { planId: 7 }],
		['an empty plan id', { planId: '' }],
	])('mounts nothing for %s', async (_name, state) => {
		const view = makeView();

		await view.setState(state, {} as never);
		await view.onOpen();
		await settle();

		expect(Konva.stages).toHaveLength(0);
		expect(view.getState()).toEqual({ planId: '' });
		await view.onClose();
	});

	/**
	 * Obsidian calls `onOpen` and `setState` in an order a plugin does not get to assume,
	 * so both route through one place that mounts when there is something to mount. Driven
	 * in the OTHER order from `opened()` above, which is the whole point.
	 */
	it('mounts when the plan arrives after the view is already open', async () => {
		const view = makeView();

		await view.onOpen();
		expect(Konva.stages).toHaveLength(0);

		await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);
		await settle();
		await sizeShell(view);

		expect(Konva.stages).toHaveLength(1);
		await view.onClose();
	});

	it('does not remount when told the same plan twice', async () => {
		const view = await opened();
		const stage = Konva.stages[0];

		await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);
		await settle();

		expect(Konva.stages[0]).toBe(stage);
		await view.onClose();
	});
});

describe('mount and unmount', () => {
	it('mounts one Vue app with a Konva stage into contentEl', async () => {
		const view = await opened();

		expect(Konva.stages).toHaveLength(1);
		expect(view.contentEl.querySelector('.renovation-plan-editor-view')).not.toBeNull();
		await view.onClose();
	});

	/**
	 * Obsidian keeps the leaf and reuses the view, so an app left mounted would keep a
	 * `ResizeObserver`, a `css-change` listener and a Konva stage alive against a detached
	 * tree — and the next open would stack a second of each.
	 */
	it('leaves no app, stage, listener or markup behind on close', async () => {
		const view = await opened();
		expect(themeListeners).toBe(1);
		// ONE of each, and the split is the assertion. `PlanEditorRoot` subscribes `hydrate` to
		// the plan door; `runtime.ts` subscribes the assign picker to the CATALOGUE door. This
		// read TWO plan listeners and zero catalogue ones until the picker stopped borrowing
		// `onPlanChanged` — right for the one event it needed there and wasteful for the five
		// it did not, so a zone gesture re-read every asset note in the vault.
		//
		// Both numbers are asserted rather than loosened to "at least one" because that is the
		// half this case exists for: a count going UP is a subscription added without a
		// disposal, which is exactly the leak the assertions below measure. And asserting the
		// PAIR is what stops a build that merges the two doors back together from passing —
		// one that subscribed both to `onPlanChanged` would read 2 and 0 again.
		expect(planListeners).toBe(1);
		expect(catalogueListeners).toBe(1);
		// The two doors the unit-cost block added. Counted for the same reason and asserted the
		// same way: each is a subscription the runtime takes once and must give back once.
		expect(priceListeners).toBe(1);
		expect(figureListeners).toBe(1);
		// The vault-file door, and it is `BackgroundLayer`'s rather than a root-level subscription:
		// the layer registers it at setup and releases it on unmount, so it is one per mounted
		// canvas. Counted here for the reason the others are — a listener a leaf does not release
		// is one that re-decodes a raster into a detached ref on every file the user ever touches.
		expect(fileListeners).toBe(1);

		await view.onClose();
		await settle();

		expect(Konva.stages).toHaveLength(0);
		expect(themeListeners).toBe(0);
		expect(planListeners).toBe(0);
		expect(catalogueListeners).toBe(0);
		expect(priceListeners).toBe(0);
		expect(figureListeners).toBe(0);
		expect(fileListeners).toBe(0);
		expect(view.contentEl.childElementCount).toBe(0);
	});

	it('stacks nothing across repeated open and close cycles on one view', async () => {
		const view = makeView();
		await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);

		for (let cycle = 0; cycle < 3; cycle += 1) {
			await view.onOpen();
			await settle();
			await sizeShell(view);
			expect(Konva.stages).toHaveLength(1);
			await view.onClose();
			await settle();
			expect(Konva.stages).toHaveLength(0);
		}

		expect(themeListeners).toBe(0);
		expect(fileListeners).toBe(0);
	});

	/**
	 * ADR-004: an isolated app per `ItemView`. Two Plan Editors are the premise of this view
	 * existing at all, so two leaves must produce two independent stages rather than one
	 * shared anything.
	 */
	it('gives two leaves two independent stages', async () => {
		const first = await opened('plan-ground');
		const second = await opened('plan-first');

		expect(Konva.stages).toHaveLength(2);
		expect(Konva.stages[0]).not.toBe(Konva.stages[1]);

		await first.onClose();
		await settle();

		// Closing one leaves the other alive: nothing about the first was shared.
		expect(Konva.stages).toHaveLength(1);
		await second.onClose();
	});

	it('adds the container class the stylesheet resets pane padding through', async () => {
		const view = await opened();

		expect(view.containerEl.classList.contains('renovation-planner-container')).toBe(true);
		await view.onClose();
	});

	/**
	 * `PlanEditorContext.focusLeaf`, at the same seam and for the same reason as `closeLeaf`
	 * below: `PlanEditorRoot` can be asked whether it CALLED it, and only here can it be asked
	 * whether calling it reaches an actual `WorkspaceLeaf`.
	 *
	 * The button lives in the UNSUPPORTED layout, which is the whole point of the action — a
	 * pane too narrow to draw a canvas in — so the case narrows the shell rather than mounting
	 * anything special. `revealLeaf` is what the pinned typings promise; nothing here maximises
	 * a pane, because no such call exists to make.
	 */
	it('reveals its own leaf when the too-narrow action is pressed', async () => {
		const leaf = new FakeLeaf();
		const view = makeView(leaf);
		await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);
		await view.onOpen();
		await settle();
		resizeTo(sizedShellRoot(view.contentEl), 320, 800);
		await settle();

		const action = view.contentEl.querySelector<HTMLButtonElement>('.rp-unsupported-width__action');
		expect(action).not.toBeNull();

		action?.click();
		await settle();

		// Read through the view, because this fake's `app` is the view's own — see the mock.
		const revealed = (view as unknown as { app: { workspace: { revealed: unknown[] } } }).app.workspace.revealed;
		expect(revealed).toEqual([leaf]);
		await view.onClose();
	});

		it('logs a fault rather than throwing or swallowing it when revealing the leaf rejects', async () => {
			const leaf = new FakeLeaf();
			const errors: Array<[string, (Record<string, unknown> & { cause?: unknown }) | undefined]> = [];
			const commands = unavailablePlanEditorCommands();
			const view = new PlanEditorView(leaf as never, {
				...deps(),
				commands: {
					...commands,
					logger: {
						...commands.logger,
						error: (event, context) => errors.push([event, context]),
					},
				},
			});
			openViews.push(view);
			await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);
			await view.onOpen();
			await settle();
			resizeTo(sizedShellRoot(view.contentEl), 320, 800);
			await settle();

			const cause = new Error('revealLeaf rejected');
			(view as unknown as { app: { workspace: { revealLeaf: () => Promise<void> } } }).app.workspace.revealLeaf =
				() => Promise.reject(cause);

			const action = view.contentEl.querySelector<HTMLButtonElement>('.rp-unsupported-width__action');
			expect(action).not.toBeNull();

			expect(() => action?.click()).not.toThrow();
			await settle();

			expect(errors).toHaveLength(1);
			expect(errors[0]?.[0]).toBe('plan-editor.focus-leaf-failed');
			expect(errors[0]?.[1]).toMatchObject({ cause });
		});

	/**
	 * `PlanEditorContext.closeLeaf`, at the seam that supplies it.
	 *
	 * The tree gets a narrow callback and the VIEW is what holds the `WorkspaceLeaf` — the same
	 * shape `onPlanChanged` already had, and the reason `onThemeChange` gives for not handing
	 * the `Workspace` down. This is the only place that binding is observable: `PlanEditorRoot`
	 * can be asked whether it CALLED `closeLeaf`, and only here can it be asked whether calling
	 * it closes anything.
	 */
	it('closes its own leaf when the dangling-plan action is pressed', async () => {
		// Driven through the RENDERED button rather than by reaching for the provided context:
		// the binding is only worth anything if the whole chain works, and this is the one place
		// the far end of it — an actual `WorkspaceLeaf` — exists to be checked.
		// `planEditorFailure.test.ts` covers which of the two meanings the button carries.
		const leaf = new FakeLeaf();
		const view = makeView(leaf, null);
		await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);
		await view.onOpen();
		await settle();
		// The dangling-plan state lives in the canvas REGION, which a shell measuring 0 does
		// not render at all (`sizeShell`'s docblock): without a width there is no button here.
		await sizeShell(view);

		const action = view.contentEl.querySelector<HTMLButtonElement>('.rp-view-failure__action');
		expect(action).not.toBeNull();
		expect(leaf.detached).toBe(0);

		action?.click();
		await settle();

		expect(leaf.detached).toBe(1);
	});

	/**
	 * `PlanEditorContext.openPlanNote`, at the seam that supplies it (design spec §2.6): the
	 * VIEW partially applies `PlanEditorDeps.openNote` with THIS leaf's plan id, the same shape
	 * `closeLeaf` and `focusLeaf` already have. Driven through `runtimeOfView`'s
	 * `EditorRuntime.openPlanNote` rather than through a rendered control, because no shell
	 * region calls it yet — that is the trust path's `unrecovered` warning row, a later task's
	 * surface — and this is the one place the binding itself, from `deps.openNote` down to the
	 * leaf's own id, can be checked today.
	 */
	it("openPlanNote asks the deps for THIS leaf's plan note", async () => {
		const openedIds: string[] = [];
		const view = new PlanEditorView(new FakeLeaf() as never, {
			...deps(),
			openNote: (id) => {
				openedIds.push(id);
				return Promise.resolve('opened');
			},
		});
		openViews.push(view);
		await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);
		await view.onOpen();

		await runtimeOfView(view).openPlanNote();

		expect(openedIds).toEqual([FIXTURE_PLAN.id]);
	});

	/**
	 * The other half of `openPlanNote`'s two-arm contract (design spec §2.6): `'missing'` is
	 * the one outcome the CONTEXT itself notifies on, because a note the vault no longer holds
	 * is not something `deps.openNote` can already have reported — `openProjectNote` answers
	 * `'missing'` for an id that resolved to nothing, which is silence rather than a fault.
	 *
	 * Asserted with the relative before/after count idiom (`assetPriceNoticeWiring.test.ts`'s
	 * own shape) rather than resetting `Notice.shown.length`, so this case cannot start passing
	 * silently because some earlier case in the same run happened to clear the array first.
	 */
	it("notifies the source-note-missing warning when the deps answer 'missing'", async () => {
		const view = new PlanEditorView(new FakeLeaf() as never, {
			...deps(),
			openNote: () => Promise.resolve('missing'),
		});
		openViews.push(view);
		await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);
		await view.onOpen();

		const before = Notice.shown.length;
		await runtimeOfView(view).openPlanNote();

		expect(Notice.shown.length).toBe(before + 1);
		expect(Notice.shown.at(-1)).toBe(t('en', 'editor.source-note-missing'));
	});

	/**
	 * The docblocks on `PlanEditorContext.openPlanNote` and on `PlanEditorView.mount`'s binding
	 * both claim a `'failed'` outcome has "already been reported once, inside the opener" — a
	 * claim about `deps.openNote`'s own caller, not about this view. Proven rather than left as
	 * prose: a stub `openNote` that resolves `'failed'` without calling `notifyFault` or
	 * `notifyWarning` itself must leave `Notice.shown` untouched, which is exactly what a real
	 * refused open does from THIS view's side — whatever the opener did with its own fault door
	 * happened before `deps.openNote` resolved, and is not this case's to re-assert.
	 */
	it("reports nothing further when the deps answer 'failed'", async () => {
		const view = new PlanEditorView(new FakeLeaf() as never, {
			...deps(),
			openNote: () => Promise.resolve('failed'),
		});
		openViews.push(view);
		await view.setState({ planId: FIXTURE_PLAN.id }, {} as never);
		await view.onOpen();

		const before = Notice.shown.length;
		await runtimeOfView(view).openPlanNote();

		expect(Notice.shown.length).toBe(before);
	});
});

/** A rectangle 4200 × 3600 mm with its min corner where the caller says. */
const roomRect = (x: number, y: number) =>
	expectOk(
		createPolygon([
			{ x, y },
			{ x: x + 4200, y },
			{ x: x + 4200, y: y + 3600 },
			{ x, y: y + 3600 },
		]),
	);

/** A fresh leaf opened on one plan over a caller's own deps, sized like a real pane. */
async function openOn(planId: string, viewDeps: PlanEditorDeps): Promise<PlanEditorView> {
	const view = new PlanEditorView(new FakeLeaf() as never, viewDeps);
	openViews.push(view);
	await view.setState({ planId }, {} as never);
	await view.onOpen();
	await settle();
	await sizeShell(view);
	return view;
}

/** Every room the floor summary lists, as `[id, name]` pairs in the order drawn. */
function roomRows(view: PlanEditorView): [string, string][] {
	return [...view.contentEl.querySelectorAll<HTMLElement>('.rp-room-list__row')].map((row) => [
		row.dataset['rpId'] ?? '',
		row.textContent?.trim() ?? '',
	]);
}

/** Click one room's row and read back what the Room Inspector then shows. */
async function inspect(view: PlanEditorView, zoneId: string): Promise<string[]> {
	const row = view.contentEl.querySelector<HTMLButtonElement>(`.rp-room-list__row[data-rp-id="${zoneId}"]`);
	if (row === null) throw new Error(`no room row for ${zoneId}`);
	row.click();
	await settle();
	const body = view.contentEl.querySelector<HTMLElement>('.rp-room-inspector');
	if (body === null) throw new Error('expected the Room Inspector to show the selected room');
	return [
		body.dataset['rpId'] ?? '',
		body.querySelector('.rp-editor-panel-title')?.textContent?.trim() ?? '',
		body.querySelector('.rp-editor-inspector-fields')?.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '',
	];
}

/**
 * **Reload, at the layer that owns a leaf** (design spec §8): closing a Plan Editor and
 * opening one again on the same plan draws the same rooms.
 *
 * `editorRoundTrip.test.ts` proves the note and its sidecar survive a reopen at the
 * REPOSITORY. Neither of those files mounts anything, and this one mounts the real
 * `PlanEditorView` — so what is left to prove here is the half between them: that a second
 * leaf, with its own Vue app, its own Pinia and an empty selection, re-reads and re-draws
 * what the first one showed. The queries below therefore read real in-memory repositories
 * rather than the static `FIXTURE_ZONES` literal `deps()` hands out: a fixture that answers
 * the same array whatever happened to it cannot tell a reopen that re-read from one that
 * replayed a constant, and the deleted-room case beneath needs to be able to change what the
 * vault holds between two mounts.
 */
describe('reopening a floor', () => {
	const REOPEN_PROJECT = createProjectId();

	/** A plan, its project and two Room-classified zones, behind the real query bundle. */
	async function reopenFixture() {
		const projects = new InMemoryProjectRepository();
		await projects.save(makeProject({ id: REOPEN_PROJECT, name: 'Willow House' }), 'absent');
		const plans = new InMemoryPlanRepository();
		const plan = makePlan({ projectId: REOPEN_PROJECT, name: 'Ground floor' });
		await plans.save(plan, 'absent');
		const zones = new InMemoryZoneRepository();
		const kitchen = makeZone({
			projectId: REOPEN_PROJECT,
			planId: plan.id,
			name: 'Kitchen',
			zoneType: 'Room',
			geometry: roomRect(1000, 1000),
		});
		const utility = makeZone({
			projectId: REOPEN_PROJECT,
			planId: plan.id,
			name: 'Utility room',
			zoneType: 'Room',
			geometry: roomRect(6000, 1000),
		});
		await zones.save(kitchen, 'absent');
		await zones.save(utility, 'absent');
		return {
			planId: plan.id as string,
			kitchenId: kitchen.id as string,
			utilityId: utility.id as string,
			zones,
			viewDeps: {
				...deps(),
				queries: planEditorQueriesFor(plans, projects, zones),
				// The write side stays the refusal bundle — nothing here dispatches — with the ONE
				// read inside it made real: `GetZoneInspector` is what selecting a room asks, and
				// `unavailablePlanEditorCommands` refuses it along with every write, so the Room
				// Inspector would draw its empty body no matter what the reopen re-read.
				// `planEditorRig`'s own header records the same trap from the harness side.
				commands: { ...unavailablePlanEditorCommands(), zoneInspector: new GetZoneInspector(zones) },
			},
		};
	}

	it('reopening the same plan shows the same room: id, name, type, floor and area', async () => {
		const { planId, kitchenId, viewDeps } = await reopenFixture();

		const first = await openOn(planId, viewDeps);
		const rowsBefore = roomRows(first);
		const inspectedBefore = await inspect(first, kitchenId);
		await first.onClose();
		await settle();

		const second = await openOn(planId, viewDeps);

		// The same rooms, in the same order, with the same id — and the same four facts under
		// the Inspector's own heading, which is where the type, the floor and the derived area
		// are read. Compared against the FIRST mount's readings rather than against literals,
		// so this stays an assertion about reopening rather than a second transcription of the
		// fixture.
		expect(roomRows(second)).toEqual(rowsBefore);
		expect(rowsBefore).toHaveLength(2);
		expect(await inspect(second, kitchenId)).toEqual(inspectedBefore);
		// The reading being compared is a real one, not two empty strings agreeing.
		expect(inspectedBefore[1]).toBe('Kitchen');
		expect(inspectedBefore[2]).toContain(t('en', 'editor.zone-type.Room'));
		expect(inspectedBefore[2]).toContain('Ground floor');
	});

	/**
	 * The retirement rule, asserted from the reopen side: a leaf restored onto a floor whose
	 * rooms have changed under it draws what is THERE, in Select, with nothing selected.
	 *
	 * **State narrowly what a restored view state carries**: a plan id and nothing else, so
	 * "naming a deleted zone" is not something `setViewState` can do — a selection dies with
	 * the leaf's Pinia. What this case reaches is the half that IS observable at a reopen: the
	 * second leaf re-reads rather than replaying, so the deleted room is simply absent, and the
	 * Select-on-ready watcher puts the user back in the tool they can inspect with rather than
	 * in camera mode. `selectionRetirement`'s own suite owns the within-a-leaf half.
	 */
	it('a leaf reopened onto a floor whose room is gone opens in Select with every remaining room drawn', async () => {
		const { planId, kitchenId, utilityId, zones, viewDeps } = await reopenFixture();

		const first = await openOn(planId, viewDeps);
		await inspect(first, utilityId);
		await first.onClose();
		await settle();

		// The room goes while no leaf is open — a delete in another leaf, a note removed in the
		// file explorer, a sync.
		const loaded = expectOk(await zones.getById(utilityId as never));
		if (loaded === null) throw new Error('expected the room to delete');
		expectOk(await zones.delete(utilityId as never, loaded.version));

		const second = await openOn(planId, viewDeps);

		expect(roomRows(second)).toEqual([[kitchenId, 'Kitchen']]);
		expect(runtimeOfView(second).activeToolId.value).toBe('select');
		expect(second.contentEl.querySelector('.rp-room-inspector')).toBeNull();
	});
});
