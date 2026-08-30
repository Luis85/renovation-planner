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
 * **This file is in `tsconfig.json`'s `include`, and that is the fourth entry rather than a
 * tidy-up.** The promise one paragraph up — a grown constructor requirement meeting every
 * consumer at once — is a compile-time claim, and nothing type-checked this file, so it was a
 * convention that had already been broken: design slice 16 gave `RenovationProjectDeps` a
 * `commands` bundle whose `logger` is REQUIRED, and the default below built `commands` out of
 * `createProject` alone. `ViewRoot` then handed `logger: undefined` to `useFormCommit`, where a
 * REJECTING dispatch reaches `faultError` and TypeErrors inside the very catch that exists so a
 * fault reaches somebody. Invisible to all four gates: vitest transpiles without checking, and
 * every dispatch wired today is a guarded command that cannot throw — so the hole opens for
 * whoever wires the first unguarded one, exactly as `useFormCommit`'s own docblock predicts.
 *
 * The wider instrument was MEASURED before this narrower one was chosen: a `tests/helpers`
 * glob for every `.ts` under it, in that same `include`, reports 29 errors — and at least four
 * are this repository's own recorded fake-too-thin shape rather than test-scaffolding noise: `calibrateHarness`'s viewport missing
 * `worldPerScreenPixel`, `planEditorRig`'s bundle missing `calibratePlan`, and two `PlanDto`
 * fixtures missing `calibration`. Worth closing; not worth closing inside a review pass on
 * another slice, so it is written down here rather than left for the next reader to re-measure.
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
import { GetProject } from '../../src/application/queries/GetProject';
import { ListPlansByProject } from '../../src/application/queries/ListPlansByProject';
import { ListProjects } from '../../src/application/queries/ListProjects';
import { InMemoryPlanRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { createRenovationProjectQueries } from '../../src/presentation/read-models/renovationProjectQueries';
import { FakeLeaf } from './workspace';
import { RecordingEventBus } from './domain';
import { recorder } from './logger';
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
 * `RecordingEventBus` is a fine stand-in for the real bus here, and the reason is now about
 * THIS tree rather than about the event: `createProjectListChangeSource` does subscribe to
 * `ProjectCreated` (added in review — the sample-seed path published one that nothing heard),
 * but these defaults hand the view a no-op `onProjectsChanged` and never that source, so no
 * subscription is bound to this bus at all and a dispatching one would run no cascade a
 * recording one misses. Wire the real source here and this sentence stops being true.
 *
 * `commands.logger` is `recorder`, the same recording port `planEditorRig` hands the editor's
 * own bundle — a real `Logger`, not a noop, so `useFormCommit`'s fault door has somewhere to
 * write. It is the honest fake here rather than the refusal bundle's silent one for the reason
 * one paragraph up: this default ANSWERS, so its failures are real ones worth recording.
 *
 * `openProject` stays a no-op answering `'opened'`: opening a project's own note is an
 * Obsidian-vault operation this harness has none of, and every caller of this factory that
 * cares about it (`renovationProjectEmptyState.test.ts`, `accessibility.test.ts`'s failed-read
 * case) passes its own `deps` explicitly instead of taking the default. `'opened'` and not
 * `'missing'`, because `'missing'` asks `ViewRoot` to re-read the list — a default that
 * re-hydrated on every row click would be a fake driving behaviour nothing asked for.
 */
export const makeView = (deps?: RenovationProjectDeps): RenovationProjectView => {
	if (deps !== undefined) return new RenovationProjectView(new FakeLeaf() as never, deps);

	const projects = new InMemoryProjectRepository();
	// Beside `projects` rather than inline in `ListPlansByProject`'s constructor: `commands`
	// grows a `createPlan` member of its own once Task 8 lands, and it needs the SAME
	// repository this file's `queries` reads through, not a second empty one silently
	// answering a different world.
	const plans = new InMemoryPlanRepository();
	const events = new RecordingEventBus();

	// ANNOTATED rather than inferred, so a member the interface grows is a compile error here
	// rather than an `undefined` handed to whoever reads it — which is what this file shipped:
	// `commands` was built with `createProject` alone, and `RenovationProjectCommandServices`
	// requires a `logger` beside it.
	const defaults: RenovationProjectDeps = {
		queries: createRenovationProjectQueries(new ListProjects(projects), new GetProject(projects), new ListPlansByProject(plans)),
		commands: { createProject: new CreateProjectCommand(projects, events), logger: recorder },
		openProject: () => Promise.resolve('opened'),
		onProjectsChanged: () => () => undefined,
		// The LIST state, which is what a harness mount with no query string draws and what
		// every existing case of this factory has always been asserting against.
		projectId: null,
		// `navigate` and `openPlan` are the one place this default is deliberately INERT, and
		// the reason is the same one `openProject`'s own paragraph gives: both are Obsidian
		// workspace operations this harness has none of. A default that silently did nothing
		// would let a view that never calls `navigate` pass a test written to prove that it
		// does — every case that asserts on either passes its own `deps` instead of taking
		// this one.
		navigate: () => undefined,
		openPlan: () => Promise.resolve(),
		onPlansChanged: () => () => undefined,
		// TRUE, deliberately: the default vault here is a real in-memory repository that has
		// already been read, so `ok(null)` from it is authoritative. Defaulting to `false`
		// would put every case that mounts a detail state through this factory into the
		// restored-leaf holding pattern, which is a fake driving behaviour nothing asked for.
		indexScanCompleted: () => true,
	};
	return new RenovationProjectView(new FakeLeaf() as never, defaults);
};
