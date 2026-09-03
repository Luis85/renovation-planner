import Konva from 'konva';
import { createPinia, type Pinia } from 'pinia';
import VueKonva from 'vue-konva';
import { mount, type VueWrapper } from '@vue/test-utils';
import { PLAN_EDITOR_CONTEXT, type PlanEditorContext } from '../../src/presentation/editor/PlanEditorContext';
import PlanEditorRoot from '../../src/presentation/editor/PlanEditorRoot.vue';
import { EDITOR_RUNTIME, type EditorRuntime } from '../../src/presentation/editor/runtime';
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
// `settle` is imported for local use below (`mountPlanEditor`); `settleUntil` is re-exported
// without a local binding, since nothing in this file calls it directly. Both now live in the
// dependency-free `tests/helpers/settle.ts` rather than here, for the same reason `fakeQueries`
// is re-exported from `./planFixtures` above: `tests/harness/planEditor.ts` needs `settleUntil`
// and may not import Konva, Pinia, `@vue/test-utils` or `tests/helpers/canvas.ts`'s native
// `@napi-rs/canvas` binding — all of which this file pulls in. `settle.ts`'s own header carries
// the whole story, including the browser-bundle failure this split was written to fix.
import { settle } from './settle';

export { settle, settleUntil } from './settle';


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
	/**
	 * Fire the injected vault-file subscription for one path, as Obsidian's `create`, `modify`,
	 * `delete` or `rename` would. Its own door and not an alias of `changePlan`: the whole point
	 * of this source is that a background file moves without the subject being re-read, so a
	 * fixture that folded the two together could not tell a build that had merged them back.
	 */
	readonly changeFile: (path: string) => void;
	/** How many vault-file listeners are still registered — the unmount leak check. */
	readonly fileListeners: () => number;
	/** How many theme listeners are still registered — the unmount leak check. */
	readonly themeListeners: () => number;
	/** How many times the tree asked to close this leaf (`PlanEditorContext.closeLeaf`). */
	readonly closedLeaf: () => number;
	/** How many times the tree asked to focus this leaf (`PlanEditorContext.focusLeaf`). */
	readonly focusedLeaf: () => number;
	/**
	 * `ResponsiveEditorShell`'s own root — the element that carries `data-layout`, the one the
	 * shell's `ResizeObserver` watches, and therefore the one a case resizes to drive a layout
	 * change (`resizeTo(harness.rootEl, 460, 800)`).
	 *
	 * NOT the wrapper's element: `PlanEditorRoot`'s outermost div is `.renovation-plan-editor`,
	 * which holds the shell and `DialogHost` as siblings, and resizing THAT would tell the
	 * observer nothing. Non-nullable because the shell renders unconditionally — a mount that
	 * did not produce one is a broken tree rather than a state, so `mountPlanEditor` throws
	 * where it looks for it.
	 */
	readonly rootEl: HTMLElement;
	readonly unmount: () => void;
}

/**
 * The width and height a mounted editor's shell root is given, standing in for the pane
 * Obsidian would have laid out. 1280 is `layoutModeFor`'s `full` — the desktop leaf every
 * case that says nothing about layout means — and it is the width one of the two harness
 * captures uses, so the suite and the pictures agree on what "an ordinary pane" is.
 */
const SHELL_WIDTH_PX = 1280;
const SHELL_HEIGHT_PX = 800;

/**
 * Give a just-mounted editor's shell root a real width and tell its observer.
 *
 * **Every jsdom mount path owes this call**, which is why it is a function rather than two
 * lines repeated: `ResponsiveEditorShell` measures `root.clientWidth` in `onMounted` and on
 * every observer callback, jsdom answers 0 for both, and `layoutModeFor(0)` is `unsupported` —
 * a state that draws no canvas at all. The real `ResizeObserver` reports once on `observe()`
 * with the element's actual size, so nothing in a browser or a vault is ever in that state for
 * longer than a frame; the fake in `layout.ts` deliberately fires only when a test says so.
 *
 * It THROWS when there is no shell root, rather than answering `null` for callers to check: the
 * shell renders unconditionally, so its absence means the tree failed to mount and every
 * assertion after this point would be about markup that is not there.
 */
export function sizedShellRoot(container: HTMLElement): HTMLElement {
	const root = container.querySelector<HTMLElement>('.rp-editor-shell');
	if (root === null) {
		throw new Error('the mounted editor has no .rp-editor-shell root to size');
	}
	resizeTo(root, SHELL_WIDTH_PX, SHELL_HEIGHT_PX);
	return root;
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
	let focusedLeaf = 0;
	const planListeners = new Set<() => void>();
	const catalogueListeners = new Set<() => void>();
	const fileListeners = new Set<(path: string) => void>();

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
		// Its OWN set again, for the reason the catalogue door gives: this one carries a PATH and
		// fires for files no domain event ever mentions.
		onVaultFileChanged: (listener) => {
			fileListeners.add(listener);
			return () => fileListeners.delete(listener);
		},
		closeLeaf: () => {
			closedLeaf += 1;
		},
		// Counted beside `closeLeaf`, not stubbed: `UnsupportedWidthNotice`'s only action calls
		// it, and a no-op here would let a build that wired the button to nothing pass.
		focusLeaf: () => {
			focusedLeaf += 1;
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

	// BEFORE the settle that lets hydration mount a canvas, because the canvas is one of the
	// things a layout mode decides. `ResponsiveEditorShell` measures its root in `onMounted`
	// and jsdom answers 0 for every `clientWidth`, which `layoutModeFor` reads — correctly — as
	// `unsupported`: no canvas at all. So every mounted editor in the suite would sit in a
	// state no real pane is ever in unless the harness gives its root a width, exactly as it
	// already gives the canvas container one two blocks below.
	const rootEl = sizedShellRoot(wrapper.element as HTMLElement);

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
		changeFile: (path: string) => {
			for (const listener of fileListeners) listener(path);
		},
		fileListeners: () => fileListeners.size,
		themeListeners: () => themeListeners.size,
		closedLeaf: () => closedLeaf,
		focusedLeaf: () => focusedLeaf,
		rootEl,
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

/**
 * The `EditorRuntime` a mounted `PlanEditorRoot` built — for a test that needs to write
 * `renderState` or call a runtime method directly, rather than driving the gesture that would
 * produce the same write.
 *
 * `PlanEditorRoot.setup()` calls `provideEditorRuntime(context)`, which `provide()`s the
 * runtime on that component's OWN internal instance rather than only on its descendants' —
 * so `wrapper.vm.$.provides` (the raw `ComponentInternalInstance`, which the public instance
 * proxy exposes under `$`) already holds it once `PlanEditorRoot` has run its `setup()`, with
 * no need for a probe component injected into its fixed template.
 */
export function runtimeOf(harness: EditorHarness): EditorRuntime {
	const instance = (harness.wrapper.vm as unknown as { $: { provides: Record<symbol, unknown> } }).$;
	const runtime = instance.provides[EDITOR_RUNTIME as unknown as symbol];
	if (runtime === undefined) {
		throw new Error('expected the mounted tree to have provided an EditorRuntime');
	}
	return runtime as EditorRuntime;
}

/** Every Konva layer in the stage, by the `name` its component set. */
export function layerNames(stage: Konva.Stage): string[] {
	return stage.getChildren().map((layer) => layer.name());
}

/** Every `Konva.Line` under the zone layer, in scene order. */
export function zoneLines(stage: Konva.Stage): Konva.Line[] {
	return stage.findOne<Konva.Layer>('.zone')?.find('Line') ?? [];
}
