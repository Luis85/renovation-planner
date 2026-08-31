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
import { CreatePlanCommand } from '../../src/application/commands/plan/CreatePlan';
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
 * The two repositories `defaultRenovationProjectDeps` builds its queries and its commands
 * over, handed to a `seed` callback so a caller can put content in them BEFORE either side
 * exists. Both, never one: a project with no plans and a plan with no project are each a
 * state the detail store has a branch for, and a seed that could only reach half of them
 * would be a fake choosing which branch is reachable.
 */
export interface SeedRepositories {
	readonly projects: InMemoryProjectRepository;
	readonly plans: InMemoryPlanRepository;
}

/**
 * The default `deps`: an empty project list with nothing refused, backed by a REAL
 * `InMemoryProjectRepository` rather than a fixed literal — one built fresh per call, so two
 * views built through this factory in the same test never share state.
 *
 * **EXPORTED, which is what makes this file's opening promise — "a grown constructor
 * requirement meets every consumer at the same time" — true of the consumers that pass their
 * OWN `deps`, and not only of the ones that take the default.** Those were exactly the
 * consumers stranded when design slice 21's Task 5 grew `RenovationProjectDeps` by five
 * members. SEVEN files hand-built a four-member literal, counted rather than remembered, and
 * they split two ways — which is the part worth keeping. FOUR annotated theirs (or handed it
 * to `makeView`, which is annotated) and so failed the moment `main`'s `typecheck:tests` gate
 * met this branch: `accessibility.test.ts`, `renovationProjectEmptyState.test.ts`,
 * `viewRootFailure.test.ts`, `viewRoot.test.ts`. All four spread this now.
 * THREE put theirs into `mount(ViewRoot, { global: { provide } })`, whose value type is
 * `unknown` — `viewRootIndexRebuild`, `viewRootCreateProject` and `viewRootOpenProject` — so
 * no compiler sees their shape at all and the gate stayed green over them. They keep their
 * hand-built literals on purpose, because each needs a controlled or observable `listProjects`
 * spy that a full annotation would fight.
 *
 * **What they do NOT keep is the silence.** Those three were correct only because `ViewRoot`
 * reads four members, and design slice 21 gives it a `projectId` to branch on — at which point
 * an omitted key arrives as `undefined` with no compiler and no failing test to say so, and
 * every case in those files is about the LIST, so they would go on passing for the wrong
 * reason. All five of their literals now state `projectId: null` explicitly. That is the whole
 * remedy an annotation would have bought for this member, at none of its cost, and it is a
 * fact a reader can check rather than a caveat they have to remember. It was first recorded
 * here as a residue to be inherited; a residue whose bound expires in the next task of the
 * same plan is one to close, not to write down.
 *
 * A caller spreads this and overrides
 * the one or two members its own cases actually vary — `{ ...defaultRenovationProjectDeps(),
 * queries }` — so a member it has no opinion about gets the honest default decided ONCE here,
 * beside the reasoning, rather than five times by guess. A caller that needs a controlled,
 * deferred or observable member still writes that member itself, and the override is what
 * says so.
 *
 * `commands.createProject` ANSWERS, for the same repository, rather than the
 * refusal bundle it used to default to, and design slice 21's `commands.createPlan` ANSWERS
 * beside it for the same reason and against the same two repositories — a plan created through
 * this default is one `queries.listPlansByProject` then reads back, so the harness page can
 * seed a plan by hand and watch the detail state redraw. It is the exact forward risk
 * CLAUDE.md's fifth fake-instance lesson names, in its other direction: a stand-in that
 * REFUSES what production answers turns a tool built for looking into one that shows a false
 * picture. Design slice 16 gave the empty state's button a real
 * hand-off (`ViewRoot` opens `NewProjectForm` and dispatches through it), which is the exact
 * forward risk CLAUDE.md's fifth fake-instance lesson names: a stand-in that REFUSES what
 * production would answer turns a tool built for looking into one that shows a false
 * picture. `tests/harness/mount.ts` calls `makeView` with no `deps` at all, so the browser
 * harness page (`npm run harness`) is the direct beneficiary — a session there can now
 * actually create a project and see the read model that create landed in.
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
 * Obsidian-vault operation this harness has none of, and a caller that cares about it
 * overrides it rather than reading the default. No caller LIST here, deliberately — a
 * docblock naming its own callers is a fact about the routing, and routing is what the next
 * review round changes; `grep -rn 'openProject' tests/presentation/views/` is the instrument,
 * and it answers for the day it is run. `'opened'` and not `'missing'`, because `'missing'`
 * asks `ViewRoot` to re-read the list — a default that re-hydrated on every row click would be
 * a fake driving behaviour nothing asked for.
 *
 * `seed` is the one way a caller can name a project this factory holds. Every id here is
 * GENERATED — `CreateProjectCommand` mints its own — so `?project=<id>` in the browser
 * harness could never match one that a command had made, and a read model stubbed to answer a
 * fixed project beside commands writing into an empty pair would be two worlds: the New plan
 * button would report success and the list it wrote into would not be the list on screen. The
 * callback runs before the queries and the commands are constructed, so both sides see the
 * same two repositories and the create-and-see-it-appear loop works on the seeded project
 * exactly as it already does on a created one.
 */
export const defaultRenovationProjectDeps = (
	seed?: (repositories: SeedRepositories) => void,
): RenovationProjectDeps => {
	const projects = new InMemoryProjectRepository();
	// Beside `projects` rather than inline in `ListPlansByProject`'s constructor: `commands`
	// carries a `createPlan` of its own since Task 8, and it needs the SAME repository this
	// file's `queries` reads through, not a second empty one silently answering a different
	// world.
	const plans = new InMemoryPlanRepository();
	const events = new RecordingEventBus();

	// Before the queries and the commands are built over them, so a seeded caller gets ONE
	// world rather than a read model over content and a write side over an empty pair. The
	// browser harness's `?project=` knob is the only caller today (`tests/harness/mount.ts`):
	// a detail state has to be OPENED on a project that exists, and every id here is
	// generated, so a seed is the only way a URL can name one.
	seed?.({ projects, plans });

	// ANNOTATED rather than inferred, so a member the interface grows is a compile error here
	// rather than an `undefined` handed to whoever reads it — which is what this file shipped:
	// `commands` was built with `createProject` alone, and `RenovationProjectCommandServices`
	// requires a `logger` beside it.
	const defaults: RenovationProjectDeps = {
		queries: createRenovationProjectQueries(new ListProjects(projects), new GetProject(projects), new ListPlansByProject(plans)),
		commands: {
			createProject: new CreateProjectCommand(projects, events),
			createPlan: new CreatePlanCommand(plans, projects, events),
			logger: recorder,
		},
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
	return defaults;
};

/**
 * Builds the view against `deps`, or — handed none — against
 * `defaultRenovationProjectDeps()` above, whose every choice is documented there.
 */
export const makeView = (deps?: RenovationProjectDeps): RenovationProjectView =>
	new RenovationProjectView(new FakeLeaf() as never, deps ?? defaultRenovationProjectDeps());
