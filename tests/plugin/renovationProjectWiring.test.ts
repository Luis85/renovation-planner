/**
 * @vitest-environment jsdom
 *
 * What the composition root hands the Renovation Project view (design slice 14).
 *
 * Mirrors `planEditorWiring.test.ts`'s "the plan editor dependencies" block: the seam this
 * file guards is the same one slice 1 reserved in writing — every later slice adds a FIELD
 * here and a constructor parameter, never a second wiring point somewhere else in the
 * plugin.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Mock-only surface, imported BY NAME. `Notice` carries members
// the real `obsidian` module does not declare (`shown`, `constructed`, `opened`, `choose`), so reaching them through the
// `'obsidian'` specifier type-checks against a surface that has no such thing. The
// vitest alias points that specifier at this very file, so this is the SAME class and
// the same statics — proven, not assumed — and the import now says which surface it
// wants.
import { Notice } from '../helpers/obsidian-mock';
import { activateNotices } from '../../src/presentation/notices/notify';
import {
	createCompositionRoot,
	renovationProjectDeps,
	type CompositionRoot,
	type VaultStack,
} from '../../src/plugin/composition-root';
import { projectIndexRebuilt } from '../../src/application/events/projectIndex.events';
import { planCreated } from '../../src/domain/plan/Plan.events';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { RENOVATION_PROJECT_VIEW, RenovationProjectView } from '../../src/presentation/views/RenovationProjectView';
import { PLAN_EDITOR_VIEW } from '../../src/presentation/views/PlanEditorView';
import { installObsidianDom } from '../helpers/dom';
import { expectOk } from '../helpers/domain';
import { makeProject } from '../helpers/entities';
import { lines, recorder, resetRecorder } from '../helpers/logger';
import { createRepositoryStack } from '../helpers/vault';
import { FakeLeaf, FakeWorkspace } from '../helpers/workspace';
import { settle } from '../helpers/async';
import type { RenovationProjectDeps } from '../../src/presentation/views/RenovationProjectContext';

// `loadedPlugin()` (the 'the registered view factory' cases below) builds the plugin's own
// REAL console logger — `recorder`/`lines` only see it through this mock, the same one
// `registration.test.ts` and `rootSwapRebind.test.ts` use for the same reason.
vi.mock('../../src/infrastructure/logging/consoleLogger', async () => (await import('../helpers/logger')).consoleLoggerMock());

// `vi.mock` the MODULE rather than the export: `renovationProjectDeps` imports the binding
// directly (`import { revealPlanEditor } from '.../revealPlanEditor'`), so a spy on the
// export a caller ALREADY holds a reference to would never be seen by that caller.
vi.mock('../../src/infrastructure/obsidian/workspace/revealPlanEditor', () => ({
	revealPlanEditor: vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined),
}));
import { revealPlanEditor as revealPlanEditorSpy } from '../../src/infrastructure/obsidian/workspace/revealPlanEditor';

installObsidianDom();

// A notice is INERT until something activates the queue — `onload` is what does that in
// production, so a case asserting on `Notice.shown` has to stand where the plugin stands.
beforeEach(() => {
	activateNotices();
});

// Typed as `VaultStack`, not `as never`: the cast made every `.vault` read below an error,
// because `never` has no properties. `as never` on a whole double is the spelling that hides
// which members it is actually standing in for.
const vaultStack = (): VaultStack =>
	({
		vault: { getAbstractFileByPath: () => null, getFiles: () => [] },
		fileManager: {},
		metadataCache: { getFileCache: () => null },
	}) as unknown as VaultStack;

/**
 * The bundle a session whose settings never recovered gets. Shared by the two write cases
 * below rather than spelled twice: they assert the SAME refusal about two different members,
 * and two hand-built compositions of one state is how the two come to disagree about it.
 */
function refusingDeps(): RenovationProjectDeps {
	const root = createCompositionRoot(null, recorder, vaultStack());
	return renovationProjectDeps(root, new FakeWorkspace() as never, vaultStack().vault, {
		projectId: null,
		navigate: () => undefined,
		indexScanCompleted: () => true,
	});
}

/**
 * A real composed root with settings recovered, beside a fresh workspace and vault.
 *
 * `vault` is typed as the member it IS rather than as `unknown`, for the reason `vaultStack`'s
 * own comment gives one screen up: a widened type on a whole double hides which members it is
 * standing in for, and here it also made every `renovationProjectDeps(…, vault, …)` call below
 * an error the moment `tests/**` entered the type-checked program.
 */
function composedRoot(): { root: CompositionRoot; workspace: FakeWorkspace; vault: VaultStack['vault'] } {
	const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());
	return { root, workspace: new FakeWorkspace(), vault: vaultStack().vault };
}

describe('the renovation project dependencies', () => {
	it('wires the project-list subscription to the root own bus', async () => {
		// The restored-leaf case, at the seam that composes it: this view is hydrated once at
		// mount and Obsidian restores it BEFORE the index scan runs, so the rebuild reaching it
		// is the only thing that turns "no projects yet" back into the vault's real list.
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());
		const deps = renovationProjectDeps(root, new FakeWorkspace() as never, vaultStack().vault, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});
		const listener = vi.fn<() => void>();

		const unsubscribe = deps.onProjectsChanged(listener);
		// Awaited: the bus is promise-aware and costs one microtask hop per delivery.
		await root.eventBus.publish(projectIndexRebuilt());
		unsubscribe();
		await root.eventBus.publish(projectIndexRebuilt());

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('subscribes to the same bus even with settings unrecovered, where it simply never fires', async () => {
		// The one member that is NOT swapped for a refusal when `persistence` is null, and the
		// reason is measurable rather than stylistic: the bus is the root's own either way, and
		// the arm that would take a no-op is the arm where `startPersistence` returns before
		// publishing anything at all.
		const root = createCompositionRoot(null, recorder, vaultStack());
		const deps = renovationProjectDeps(root, new FakeWorkspace() as never, vaultStack().vault, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});
		const listener = vi.fn<() => void>();

		deps.onProjectsChanged(listener);
		await root.eventBus.publish(projectIndexRebuilt());

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('hands over a query service that answers the real project list when persistence is composed', async () => {
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());

		const deps = renovationProjectDeps(root, new FakeWorkspace() as never, vaultStack().vault, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});
		const result = await deps.queries.listProjects();

		// A fresh vault legitimately has none yet — `ok`, not a refusal, and nothing refused.
		expect(result).toEqual({ ok: true, value: { projects: [], unreadable: 0 } });
	});

	/**
	 * TOTAL rather than nullable. With settings unrecovered there is no repository, no
	 * index and no project list — the same reasoning `planEditorDeps` documents for the
	 * identical situation, and `settings.unrecovered` is the same `code` rather than a
	 * second one for the same fact.
	 */
	it('hands over refusing query services when settings were never recovered', async () => {
		const root = createCompositionRoot(null, recorder, vaultStack());

		const deps = renovationProjectDeps(root, new FakeWorkspace() as never, vaultStack().vault, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});
		const result = await deps.queries.listProjects();

		expect(result.ok).toBe(false);
		expect(!result.ok && result.error.code).toBe('settings.unrecovered');
	});

	/**
	 * A composition that forgets a dependency COMPILES and passes everything else — the
	 * `slice10CascadeWiring` reason. So this asserts on what the composed door actually
	 * ANSWERS, against a real repository behind a real root, rather than on the member existing.
	 */
	it('hands the view both detail-state reads, composed against the real persistence stack', async () => {
		const stack = createRepositoryStack();
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, stack as never);
		const persistence = root.persistence;
		if (persistence === null) throw new Error('expected a composed persistence stack');
		const saved = expectOk(await persistence.projects.save(makeProject({ name: 'Hallway' }), 'absent'));

		const deps = renovationProjectDeps(root, new FakeWorkspace() as never, stack.vault as never, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});

		const found = await deps.queries.getProject(saved.entity.id);
		const plans = await deps.queries.listPlansByProject(saved.entity.id);

		expect(found.ok && found.value?.name).toBe('Hallway');
		expect(plans.ok && plans.value).toEqual({ plans: [], unreadable: 0 });
	});

	/**
	 * Slice 16's write side: the SAME guarded `createProject` `persistence` already composed
	 * and exposes, not a second guard around it — reused by identity so a hostile input
	 * driven through either seam is driven through the one guard that exists.
	 */
	it('hands over the guarded createProject command when persistence is composed', () => {
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, vaultStack());

		const deps = renovationProjectDeps(root, new FakeWorkspace() as never, vaultStack().vault, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});

		expect(deps.commands.createProject).toBe(root.persistence?.createProject);
	});

	/**
	 * Design slice 21's write side, asserted the way the detail-state READS above are and not
	 * the way `createProject` is: identity says the view got the root's own guarded command
	 * rather than a second one, and the round trip says that command reaches the same vault the
	 * view then reads back through. A composition that forgets a dependency compiles and passes
	 * everything else, and identity alone would still pass a root whose `createPlan` was
	 * composed against a different repository from `listPlansByProject`.
	 */
	it('hands over the guarded createPlan command, which writes a plan the view then reads', async () => {
		const stack = createRepositoryStack();
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, stack as never);
		const persistence = root.persistence;
		if (persistence === null) throw new Error('expected a composed persistence stack');
		const project = expectOk(await persistence.projects.save(makeProject({ name: 'Hallway' }), 'absent'));

		const deps = renovationProjectDeps(root, new FakeWorkspace() as never, stack.vault as never, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});
		const created = await deps.commands.createPlan.execute({ projectId: project.entity.id, name: 'Ground floor' });
		const plans = await deps.queries.listPlansByProject(project.entity.id);

		expect(deps.commands.createPlan).toBe(persistence.createPlan);
		expect(created.ok).toBe(true);
		expect(plans.ok && plans.value.plans.map((plan) => plan.name)).toEqual(['Ground floor']);
	});

	it('hands over a refusing createPlan command when settings were never recovered', async () => {
		// A real `ProjectId` is not needed and would say nothing extra: the refusal is decided
		// before any repository is reached, which is the whole property.
		const result = await refusingDeps().commands.createPlan.execute({
			projectId: 'project-1' as never,
			name: 'Ground floor',
		});

		expect(result.ok).toBe(false);
		expect(!result.ok && result.error.code).toBe('settings.unrecovered');
	});

	it('hands over a refusing createProject command when settings were never recovered', async () => {
		const result = await refusingDeps().commands.createProject.execute({ name: 'Kitchen' });

		expect(result.ok).toBe(false);
		expect(!result.ok && result.error.code).toBe('settings.unrecovered');
	});

	/**
	 * `openProject` reaches the workspace AND the vault it was constructed with, over the
	 * root's own index: this asserts the SEAM wires all three through, not `openProjectNote`'s
	 * own mechanism, which `openNote.test.ts` already covers directly — so a real note and a
	 * real (albeit fake) vault stand in for the roundabout of dispatching a create first.
	 */
	it('opens the note a project id resolves to when persistence is composed', async () => {
		const stack = createRepositoryStack();
		await stack.vault.create('Project.md', '---\nid: project-1\n---\n');
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, stack as never);
		root.persistence?.index.upsert({ id: 'project-1' as never, type: 'renovation-project', path: 'Project.md' });
		const workspace = new FakeWorkspace();

		const deps = renovationProjectDeps(root, workspace as never, stack.vault as never, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});
		await deps.openProject('project-1');

		expect(workspace.leaves).toHaveLength(1);
		expect(workspace.leaves[0].opened[0]?.path).toBe('Project.md');
	});

	/**
	 * TOTAL rather than nullable, same as `queries` and `commands` above: with no index to
	 * resolve a path through, opening anything would be a guess, so this answers a no-op
	 * rather than reaching for a workspace that has nothing to open.
	 *
	 * `'failed'` and never `'missing'`, which is the member `ViewRoot` re-reads the project
	 * list for: there is no list in this state — `queries` is the refusal bundle — so asking
	 * for a re-read would set off a read that can only refuse again.
	 */
	it('opens nothing when settings were never recovered', async () => {
		const root = createCompositionRoot(null, recorder, vaultStack());
		const workspace = new FakeWorkspace();

		const deps = renovationProjectDeps(root, workspace as never, vaultStack().vault, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});
		await expect(deps.openProject('project-1')).resolves.toBe('failed');

		expect(workspace.leaves).toHaveLength(0);
	});

	/**
	 * TOTAL rather than nullable, the same shape as `openProject` two cases up: with no
	 * persistence there is no vault-backed plan to open, so this answers a no-op rather than
	 * reaching for `revealPlanEditor` at all.
	 */
	it('opens no plan when settings were never recovered', async () => {
		// Cleared rather than relying on execution order: the spy is module-scoped and shared
		// with every other case in this file that calls `openPlan` for real.
		vi.mocked(revealPlanEditorSpy).mockClear();
		const root = createCompositionRoot(null, recorder, vaultStack());

		const deps = renovationProjectDeps(root, new FakeWorkspace() as never, vaultStack().vault, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});

		await expect(deps.openPlan('plan-1')).resolves.toBeUndefined();
		expect(revealPlanEditorSpy).not.toHaveBeenCalled();
	});

	/**
	 * The other half of the outcome, and the one a review round asked for: an id the index
	 * does not resolve answers `'missing'`, which is what lets the view clear the row that was
	 * drawn from a project note deleted since the list was read. Asserted HERE as well as in
	 * `openNote.test.ts` because the composed closure is what the view actually holds, and a
	 * `.catch` arm flattening every outcome into one would pass that file and fail this.
	 */
	it('answers missing for an id the index no longer resolves', async () => {
		const stack = createRepositoryStack();
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, stack as never);
		const workspace = new FakeWorkspace();

		const deps = renovationProjectDeps(root, workspace as never, stack.vault as never, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});

		await expect(deps.openProject('project-1')).resolves.toBe('missing');
		expect(workspace.leaves).toHaveLength(0);
	});

	/**
	 * Task 5's own review deferred this: nothing turned a faulting open into a `Result`, and
	 * `ProjectList`'s row click discards the promise this resolves to
	 * (`@open="(id) => void context.openProject(id)"`) — so a rejecting `openFile` (a real
	 * Obsidian I/O fault, not the "id resolves to nothing" case `openProjectNote` already
	 * handles by design) would otherwise be an unhandled rejection reaching nobody.
	 *
	 * The mapping is COMPOSED here and CALLED one layer down, which is the split the next case
	 * explains: `renovationProjectDeps` is the one place that may name both `openProjectNote`
	 * and `notifyFault` (`infrastructure/` may not import `presentation/notices/notify` — the
	 * layer ban runs the other way), and `openProjectNote` is the one place that knows whether
	 * two clicks are one open. This case asserts the composition; the next asserts the count.
	 */
	it('reports rather than rejecting when opening the note faults', async () => {
		resetRecorder();
		const stack = createRepositoryStack();
		await stack.vault.create('Project.md', '---\nid: project-1\n---\n');
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, stack as never);
		root.persistence?.index.upsert({ id: 'project-1' as never, type: 'renovation-project', path: 'Project.md' });
		// `getLeavesOfType` answers none, which is the case this is about: no tab is already
		// showing the note, so the reuse path is skipped and the faulting `openFile` is reached.
		const workspace = {
			getLeavesOfType: () => [],
			getLeaf: () => ({ openFile: () => Promise.reject(new Error('disk exploded')) }),
		};

		const deps = renovationProjectDeps(root, workspace as never, stack.vault as never, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});

		// `'failed'`, not `'missing'`: the id DID resolve, so the list behind the row is not
		// stale and the view must not answer an I/O fault with a vault-wide re-read.
		await expect(deps.openProject('project-1')).resolves.toBe('failed');
		expect(Notice.shown.at(-1)).toContain('Reading or writing the vault failed unexpectedly.');
		const logged = lines.find((line) => line.event === 'view.project.open-failed');
		expect(logged?.level).toBe('error');
		expect((logged?.context?.['cause'] as Error | undefined)?.message).toBe('disk exploded');
	});

	/**
	 * The defect the coalescing itself created, reported one review round after it landed.
	 *
	 * A double click is one gesture, and `openingByPath` is what makes it one tab. Both calls
	 * were then handed the SAME promise — so when it rejected, each invocation of this composed
	 * closure attached its own `.catch` and reported the same failed open again: two notices,
	 * two identical log lines, one operation.
	 *
	 * The LOG is what discriminates here, and the notice count cannot: slice 13's queue folds
	 * an identical (severity, message) pair into a `(×2)` suffix on the notice already up, so
	 * `Notice.shown` reads 1 either way. Log lines are not deduplicated.
	 *
	 * Watched failing against the previous shape — two lines, from the two `.catch` arms.
	 */
	it('reports a coalesced open failure once, not once per click', async () => {
		resetRecorder();
		const stack = createRepositoryStack();
		await stack.vault.create('Project.md', '---\nid: project-1\n---\n');
		const root = createCompositionRoot(DEFAULT_SETTINGS, recorder, stack as never);
		root.persistence?.index.upsert({ id: 'project-1' as never, type: 'renovation-project', path: 'Project.md' });
		const workspace = {
			getLeavesOfType: () => [],
			getLeaf: () => ({ openFile: () => Promise.reject(new Error('disk exploded')) }),
		};

		const deps = renovationProjectDeps(root, workspace as never, stack.vault as never, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});

		// Both in the same tick, which is what a double click IS: the second call finds the
		// first open still in flight and joins it rather than asking for a tab of its own.
		const outcomes = await Promise.all([deps.openProject('project-1'), deps.openProject('project-1')]);

		// Both clicks are told the truth — the note did not open — and neither is told twice.
		expect(outcomes).toEqual(['failed', 'failed']);
		expect(lines.filter((line) => line.event === 'view.project.open-failed')).toHaveLength(1);
	});

	/**
	 * `onPlansChanged` needs the SHARPER version of the wiring case, the one this file already
	 * learned for `onProjectsChanged`: a root handed a FRESH `createEventBus()` also compiles
	 * and also announces into an object nothing subscribed to. So drive a real `PlanCreated`
	 * through the ROOT's own bus and assert on what a subscriber hears.
	 */
	it('binds onPlansChanged to the root’s own event bus, filtered to the project', async () => {
		const { root, workspace, vault } = composedRoot();
		const deps = renovationProjectDeps(root, workspace as never, vault, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});
		const heard = vi.fn<() => void>();
		deps.onPlansChanged('project-01JAAA', heard);

		await root.eventBus.publish(planCreated({ planId: 'plan-01JXXX', projectId: 'project-01JAAA' } as never));

		expect(heard).toHaveBeenCalledTimes(1);
	});

	/**
	 * `openPlan` is bound to the REAL `revealPlanEditor`, which is criterion 2's whole route
	 * from the layer that raises the event to the layer allowed to import that function.
	 *
	 * **A SPY on that function, because the criterion names the method and it names it for a
	 * reason.** Asserting on the leaf that ends up holding the plan proves only that something
	 * left a leaf in the requested state — a composition that spelled the state transition
	 * itself, or routed through some other activation helper, passes that assertion
	 * identically. What criterion 2 is about is the two doors SHARING one function, and only a
	 * spy on the function can see that.
	 *
	 * `vi.mock` the MODULE rather than the export, since the composition root imports the
	 * binding directly.
	 */
	it('binds openPlan to the real revealPlanEditor', async () => {
		const { root, workspace, vault } = composedRoot();
		const deps = renovationProjectDeps(root, workspace as never, vault, {
			projectId: null,
			navigate: () => undefined,
			indexScanCompleted: () => true,
		});

		await deps.openPlan('plan-01JXXX');

		expect(revealPlanEditorSpy).toHaveBeenCalledWith(expect.objectContaining({ workspace }), PLAN_EDITOR_VIEW, 'plan-01JXXX');
	});
});

describe('the registered view factory', () => {
	it('builds a RenovationProjectView for the persisted view type', async () => {
		const { loadedPlugin } = await import('../helpers/plugin');
		const { plugin } = await loadedPlugin();

		const built = plugin.views.get(RENOVATION_PROJECT_VIEW)?.(new FakeLeaf() as never);

		expect(built).toBeInstanceOf(RenovationProjectView);
	});

	/**
	 * Resolved PER CALL from the current root, never captured: `saveSettings` replaces the
	 * root, and a view built against the old one would read through query services pointed
	 * at the previous project folder.
	 */
	it('resolves its dependencies from the CURRENT root each time it is called', async () => {
		const { loadedPlugin } = await import('../helpers/plugin');
		const { plugin } = await loadedPlugin();
		const beforeFolder = plugin.root.settings?.projectFolder;

		await plugin.saveSettings({ projectFolder: 'Somewhere else' });

		expect(plugin.root.settings?.projectFolder).not.toBe(beforeFolder);
		const built = plugin.views.get(RENOVATION_PROJECT_VIEW)?.(new FakeLeaf() as never);
		expect(built).toBeInstanceOf(RenovationProjectView);
	});

	/**
	 * `navigate` writes to the leaf `projectViewDeps` was BUILT for, through the real
	 * `navigateToProject` — the plugin-level half of the wiring the composition-root cases
	 * above cover with a caller-supplied `navigate`. A `FakeLeaf` never registered with the
	 * workspace is deliberate: `targetLeaf` is what lets `navigate` skip the type lookup
	 * entirely, so this leaf answering nothing from `getLeavesOfType` must not matter.
	 */
	it('binds navigate to the real navigateToProject, targeting its own leaf', async () => {
		const { loadedPlugin } = await import('../helpers/plugin');
		const { plugin } = await loadedPlugin();
		const leaf = new FakeLeaf();

		(plugin as unknown as { projectViewDeps(leaf: unknown): RenovationProjectDeps })
			.projectViewDeps(leaf)
			.navigate('project-1');
		await settle();

		expect(leaf.getViewState().state).toEqual({ projectId: 'project-1' });
	});

	/**
	 * `navigate` is detached — every real caller is a click handler discarding what it
	 * returns — so a faulting write has no awaiter of its own. This is the plugin-level twin
	 * of `detachedFaults.test.ts`'s cases, driven through the real closure `projectViewDeps`
	 * builds rather than through `runDetached` directly.
	 */
	it('reports rather than losing a faulting navigate', async () => {
		resetRecorder();
		Notice.shown.length = 0;
		const { loadedPlugin } = await import('../helpers/plugin');
		const { plugin } = await loadedPlugin();
		const leaf = new FakeLeaf();
		leaf.setViewState = () => Promise.reject(new Error('disk exploded'));

		(plugin as unknown as { projectViewDeps(leaf: unknown): RenovationProjectDeps })
			.projectViewDeps(leaf)
			.navigate('project-1');
		await settle();

		expect(Notice.shown).toHaveLength(1);
		const logged = lines.find((line) => line.event === 'view.project.reveal-failed');
		expect(logged?.level).toBe('error');
		expect((logged?.context?.['cause'] as Error | undefined)?.message).toBe('disk exploded');
	});
});
