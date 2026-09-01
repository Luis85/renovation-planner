import Konva from 'konva';
import { createPinia, type Pinia } from 'pinia';
import VueKonva from 'vue-konva';
import { mount, type VueWrapper } from '@vue/test-utils';
import { PLAN_EDITOR_CONTEXT, type PlanEditorContext } from '../../src/presentation/editor/PlanEditorContext';
import PlanEditorRoot from '../../src/presentation/editor/PlanEditorRoot.vue';
import {
	unavailablePlanEditorCommands,
	type PlanEditorCommandServices,
} from '../../src/presentation/editor/planEditorCommands';
import type { PlanDto, ZoneDto } from '../../src/presentation/read-models/PlanDto';
import { fakeQueries, FIXTURE_PLAN, FIXTURE_ZONES } from './planFixtures';

// Re-exported rather than moved outright: it lives with the fixtures so a NODE test can
// reach it without loading Vue and Konva, and the jsdom suites already import it from here.
export { fakeQueries } from './planFixtures';
import type { PlanEditorQueryServices } from '../../src/presentation/read-models/planEditorQueries';
import type { BackgroundVault } from '../../src/presentation/editor/layers/background/BackgroundRenderModel';
import { emptyBackgroundVault } from './background';
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
	/**
	 * How many of this plan's zone notes refused to load. Ignored when `queries` is supplied,
	 * like `plan` and `zones` are — a caller handing over the whole query bundle owns all of it.
	 */
	readonly unreadableZones?: number;
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
	/**
	 * Fire the injected catalogue-change subscription, as an asset command or an index
	 * rebuild would. Separate from `changePlan` because the two doors carry different
	 * events — a test that could only fire one could not tell them apart.
	 */
	readonly changeCatalogue: () => void;
	/** How many theme listeners are still registered — the unmount leak check. */
	readonly themeListeners: () => number;
	/** How many times the tree asked to close this leaf (`PlanEditorContext.closeLeaf`). */
	readonly closedLeaf: () => number;
	readonly unmount: () => void;
}


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

/**
 * How long `settleUntil` will wait before giving up.
 *
 * **A DEADLINE and not a round count, which is the whole fix**; the number below is chosen to
 * sit under vitest's 5000 ms default so a genuine regression still fails as this helper's own
 * named error rather than as an anonymous test timeout — the property the round bound was
 * really protecting.
 */
const SETTLE_BUDGET_MS = 4_000;

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
 *
 * **The bound was a round COUNT for four slices, and a count is the same mistake this
 * function exists to correct, moved up one level.** A round is four microtasks and one
 * `setTimeout(0)`, which Node clamps to about a millisecond — so fifty rounds is roughly
 * fifty milliseconds of wall clock, whatever the machine, while the work being waited on is
 * a cold Vite transform whose duration is entirely the machine's business. Measured rather
 * than reasoned: `openIndex('entry=prototype:ZonePanel')` settles in four to six rounds
 * locally, which reads as a tenfold margin and is nothing of the sort — it is five
 * milliseconds against fifty, and `verify (ubuntu-latest, 26)` spent all fifty and failed
 * while the three prototypes scanned before it passed.
 *
 * **Warming the entry module first was tried and is NOT sufficient**, which is what settled
 * the fix as a deadline rather than a pre-load. `HarnessEntry.component` is a real loader, so
 * awaiting it moves that one transform out of the polled window — and with the budget starved
 * to a single round `ZonePanel` still failed, because it is a template-only mock composing a
 * real `<StatusBar />` that the index registers through `defineAsyncComponent`. The nested
 * component resolves lazily, INSIDE the window, and no list of things to warm stays correct as
 * mocks compose more of them. A deadline needs no such list.
 *
 * `Date.now()` rather than `performance.now()`: this is a coarse bound on real work, the
 * numbers are milliseconds apart from each other, and jsdom gives the former unconditionally.
 */
export async function settleUntil(
	condition: () => boolean | Promise<boolean>,
	what: string,
): Promise<void> {
	// The predicate may be ASYNC: the slice-8 e2e rig waits on vault reads, and it grew its
	// own second copy of this loop — with a different budget and different failure
	// text — because the signature did not allow one. A flake fixed by raising the budget
	// here has to reach every caller, so there is one budget.
	const deadline = Date.now() + SETTLE_BUDGET_MS;
	for (;;) {
		// Asked BEFORE the deadline test, so a condition that became true during the final
		// `settle()` still returns rather than being thrown away by the clock — the same
		// re-check the round-bounded version made after its loop.
		if (await condition()) return;
		if (Date.now() >= deadline) {
			throw new Error(`Timed out after ${SETTLE_BUDGET_MS}ms waiting for: ${what}`);
		}
		await settle();
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
	let closedLeaf = 0;
	const planListeners = new Set<() => void>();
	const catalogueListeners = new Set<() => void>();

	// `plan` is `PlanDto | null | undefined` here: `undefined` means the option was
	// OMITTED (default to the fixture), `null` means the caller explicitly asked for no
	// plan at all (a broken reference — status `missing`). `??` cannot tell those apart —
	// it treats `null` as absent too — so this checks `undefined` on its own.
	const plan = options.plan === undefined ? FIXTURE_PLAN : options.plan;
	const context: PlanEditorContext = {
		planId: plan?.id ?? FIXTURE_PLAN.id,
		queries:
			options.queries ?? fakeQueries(plan, options.zones ?? FIXTURE_ZONES, options.unreadableZones),
		commands: options.commands ?? unavailablePlanEditorCommands(),
		vault: options.vault ?? emptyBackgroundVault(),
		onThemeChange: (listener) => {
			themeListeners.add(listener);
			return () => themeListeners.delete(listener);
		},
		onPlanChanged: (listener) => {
			planListeners.add(listener);
			return () => planListeners.delete(listener);
		},
		// Its OWN set, not an alias of the plan door's: the whole point of the third source is
		// that the two fire on different events, so a fixture that folded them together could
		// not tell a build that had merged them back from one that had not.
		onCatalogueChanged: (listener) => {
			catalogueListeners.add(listener);
			return () => catalogueListeners.delete(listener);
		},
		closeLeaf: () => {
			closedLeaf += 1;
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
		changeCatalogue: () => {
			for (const listener of catalogueListeners) listener();
		},
		themeListeners: () => themeListeners.size,
		closedLeaf: () => closedLeaf,
		unmount: () => {
			wrapper.unmount();
			host.remove();
		},
	};
}

/**
 * The harness with its canvas PROVEN present, which is what most cases actually want.
 *
 * `EditorHarness` types `canvasEl` and `stage` as nullable because the editor really does
 * mount without either — a plan that is missing, unreadable or still loading draws a message
 * instead — and a harness that pretended otherwise would be a fake kinder than the component.
 * That honesty then lands on every case that mounts an ORDINARY plan, where a canvas is not
 * in question, as two null checks per assertion. Asking once, here, is the same narrowing
 * those cases were each spelling by hand.
 */
export interface CanvasHarness extends EditorHarness {
	readonly canvasEl: HTMLElement;
	readonly stage: Konva.Stage;
}

/**
 * `mountPlanEditor`, plus the proof that a canvas mounted.
 *
 * It THROWS rather than asserting the type: a case that reaches for a stage the editor
 * declined to mount is a case whose premise is wrong, and it should say so where it mounted
 * rather than as a `TypeError` several assertions later. Use `mountPlanEditor` directly for
 * the states that draw no canvas.
 */
export async function mountPlanEditorCanvas(options: EditorHarnessOptions = {}): Promise<CanvasHarness> {
	const harness = await mountPlanEditor(options);
	const { canvasEl, stage } = harness;
	if (canvasEl === null || stage === null) {
		throw new Error('the editor mounted no canvas; use mountPlanEditor for a plan that draws none');
	}
	return { ...harness, canvasEl, stage };
}

/** Every Konva layer in the stage, by the `name` its component set. */
export function layerNames(stage: Konva.Stage): string[] {
	return stage.getChildren().map((layer) => layer.name());
}

/** Every `Konva.Line` under the zone layer, in scene order. */
export function zoneLines(stage: Konva.Stage): Konva.Line[] {
	return stage.findOne<Konva.Layer>('.zone')?.find('Line') ?? [];
}
