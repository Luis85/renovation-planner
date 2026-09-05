/**
 * @vitest-environment jsdom
 *
 * **Reload, at the layer that owns a leaf** (design spec §8): closing a Plan Editor and
 * opening one again on the same plan draws the same rooms, drops what was never committed,
 * and re-reads rather than replaying.
 *
 * `editorRoundTrip.test.ts` proves the note and its sidecar survive a reopen at the
 * REPOSITORY; it mounts nothing. `planEditorView.test.ts` mounts the real view but drives its
 * LIFECYCLE — one leaf at a time, over a static fixture. What is left between them, and what
 * every case here is about, is the SECOND leaf: its own Vue app, its own Pinia, an empty
 * selection and an empty room draft, re-reading a vault that may have moved since the first
 * one closed.
 *
 * **A sibling file rather than a fourth describe in `planEditorView.test.ts`.** With the two
 * reopen cases in it that file sat within a line or two of `tests/**`'s 450-line `max-lines`
 * cap (449 by a blank- and comment-skipping count taken in the edit that moved them; the
 * review round that asked for the third case read it lower — either way there was no room for
 * one), so splitting by describe is what the whole reopen suite moving here does. The seam is
 * the natural one and not merely a budget: that file is the Obsidian lifecycle of ONE leaf,
 * this one is what a SECOND leaf sees. `planEditorView.test.ts` is back to 336 counted lines.
 *
 * The queries here read real in-memory repositories rather than the static `FIXTURE_ZONES`
 * literal: a fixture that answers the same array whatever happened to it cannot tell a reopen
 * that re-read from one that replayed a constant, and two of the three cases have to change
 * what the vault holds between two mounts.
 *
 * **What no case here can see.** jsdom lays nothing out, so nothing below grades where
 * anything appears; the canvas is given a size the way `mountPlanEditor` gives one, because a
 * 0x0 stage cannot project a pointer drag into world millimetres at all.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ok } from '../../../src/core/result/Result';
import { PlanEditorView, type PlanEditorDeps } from '../../../src/presentation/views/PlanEditorView';
import { EDITOR_RUNTIME, type EditorRuntime } from '../../../src/presentation/editor/runtime';
import { t } from '../../../src/presentation/i18n/strings';
import type { BackgroundVault } from '../../../src/presentation/editor/layers/background/BackgroundRenderModel';
import { unavailablePlanEditorCommands } from '../../../src/presentation/editor/planEditorCommands';
import { installEditorEnvironment, settle, sizedShellRoot } from '../../helpers/editor';
import { placeAt, resizeTo } from '../../helpers/layout';
import { FakeLeaf } from '../../helpers/workspace';
import { planEditorQueriesFor, pointer } from '../../helpers/planEditorRig';
import { expectOk } from '../../helpers/domain';
import { makePlan, makeProject, makeZone } from '../../helpers/entities';
import { createPolygon } from '../../../src/core/geometry/Polygon';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { GetZoneInspector } from '../../../src/application/queries/GetZoneInspector';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';

installEditorEnvironment();

/**
 * Every view a case opened, closed automatically afterwards.
 *
 * Not tidiness: `Konva.stages` is process-global, so one case that forgets to close leaves a
 * stage behind and every later assertion is measuring the wrong tree — the same reason
 * `planEditorView.test.ts` keeps its own list.
 */
const openViews: PlanEditorView[] = [];

afterEach(async () => {
	for (const view of openViews.splice(0)) await view.onClose();
	await settle();
});

/**
 * The subscription doors as NO-OPS, deliberately uncounted.
 *
 * `planEditorView.test.ts`'s own `deps()` counts every listener because that file owns the
 * subscription-leak cases. Copying the counting version here would put a second set of
 * counters behind cases that assert nothing about them — two fixtures answering one question,
 * which is the drift this repository keeps recording. What this file needs is only that each
 * door EXISTS, so a mounted view can subscribe and a closed one can release.
 */
const noSubscription = () => () => undefined;

function reopenDeps(): PlanEditorDeps {
	return {
		queries: {
			getPlan: () => Promise.resolve(ok(null)),
			getProject: () => Promise.resolve(ok(null)),
			getRequirementsForZone: () => Promise.resolve(ok([])),
			listAssets: () => Promise.resolve(ok([])),
			listRequirementsReferencing: () => Promise.resolve(ok([])),
			listReassignmentTargets: () => Promise.resolve(ok([])),
			findZonesByPlan: () => Promise.resolve(ok({ zones: [], unreadable: 0 })),
		},
		commands: unavailablePlanEditorCommands(),
		openNote: vi.fn<(entityId: string) => Promise<'opened' | 'missing' | 'failed'>>().mockResolvedValue('opened'),
		vault: {
			getAbstractFileByPath: () => null,
			getResourcePath: () => '',
			readBinary: () => Promise.resolve(new ArrayBuffer(0)),
		} as unknown as BackgroundVault,
		onThemeChange: noSubscription,
		onPlanChanged: noSubscription,
		onCatalogueChanged: noSubscription,
		onProjectPricesChanged: noSubscription,
		onRequirementFiguresChanged: noSubscription,
		onVaultFileChanged: noSubscription,
	};
}

/**
 * A mounted view's `EditorRuntime`, reached through `PlanEditorRoot`'s own component
 * instance — the same route `planEditorView.test.ts`'s `runtimeOfView` takes, and for the
 * same reason: this file mounts through the real `PlanEditorView` rather than through
 * `mountPlanEditor`, so there is no `VueWrapper` to ask.
 */
function runtimeOfView(view: PlanEditorView): EditorRuntime {
	const app = (view as unknown as { vueApp: { _instance: { provides: Record<symbol, unknown> } } | null }).vueApp;
	if (app === null) throw new Error('expected the view to have mounted a Vue app');
	const runtime = app._instance.provides[EDITOR_RUNTIME as unknown as symbol];
	if (runtime === undefined) throw new Error('expected the mounted tree to have provided an EditorRuntime');
	return runtime as EditorRuntime;
}

/** A rectangle 4200 x 3600 mm with its min corner where the caller says. */
const roomRect = (x: number, y: number) =>
	expectOk(
		createPolygon([
			{ x, y },
			{ x: x + 4200, y },
			{ x: x + 4200, y: y + 3600 },
			{ x, y: y + 3600 },
		]),
	);

/**
 * A fresh leaf opened on one plan over a caller's own deps, sized like a real pane.
 *
 * BOTH sizings, and the second is not optional here: `ResponsiveEditorShell` reads its root's
 * `clientWidth` and jsdom answers 0, which `layoutModeFor` correctly calls `unsupported` — no
 * canvas at all — and the canvas element itself then needs a box before a pointer drag can be
 * projected into world millimetres. `mountPlanEditor` does exactly this pair for the same
 * reason; a view helper that did only the first would draw a stage no gesture could reach.
 */
async function openOn(planId: string, viewDeps: PlanEditorDeps): Promise<PlanEditorView> {
	const view = new PlanEditorView(new FakeLeaf() as never, viewDeps);
	openViews.push(view);
	await view.setState({ planId }, {} as never);
	await view.onOpen();
	await settle();
	sizedShellRoot(view.contentEl);
	await settle();
	const canvas = view.contentEl.querySelector<HTMLElement>('.rp-plan-canvas');
	if (canvas !== null) {
		placeAt(canvas, 0, 0, 800, 600);
		resizeTo(canvas, 800, 600);
		await settle();
	}
	return view;
}

/** Every room the floor summary lists, as `[id, name]` pairs in the order drawn. */
function roomRows(view: PlanEditorView): [string, string][] {
	return [...view.contentEl.querySelectorAll<HTMLElement>('.rp-room-list__row')].map((row) => [
		row.dataset['rpId'] ?? '',
		row.textContent?.trim() ?? '',
	]);
}

/** One element by selector, asserted rather than narrowed at each call site. */
function must<E extends HTMLElement>(view: PlanEditorView, selector: string): E {
	const found = view.contentEl.querySelector<E>(selector);
	if (found === null) throw new Error(`expected ${selector} in the mounted leaf`);
	return found;
}

/** Click one room's row and read back what the Room Inspector then shows. */
async function inspect(view: PlanEditorView, zoneId: string): Promise<string[]> {
	const row = must<HTMLButtonElement>(view, `.rp-room-list__row[data-rp-id="${zoneId}"]`);
	row.click();
	await settle();
	const body = must(view, '.rp-room-inspector');
	return [
		body.dataset['rpId'] ?? '',
		body.querySelector('.rp-editor-panel-title')?.textContent?.trim() ?? '',
		body.querySelector('.rp-editor-inspector-fields')?.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '',
	];
}

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
				...reopenDeps(),
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

		// The same rooms, in the same order, with the same id — and the same facts under the
		// Inspector's own heading, which is where the type, the floor and the derived area are
		// read. Compared against the FIRST mount's readings rather than against literals, so
		// this stays an assertion about reopening rather than a second transcription of the
		// fixture.
		expect(roomRows(second)).toEqual(rowsBefore);
		expect(rowsBefore).toHaveLength(2);
		expect(await inspect(second, kitchenId)).toEqual(inspectedBefore);
		// The reading being compared is a real one, not two empty strings agreeing — and it
		// covers every fact the title claims, the AREA included: `formatArea` renders
		// 4200 x 3600 mm as `15.12 m²`, so a build that stopped rendering the area would
		// otherwise leave both readings equal and this case green.
		expect(inspectedBefore[1]).toBe('Kitchen');
		expect(inspectedBefore[2]).toContain(t('en', 'editor.zone-type.Room'));
		expect(inspectedBefore[2]).toContain('Ground floor');
		expect(inspectedBefore[2]).toContain('15.12 m²');
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

	/**
	 * **Design spec §8's third reload clause: "a draft in the room store is never persisted
	 * (the store is per leaf and dies with it — asserted by reopening and finding no draft)".**
	 *
	 * `RoomDraftStore` is the one piece of editor state that is neither a query result nor a
	 * command: a rectangle, a name, two field drafts and a checkbox, held in a Pinia store so
	 * that the canvas and the form can write the same draft (the add-room increment's §2.2).
	 * Everything else on screen is re-read at mount, so a reopen showing it again would mean
	 * the vault held it; this draft is the one thing that could survive by being held somewhere
	 * it should not be.
	 *
	 * Driven through the real doors — Add → Room, a pointer drag on the canvas, a typed name —
	 * and abandoned by `onClose()` with no Create, which is a user closing the tab mid-gesture.
	 * Leaf A is asserted to HOLD all of it first: that is what makes the absences below
	 * assertions rather than a description of a leaf where nothing happened, and it is the
	 * measurement recorded in the task report (pointing the four closing assertions at `first`
	 * instead of `second` reddens all four).
	 */
	it('a room draft abandoned by closing the leaf is not persisted and not restored', async () => {
		const { planId, zones, viewDeps } = await reopenFixture();

		const first = await openOn(planId, viewDeps);
		must<HTMLButtonElement>(first, 'button[data-rp-action="add"]').click();
		await settle();
		must<HTMLButtonElement>(first, '[data-rp-entry="room"]').click();
		await settle();

		// The add-room suite's own drag: (100,100) to (520,480) at the default camera is world
		// (520,520) to (4720,4320), a 4200 x 3800 rectangle. Three intermediate moves and a
		// release at the last one's coordinates, which is the grammar a mouse actually sends.
		const canvas = must(first, '.rp-plan-canvas');
		pointer(canvas, 'pointerdown', 100, 100);
		pointer(canvas, 'pointermove', 240, 230);
		pointer(canvas, 'pointermove', 380, 350);
		pointer(canvas, 'pointermove', 520, 480);
		pointer(canvas, 'pointerup', 520, 480);
		await settle();

		const name = must<HTMLInputElement>(first, 'input.rp-new-room__name');
		name.value = 'Utility room 2';
		name.dispatchEvent(new Event('input', { bubbles: true }));
		await settle();

		// Leaf A really is holding a complete, uncommitted draft — the premise every absence
		// below rests on.
		expect(runtimeOfView(first).roomDraft.rect).toEqual({ x: 520, y: 520, width: 4200, depth: 3800 });
		expect(runtimeOfView(first).roomDraft.name).toBe('Utility room 2');
		expect(first.contentEl.querySelector('.rp-new-room')).not.toBeNull();

		// The tab is closed mid-gesture. Create was never pressed.
		await first.onClose();
		await settle();

		const second = await openOn(planId, viewDeps);

		// Nothing was written — a draft is not a command, so the vault never heard of it.
		expect(expectOk(await zones.listByPlan(planId as never)).loaded).toHaveLength(2);
		// And nothing was restored: no form, no banner, no rectangle, and the leaf opens in
		// Select rather than back inside the task the previous leaf was in.
		expect(second.contentEl.querySelector('.rp-new-room')).toBeNull();
		expect(second.contentEl.querySelector('.rp-task-banner')).toBeNull();
		expect(runtimeOfView(second).roomDraft.rect).toBeNull();
		expect(runtimeOfView(second).activeToolId.value).toBe('select');
	});
});
