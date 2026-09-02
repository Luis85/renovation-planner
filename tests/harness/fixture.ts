import { createPinia, setActivePinia, storeToRefs, type Pinia } from 'pinia';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';
import { useEditorStore } from '../../src/presentation/stores/EditorStore';
import { useWorkspaceStore } from '../../src/presentation/stores/WorkspaceStore';
import { useSelectionStore } from '../../src/presentation/editor/selection/selection-store';
import { useDialogStore } from '../../src/presentation/dialogs/dialog-store';
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
 * `seedFixture()`, below `reseedFixture` in this file, is called ONCE PER INDEX APP — by
 * `page.ts` on the real page, and by `indexApp.ts` for each index a test mounts — to build and
 * install the Pinia that app runs on for its whole lifetime. Every entry the index opens
 * afterwards shares that one Pinia, and `app.use()` cannot be re-run to swap
 * it for a fresh one (Vue installs a plugin for the app's lifetime, and every component
 * resolves through it). So the "one seeded world" claim above does not hold merely because
 * `seedFixture()` ran once; it holds because `IndexPage.vue`'s `open()` calls
 * `reseedFixture()` — THIS function — on every navigation, putting the SAME Pinia back to
 * these starting values before the next entry mounts. It runs once the outgoing entry's own
 * teardown has actually completed rather than at the top of `open()` — see the call site's
 * own comment for why that position is load-bearing. Without the call itself, an entry
 * that mutates a store — `PlanEditorRoot` mutates the editor store on pan and zoom,
 * `LayersPanel` mutates the workspace store, `SelectTool` mutates the selection store —
 * leaves that mutation for the next entry to draw against, and "reproducible" stops being
 * true.
 *
 * **Which stores that is, and how the set was established.** Every `defineStore(...)` call
 * under `src/presentation/` (grepped — six today, and the count is stated because it moved:
 * design slice 15's `dialog` store is the one this paragraph's last sentence warned about) is a store an entry mounted through the
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
 * That leaves five stores to put back by hand, which is what this function does — four reset,
 * and the dialog abandoned. `CommandHistory`
 * and `ToolManager`
 * (`runtime.ts`) are NOT in this set: they are plain objects `provideEditorRuntime` builds
 * fresh in `PlanEditorRoot`'s `setup()` on every mount, not Pinia state, so undo/redo history
 * cannot leak between entries either.
 *
 * A store added later is a store this reset will miss — the risk this comment exists to
 * flag for the next reader, since `npm run analyze`'s dead-export check cannot see "a ref a
 * component writes to and this function does not reset". That has now happened once, through a
 * MERGE rather than an edit: the `dialog` store landed on `main` while this file was being
 * written on a branch, so each side was complete and correct alone. `fixture.test.ts` drives
 * the abandonment, which is the only part of this a test can hold; the warning stands for the
 * seventh store.
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
	//
	// **Deep COPIES, not the fixture objects themselves.** Pinia state is a deep reactive
	// proxy, so a write through it — `useProjectStore().plan.name = 'x'`, a zone's
	// `points[0].x` — lands on whatever object was assigned here. Assigning the module
	// constants therefore let a prototype edit the source of truth: the mutation survived
	// this reset, because the next call re-seeded the SAME, now-mutated, objects, and every
	// later entry inherited it. That became reachable the moment a mock was allowed to carry
	// a `<script setup>` and reach a store. `structuredClone` rather than a hand-written copy
	// because these are plain data all the way down (`PlanDto`, `ZoneDto` and its `points`),
	// and a hand-written one would need editing every time a nested field is added — the
	// class of omission nothing here would notice.
	//
	// This covers the SYNCHRONOUS seed and nothing else. The other way the constants reach
	// reactive state is `PlanEditorRoot.hydrate()`, through `harnessDeps().queries` — which a
	// scripted prototype composing the editor takes, replacing everything assigned here. That
	// seam is closed at the query boundary, in `planEditor.ts`, and the two clones are
	// independent: neither path goes through the other.
	project.plan = structuredClone(HARNESS_PLAN);
	project.zones = new Map(structuredClone(HARNESS_ZONES).map((zone) => [zone.id, zone]));
	project.status = 'ready';

	useEditorStore().reset();
	useWorkspaceStore().reset();
	useSelectionStore().clear();

	/*
	 * The dialog store: FORGOTTEN, not resolved.
	 *
	 * It is here because `DialogHost` unmounts without settling when the entry it belongs to
	 * leaves the stage, while the index keeps one Pinia for its whole life. So the next entry
	 * inherited an open dialog and its first `openDialog` threw `DialogStackingError` — an
	 * entry that worked or not depending on what had been opened before it. Which is precisely
	 * what the paragraph above predicted: this store arrived on `main` with design slice 15
	 * while this function was being written on another branch, and neither side was wrong.
	 *
	 * **Why not `resolve(cancelResultFor(kind))`, which is what this did first.** That settles
	 * the promise, so the OUTGOING entry's continuation resumes — in a microtask, after
	 * everything above has been re-seeded — and whatever it writes lands on the world the next
	 * entry is about to draw. The history-dependence would have moved rather than gone. It also
	 * contradicts a policy `DialogHost.vue` states outright at its own `onBeforeUnmount`: it
	 * deliberately does not call `store.resolve`, because "the view is gone, so there is nothing
	 * left to dispatch anything on its behalf". The harness has to abandon the way production
	 * abandons, or it is a stand-in behaving differently from the thing it stands in for.
	 *
	 * Clearing `current` through `storeToRefs` rather than through a store method, because there
	 * is no method for this and the store should not grow one for the harness's sake. Its own
	 * header already names this reachable: `current` comes back from `storeToRefs` as a writable
	 * ref, so "any other holder of the store could settle or strand a pending dialog". This is
	 * that, deliberately, in the one place where the awaiter is known to be gone. The stale
	 * resolver is dropped by the next `openDialog`, which overwrites it.
	 */
	storeToRefs(useDialogStore()).current.value = null;
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
	// — the next test mounting an index through `indexApp.ts`, say — replaces which Pinia
	// `useXStore()` resolves to outside an explicit `app.use(pinia)`. Harmless in both places
	// that call it: the real page builds exactly one index app, and a test mounts one at a
	// time, so nothing creates a second Pinia while an index built from the first is still on
	// screen and the global stays pointed at the one this call just built for as long as that
	// app lives
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
 * that calls `usePlanEditorContext()` throws — `PlanEditorRoot`, `PlanCanvas`, anything
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
		// Taken from `harnessDeps()` like everything else here rather than stubbed: every WRITE
		// answers `settings.unrecovered`, the honest result for a page with no vault — a mock's
		// gestures fail visibly instead of pretending to persist. The bundle's one READ, the
		// Inspector query, is answered from `HARNESS_ZONES` instead, because a page that HAS the
		// zone and refuses to describe it shows a false picture rather than an honest failure;
		// `harnessDeps` carries the whole reasoning, including why `zones` is left refusing.
		commands: deps.commands,
		vault: deps.vault,
		onThemeChange: deps.onThemeChange,
		onPlanChanged: (listener) => deps.onPlanChanged(HARNESS_PLAN.id, listener),
		// No id to bind, so it passes straight through — the same shape the real view uses.
		onCatalogueChanged: deps.onCatalogueChanged,
		// Straight through as well, and inert for the reason `harnessDeps` states where they are
		// declared: this page publishes no domain events at all.
		onProjectPricesChanged: deps.onProjectPricesChanged,
		onRequirementFiguresChanged: deps.onRequirementFiguresChanged,
		// Straight through, like the doors above: no id to bind, and `harnessDeps` says why it is inert.
		onVaultFileChanged: deps.onVaultFileChanged,
		// A no-op, and honestly so: the browser harness draws the editor in a page with no
		// Obsidian and therefore no leaf to close. The action is still RENDERED and pressable —
		// which is the point of the harness, since a designer looks at the dangling-reference
		// state here — it just has nothing to act on. Matching every WRITE in this fixture,
		// which refuses rather than pretending.
		closeLeaf: () => undefined,
	};
}
