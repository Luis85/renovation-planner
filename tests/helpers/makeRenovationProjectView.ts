/**
 * Builds the real `RenovationProjectView` against a fake leaf — the `as never` cast lives
 * HERE, once. The jsdom suites (`renovationProjectView.test.ts`,
 * `renovationProjectEmptyState.test.ts`) and the browser harness mount
 * (`tests/harness/mount.ts`) all build their view through this, so a grown constructor
 * requirement meets every consumer at the same time instead of fixing the suite and
 * silently stranding the harness page. Design slice 14's `deps` parameter is exactly that:
 * it is the first time this promise is called in, because the view had no second
 * constructor argument until this slice gave it one.
 *
 * Split out of `./workspace` on purpose, and that split IS the point of this file existing
 * separately: `RenovationProjectView` mounts `ViewRoot.vue`, a real Vue SFC, and importing
 * it drags that SFC's client-mode compilation into whatever environment does the importing.
 * `./workspace`'s `FakeWorkspace`/`FakeLeaf` are DOM-independent and used from both jsdom and
 * plain-'node' test files (`revealView.test.ts`, `revealPlanEditor.test.ts` need no DOM at
 * all); before this split, `./workspace` also re-exported this factory, so those node-
 * environment files transitively imported `ViewRoot.vue` too. Once `ViewRoot.vue` gained
 * real content (slice 15's `DialogHost`), that made the same `.vue` file reachable from BOTH
 * a 'node'-environment test and a jsdom one in the same coverage run — `@vitejs/plugin-vue`
 * compiles it once per environment, and `@vitest/coverage-v8` merged the two script
 * coverages into a never-hit phantom duplicate of every statement, failing the coverage
 * floor on behaviour that was fully exercised elsewhere. `./workspace` stays free of any
 * import that reaches `src/presentation/` so the next node-environment consumer of
 * `FakeWorkspace` cannot reopen this by accident.
 */
import { RenovationProjectView } from '../../src/presentation/views/RenovationProjectView';
import { ok } from '../../src/core/result/Result';
import { FakeLeaf } from './workspace';
import type { RenovationProjectDeps } from '../../src/presentation/views/RenovationProjectContext';

/**
 * The default `deps` answers an empty project list with nothing refused —
 * `ok({ projects: [], unreadable: 0 })` — rather than the refusal bundle:
 * `unavailableRenovationProjectQueries()` is what settings.unrecovered actually looks like,
 * and defaulting every caller of this factory to that would make the harness page and every
 * un-migrated test look like a broken session rather than a fresh, empty vault. Optional
 * rather than required, so `tests/harness/mount.ts` keeps compiling
 * unchanged: the harness page therefore shows the empty state now, which is the new thing
 * worth looking at — the populated surface has nothing to draw until a later slice builds
 * an actual project list (this slice explicitly does not).
 */
export const makeView = (deps?: RenovationProjectDeps): RenovationProjectView =>
	new RenovationProjectView(
		new FakeLeaf() as never,
		deps ?? { queries: { listProjects: () => Promise.resolve(ok({ projects: [], unreadable: 0 })) } },
	);
