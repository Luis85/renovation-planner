import Konva from 'konva';
import { createPinia, type Pinia } from 'pinia';
import VueKonva from 'vue-konva';
import { mount, type VueWrapper } from '@vue/test-utils';
import { ok } from '../../src/core/result/Result';
import { PLAN_EDITOR_CONTEXT, type PlanEditorContext } from '../../src/presentation/editor/PlanEditorContext';
import PlanEditorRoot from '../../src/presentation/editor/PlanEditorRoot.vue';
import {
	unavailablePlanEditorCommands,
	type PlanEditorCommandServices,
} from '../../src/presentation/editor/planEditorCommands';
import type { PlanDto, ZoneDto } from '../../src/presentation/read-models/PlanDto';
import { FIXTURE_PLAN, FIXTURE_ZONES } from './planFixtures';
import type { PlanEditorQueryServices } from '../../src/presentation/read-models/planEditorQueries';
import type { BackgroundVault } from '../../src/presentation/editor/layers/background/BackgroundRenderModel';
import { installCanvas } from './canvas';
import { installObsidianDom } from './dom';
import { installResizeObserver, placeAt, resizeTo } from './layout';


/**
 * The REAL Plan Editor tree — real Vue, real Pinia, real vue-konva, real Konva — mounted
 * against fakes for the two things a test has to supply: what the queries answer, and what
 * the vault holds.
 *
 * Nothing about Konva is stubbed, and that is deliberate. Stubbing `<VLayer>`/`<VLine>` at
 * the test-utils level would let every assertion here be about the props a component
 * passed, which is a claim about this codebase's intent rather than about what Konva does
 * with it — and the scene-structure rule (§17's fixed order, layers inside a group) is
 * exactly the kind of thing Konva has an opinion about. `tests/helpers/canvas.ts` is what
 * makes real Konva possible under jsdom.
 */

export interface EditorHarnessOptions {
	readonly plan?: PlanDto | null;
	readonly zones?: readonly ZoneDto[];
	readonly queries?: PlanEditorQueryServices;
	/** The write side; defaults to the refusal commands, for tests that dispatch nothing. */
	readonly commands?: PlanEditorCommandServices;
	readonly vault?: BackgroundVault;
}

export interface EditorHarness {
	readonly wrapper: VueWrapper;
	/** The Pinia instance this leaf's stores live in — for driving store state directly. */
	readonly pinia: Pinia;
	/**
	 * The canvas container the camera listens on, and the Konva stage inside it — both
	 * `null` when the editor mounted WITHOUT a canvas, which it does for a plan that is
	 * missing, unreadable or still loading. Nullable rather than asserted, because a harness
	 * that pretended a stage existed there would be a fake kinder than the component.
	 */
	readonly canvasEl: HTMLElement | null;
	readonly stage: Konva.Stage | null;
	/** Fire the injected theme-change subscription, as Obsidian's `css-change` would. */
	readonly changeTheme: () => void;
	/** Fire the injected plan-change subscription, as a committed command would. */
	readonly changePlan: () => void;
	/** How many theme listeners are still registered — the unmount leak check. */
	readonly themeListeners: () => number;
	readonly unmount: () => void;
}

/**
 * The full query stack, exported so a case that wants ONE member to behave differently
 * overrides that member rather than hand-rolling a stack.
 *
 * Hand-rolled partial stacks are this repository's fake-too-thin rule waiting to happen, and
 * it happened: design slice 17's first draft of `planEditorFailure.test.ts` declared two
 * members, one of them under a name (`listZonesForPlan`) the real interface does not have, and
 * every mount logged `context.queries.listAssets is not a function` while the assertions
 * passed. Spreading this keeps a new member reaching every caller the day it is written.
 */
export function fakeQueries(plan: PlanDto | null, zones: readonly ZoneDto[] = []): PlanEditorQueryServices {
	return {
		getPlan: () => Promise.resolve(ok(plan)),
		findZonesByPlan: () => Promise.resolve(ok(zones)),
		getRequirementsForZone: () => Promise.resolve(ok([])),
		listAssets: () => Promise.resolve(ok([])),
		listRequirementsReferencing: () => Promise.resolve(ok([])),
		listReassignmentTargets: () => Promise.resolve(ok([])),
	};
}

/** A vault with nothing in it — enough for a plan whose background is `null`. */
const EMPTY_VAULT = {
	getAbstractFileByPath: () => null,
	getResourcePath: () => '',
	readBinary: () => Promise.resolve(new ArrayBuffer(0)),
} as unknown as BackgroundVault;

/**
 * Two ticks, not one. Hydration awaits two query promises before it sets `ready`, and Vue
 * then needs its own flush to mount the canvas that appears as a result — a single
 * `nextTick` resolves before the second query and the canvas is not there yet.
 */
export async function settle(): Promise<void> {
	for (let index = 0; index < 4; index += 1) await Promise.resolve();
	await new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

/** How many `settle()` rounds `settleUntil` will spend before giving up. */
const SETTLE_ROUNDS = 50;

/**
 * `settle()` until something is TRUE, rather than a fixed number of times.
 *
 * `settle()` alone is a fixed four microtasks and one macrotask, which is enough for Vue
 * and for a resolved query but NOT for a real image decode: `tests/helpers/canvas.ts` puts
 * `@napi-rs/canvas` behind `<img>.decode()`, so a background landing is real work whose
 * duration depends on the machine. That made "the fast load has landed" a race — it failed
 * once in a full-suite run while a PDF test was rasterizing two million pixels beside it,
 * and passed on every isolated run, which is the signature of a fixed-tick wait rather than
 * of a defect in the code under test.
 *
 * Bounded and NAMED on failure, both deliberately: an unbounded loop turns a real
 * regression into a hung suite, and "condition never held" with no subject is the least
 * useful failure a test can produce.
 */
export async function settleUntil(
	condition: () => boolean | Promise<boolean>,
	what: string,
): Promise<void> {
	// The predicate may be ASYNC: the slice-8 e2e rig waits on vault reads, and it grew its
	// own second copy of this loop — with a different round budget and different failure
	// text — because the signature did not allow one. A flake fixed by raising the budget
	// here has to reach every caller, so there is one budget.
	for (let round = 0; round < SETTLE_ROUNDS; round += 1) {
		if (await condition()) return;
		await settle();
	}
	if (!(await condition())) {
		throw new Error(`Timed out after ${SETTLE_ROUNDS} settle rounds waiting for: ${what}`);
	}
}

export function installEditorEnvironment(): void {
	installObsidianDom();
	installCanvas();
	installResizeObserver();
}

/**
 * Mounts and waits for hydration, so the canvas exists by the time this resolves — the
 * root only mounts `PlanCanvas` once the store reports `ready`, which is a promise tick
 * after mount.
 */
export async function mountPlanEditor(options: EditorHarnessOptions = {}): Promise<EditorHarness> {
	installEditorEnvironment();

	const themeListeners = new Set<() => void>();
	const planListeners = new Set<() => void>();

	// `plan` is `PlanDto | null | undefined` here: `undefined` means the option was
	// OMITTED (default to the fixture), `null` means the caller explicitly asked for no
	// plan at all (a broken reference — status `missing`). `??` cannot tell those apart —
	// it treats `null` as absent too — so this checks `undefined` on its own.
	const plan = options.plan === undefined ? FIXTURE_PLAN : options.plan;
	const context: PlanEditorContext = {
		planId: plan?.id ?? FIXTURE_PLAN.id,
		queries: options.queries ?? fakeQueries(plan, options.zones ?? FIXTURE_ZONES),
		commands: options.commands ?? unavailablePlanEditorCommands(),
		vault: options.vault ?? EMPTY_VAULT,
		onThemeChange: (listener) => {
			themeListeners.add(listener);
			return () => themeListeners.delete(listener);
		},
		onPlanChanged: (listener) => {
			planListeners.add(listener);
			return () => planListeners.delete(listener);
		},
	};

	// Attached to the document, because Konva measures its container and `getComputedStyle`
	// answers about a detached element differently — the theme resolver reads through it.
	const host = document.createElement('div');
	document.body.appendChild(host);

	const pinia = createPinia();
	const wrapper = mount(PlanEditorRoot, {
		attachTo: host,
		global: { plugins: [pinia, VueKonva], provide: { [PLAN_EDITOR_CONTEXT as symbol]: context } },
	});

	await settle();

	const found = wrapper.find('.rp-plan-canvas');
	const canvasEl = found.exists() ? (found.element as HTMLElement) : null;
	if (canvasEl !== null) {
		// jsdom lays nothing out, so the stage would be 0x0 and every assertion about what it
		// contains would be made against a scene that could not have drawn.
		placeAt(canvasEl, 0, 0, 800, 600);
		resizeTo(canvasEl, 800, 600);
		await settle();
	}

	return {
		wrapper,
		pinia,
		canvasEl,
		// Taken only when a canvas was mounted: `Konva.stages` is process-global, so the last
		// entry would otherwise be some previous test file stage.
		stage: canvasEl === null ? null : (Konva.stages.at(-1) as Konva.Stage),
		changeTheme: () => {
			for (const listener of themeListeners) listener();
		},
		changePlan: () => {
			for (const listener of planListeners) listener();
		},
		themeListeners: () => themeListeners.size,
		unmount: () => {
			wrapper.unmount();
			host.remove();
		},
	};
}

/** Every Konva layer in the stage, by the `name` its component set. */
export function layerNames(stage: Konva.Stage): string[] {
	return stage.getChildren().map((layer) => layer.name());
}

/** Every `Konva.Line` under the zone layer, in scene order. */
export function zoneLines(stage: Konva.Stage): Konva.Line[] {
	return stage.findOne<Konva.Layer>('.zone')?.find('Line') ?? [];
}
