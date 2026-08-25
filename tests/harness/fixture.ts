import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';
import { useEditorStore } from '../../src/presentation/stores/EditorStore';
import { useWorkspaceStore } from '../../src/presentation/stores/WorkspaceStore';
import { useSelectionStore } from '../../src/presentation/editor/selection/selection-store';
import type { PlanEditorContext } from '../../src/presentation/editor/PlanEditorContext';
import { HARNESS_PLAN, HARNESS_ZONES, harnessDeps } from './planEditor';

/**
 * ONE seeded world, behind every entry the harness index mounts.
 *
 * Real components read stores — `StatusBar` alone reads `useProjectStore` and
 * `useEditorStore` — so mounting one in isolation needs state behind it. A single fixture
 * rather than per-entry setup buys two things: what the designer sees is REPRODUCIBLE, and
 * two components on one prototype AGREE, because they read the same plan rather than two
 * invented ones that differ in a way nobody notices until production.
 *
 * The cost, stated rather than hidden: a component state this world does not cover cannot be
 * shown without extending it, and extending it changes what every other entry draws.
 *
 * The plan and zones come from `planEditor.ts` rather than being declared here. A second set
 * would be a second derivation answering differently the day one of them is edited.
 *
 * **Reproducibility needs a reset, not just a seed, which is why this is two functions.**
 * `seedFixture()`, below `reseedFixture` in this file, is called exactly ONCE by `page.ts`,
 * to build and install the Pinia the index app runs on for its whole lifetime — every entry
 * the index opens afterwards shares that one Pinia, and `app.use()` cannot be re-run to swap
 * it for a fresh one (Vue installs a plugin for the app's lifetime, and every component
 * resolves through it). So the "one seeded world" claim above does not hold merely because
 * `seedFixture()` ran once; it holds because `IndexPage.vue`'s `open()` calls
 * `reseedFixture()` — THIS function — at the top of every navigation, putting the SAME Pinia
 * back to these starting values before the next entry mounts. Without that call, an entry
 * that mutates a store — `PlanEditorRoot` mutates the editor store on pan and zoom,
 * `LayersPanel` mutates the workspace store, `SelectTool` mutates the selection store —
 * leaves that mutation for the next entry to draw against, and "reproducible" stops being
 * true.
 *
 * **Which stores that is, and how the set was established.** Every `defineStore(...)` call
 * under `src/presentation/` (grepped, five hits) is a store an entry mounted through the
 * index can reach: `ProjectStore`, `EditorStore` and `WorkspaceStore` (module singletons,
 * reached the moment any component calls `useProjectStore()` / `useEditorStore()` /
 * `useWorkspaceStore()`), `selection-store` (same shape), and `inspector-store` — whose
 * `createInspectorStoreDefinition(deps)` is NOT a module singleton, and is deliberately not
 * reset here. Its own header explains why a second call against one active Pinia instance
 * does not rebind it: the store Pinia already has under the id `'inspector'` is what every
 * caller gets back, deps included, so resetting it from outside would need the SAME deps the
 * composition root closed over at first mount — which this module does not hold and has no
 * business inventing a second copy of. What actually needs resetting is its visible field,
 * `dto`, and that self-corrects without help: `InspectorPanel.vue`'s
 * `watch(selectedIds, ..., { immediate: true })` re-runs `hydrateFrom` the moment the panel
 * (re)mounts, and `hydrateFrom([])` sets `dto` to `{ kind: 'empty' }` SYNCHRONOUSLY — before
 * its first `await` — so as long as `selection` is reset to `[]` first, the next mount of
 * `InspectorPanel` never has a chance to show a stale `dto`.
 *
 * **That self-correction rests on a precondition this paragraph did not state:
 * `InspectorPanel.vue` must be the ONLY reader of `dto`.** True today —
 * `runtime.ts`'s `inspectorDto` slot reaches `InspectorPanel.vue` and nothing else — but a
 * second reader added anywhere in `src/` would break the exclusion silently, since nothing
 * here re-runs when one is. `tests/harness/fixture.test.ts` checks the CATEGORY rather than
 * this one file: a scan of `.inspectorDto` — the property-read spelling, not the
 * declaration — across every file under `src/` must find exactly one occurrence, in
 * `InspectorPanel.vue`. A second occurrence anywhere fails it, present or future, without
 * naming that second file in advance; a reader reached through destructuring
 * (`const { inspectorDto } = runtime`) instead of a `.inspectorDto` property read is the
 * scan's stated limit, the same shape as the `.css`-import scan's own stated limit in
 * `harness.test.ts`.
 *
 * That leaves four stores to reset by hand, which is what this function does. `CommandHistory`
 * and `ToolManager`
 * (`runtime.ts`) are NOT in this set: they are plain objects `provideEditorRuntime` builds
 * fresh in `PlanEditorRoot`'s `setup()` on every mount, not Pinia state, so undo/redo history
 * cannot leak between entries either.
 *
 * A store added later is a store this reset will miss — the risk this comment exists to
 * flag for the next reader, since `npm run analyze`'s dead-export check cannot see "a ref a
 * component writes to and this function does not reset".
 */
export function reseedFixture(): void {
	const project = useProjectStore();

	// `reset()` first: it bumps `latestHydration`, which invalidates any read the PREVIOUS
	// entry's `PlanEditorRoot.hydrate()` left in flight, so a slow-resolving harness query
	// cannot land on top of the values assigned right after it.
	project.reset();

	// Assigned directly rather than through `hydrate`: `harnessDeps().queries` answers both
	// queries perfectly well with no vault behind them, so that is not the reason. The real
	// one is that `hydrate` is ASYNCHRONOUS (it awaits two query promises) and this function
	// is not — every index entry needs a world in place before its first synchronous mount,
	// not one that lands a tick later. What a component needs is the post-hydration STATE,
	// which is this.
	project.plan = HARNESS_PLAN;
	project.zones = new Map(HARNESS_ZONES.map((zone) => [zone.id, zone]));
	project.status = 'ready';

	useEditorStore().reset();
	useWorkspaceStore().reset();
	useSelectionStore().clear();
}

/**
 * Builds and installs the ONE Pinia the harness index app runs on for its whole lifetime,
 * then seeds it — `page.ts` calls this exactly once, when the app is created, because
 * `app.use()` installs a plugin for the app's lifetime and cannot be re-run to swap it for a
 * fresh one. Every later entry the index opens shares this same Pinia; what puts it back to
 * these starting values before each of THOSE entries is `reseedFixture()` above, called from
 * `IndexPage.vue`'s `open()`, not a second call to this function.
 */
export function seedFixture(): Pinia {
	const pinia = createPinia();

	// Process-wide: the last call to `setActivePinia` wins, so a SECOND `seedFixture()` call
	// — a second test in this file, say — replaces which Pinia `useXStore()` resolves to
	// outside an explicit `app.use(pinia)`. Harmless here: nothing in this codebase creates a
	// second Pinia while an index app built from the first one is still on screen, so the
	// global stays pointed at the one this function just built for as long as that app lives
	// — which is what lets `reseedFixture()` call `useXStore()` from `open()`, outside any
	// component's injection context, and still reach the SAME stores every mounted component
	// gets via `app.use(pinia)`'s injection.
	setActivePinia(pinia);
	reseedFixture();

	return pinia;
}

/**
 * The editor context, which is NOT optional and is easy to miss.
 *
 * `src/presentation/views/PlanEditorView.ts` does three things when it mounts: `createPinia()`,
 * `use(VueKonva)` and **`provide(PLAN_EDITOR_CONTEXT, …)`**. Without the third, every component
 * that calls `usePlanEditorContext()` throws — `PlanEditorRoot`, `BackgroundLayer`, anything
 * using `useThemeTokens` — so the index would render the named failure for exactly the
 * components a designer most wants to look at, and a prototype composing one would too.
 *
 * Built from `harnessDeps()` rather than from a second set of stubs, for the same reason the
 * plan and zones come from `planEditor.ts`: a second derivation answers differently the day one
 * of them is edited.
 */
export function harnessEditorContext(): PlanEditorContext {
	const deps = harnessDeps();

	return {
		planId: HARNESS_PLAN.id,
		queries: deps.queries,
		// Design slice 8's write side, which arrived on `main` while this branch was running.
		// Taken from `harnessDeps()` like everything else here rather than stubbed: it answers
		// `settings.unrecovered` for every write, which is the honest result for a page with no
		// vault — a mock's gestures fail visibly instead of pretending to persist.
		commands: deps.commands,
		vault: deps.vault,
		onThemeChange: deps.onThemeChange,
		onPlanChanged: (listener) => deps.onPlanChanged(HARNESS_PLAN.id, listener),
	};
}
