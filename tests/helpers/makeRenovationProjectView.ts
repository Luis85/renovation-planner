/**
 * Builds the real `RenovationProjectView` against a fake leaf — the `as never` cast lives
 * HERE, once. Both the jsdom suite (`renovationProjectView.test.ts`) and the browser
 * harness mount (`tests/harness/mount.ts`) build their view through this, so a grown
 * constructor requirement meets every consumer at the same time instead of fixing the
 * suite and silently stranding the harness page.
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
import { FakeLeaf } from './workspace';

export const makeView = (): RenovationProjectView => new RenovationProjectView(new FakeLeaf() as never);
