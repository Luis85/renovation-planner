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
import { CreateProjectCommand } from '../../src/application/commands/project/CreateProject';
import { ListProjects } from '../../src/application/queries/ListProjects';
import { InMemoryProjectRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { createRenovationProjectQueries } from '../../src/presentation/read-models/renovationProjectQueries';
import { FakeLeaf } from './workspace';
import { RecordingEventBus } from './domain';
import type { RenovationProjectDeps } from '../../src/presentation/views/RenovationProjectContext';

/**
 * The default `deps` answers an empty project list with nothing refused, backed by a REAL
 * `InMemoryProjectRepository` rather than a fixed literal — one built fresh per call, so two
 * views built through this factory in the same test never share state.
 *
 * `commands.createProject` ANSWERS now too, for the same repository, rather than the
 * refusal bundle it used to default to. Design slice 16 gave the empty state's button a real
 * hand-off (`ViewRoot` opens `NewProjectForm` and dispatches through it), which is the exact
 * forward risk CLAUDE.md's fifth fake-instance lesson names: a stand-in that REFUSES what
 * production would answer turns a tool built for looking into one that shows a false
 * picture. `tests/harness/mount.ts` calls this with no `deps` at all, so the browser harness
 * page (`npm run harness`) is the direct beneficiary — a session there can now actually
 * create a project and see the read model that create landed in.
 * `tests/presentation/views/viewRootCreateProject.test.ts` covers the identical round trip
 * against `ViewRoot` mounted directly, with its own hand-built `deps` rather than this
 * factory's, because that file needs to observe the shared `busy` ref and a controlled,
 * deferred dispatch — this file's job is the harness path, not that one.
 * `RecordingEventBus` is a fine stand-in for the real bus here: nothing in this tree
 * subscribes to `ProjectCreated`, so there is no cascade for a dispatching bus to run that a
 * recording one would miss.
 *
 * `openProject` stays a no-op: opening a project's own note is an Obsidian-vault operation
 * this harness has none of, and every caller of this factory that cares about it
 * (`renovationProjectEmptyState.test.ts`, `accessibility.test.ts`'s failed-read case) passes
 * its own `deps` explicitly instead of taking the default.
 */
export const makeView = (deps?: RenovationProjectDeps): RenovationProjectView => {
	if (deps !== undefined) return new RenovationProjectView(new FakeLeaf() as never, deps);

	const projects = new InMemoryProjectRepository();
	const events = new RecordingEventBus();

	return new RenovationProjectView(new FakeLeaf() as never, {
		queries: createRenovationProjectQueries(new ListProjects(projects)),
		commands: { createProject: new CreateProjectCommand(projects, events) },
		openProject: () => Promise.resolve(),
	});
};
