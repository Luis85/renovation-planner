import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { useProjectStore } from '../../src/presentation/stores/ProjectStore';
import type { EditorContext } from '../../src/presentation/editor/EditorContext';
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
 */
export function seedFixture(): Pinia {
	const pinia = createPinia();

	// Process-wide: the last call to `setActivePinia` wins, so calling `seedFixture()` again
	// for a second entry replaces which Pinia `useProjectStore()` resolves to outside an
	// explicit `app.use(pinia)`. Harmless for how Task 4 uses this — one fixture call per
	// mounted entry, immediately consumed — but worth knowing before a caller relies on two
	// live at once.
	setActivePinia(pinia);

	const project = useProjectStore();

	// Assigned directly rather than through `hydrate`: `harnessDeps().queries` answers both
	// queries perfectly well with no vault behind them, so that is not the reason. The real
	// one is that `hydrate` is ASYNCHRONOUS (it awaits two query promises) and `seedFixture`
	// is not — every index entry needs a world in place before its first synchronous mount,
	// not one that lands a tick later. What a component needs is the post-hydration STATE,
	// which is this.
	project.plan = HARNESS_PLAN;
	project.zones = new Map(HARNESS_ZONES.map((zone) => [zone.id, zone]));
	project.status = 'ready';

	return pinia;
}

/**
 * The editor context, which is NOT optional and is easy to miss.
 *
 * `src/presentation/views/PlanEditorView.ts` does three things when it mounts: `createPinia()`,
 * `use(VueKonva)` and **`provide(EDITOR_CONTEXT, …)`**. Without the third, every component that
 * calls `useEditorContext()` throws — `PlanEditorRoot`, `BackgroundLayer`, anything using
 * `useThemeTokens` — so the index would render the named failure for exactly the components a
 * designer most wants to look at, and a prototype composing one would too.
 *
 * Built from `harnessDeps()` rather than from a second set of stubs, for the same reason the
 * plan and zones come from `planEditor.ts`: a second derivation answers differently the day one
 * of them is edited.
 */
export function harnessEditorContext(): EditorContext {
	const deps = harnessDeps();

	return {
		planId: HARNESS_PLAN.id,
		queries: deps.queries,
		vault: deps.vault,
		onThemeChange: deps.onThemeChange,
		onPlanChanged: (listener) => deps.onPlanChanged(HARNESS_PLAN.id, listener),
	};
}
