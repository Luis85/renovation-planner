import type { Vault, Workspace } from 'obsidian';
import { createCompositionRoot } from '../../src/plugin/composition-root';
import { projectWorkServices } from '../../src/plugin/projectWorkServices';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { buildProjectIndexEntries } from '../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import type { ProjectWorkServices } from '../../src/application/queries/schedule/ProjectWork';
import type { Plan } from '../../src/domain/plan/Plan';
import type { Project } from '../../src/domain/project/Project';
import { createRepositoryStack } from '../helpers/vault';
import { FakeWorkspace } from '../helpers/workspace';
import { expectDefined, expectOk } from '../helpers/domain';

/**
 * `RenovationProjectDeps.work` for the detail harness, so `?section=schedule` draws the schedule
 * section rather than a read of nothing.
 *
 * The REAL `projectWorkServices` over a real composition root and a `FakeVault` stack, the
 * composition `tests/helpers/downstreamView.ts` gives the suite and `downstreamWorkspace.ts`
 * gives this page. What this adds is the seed: the same `project` and `plans` the in-memory
 * detail world holds, saved as notes, so the header names the project the detail state named.
 * They are TWO worlds with the same content, not one: a plan created in the detail state is not
 * in this vault.
 *
 * `?plans-unreadable=<n>` damages the first `n` plan notes' frontmatter after the index scan,
 * which is how `projectWorkDiagnosticsDoor.test.ts` produces a refused plan read, so the count
 * on screen is `readProjectWork`'s own. `scheduleKnob.test.ts` drives that through `page.ts`.
 *
 * `read` waits for the seed, which the real one does not: the saves are async and the page
 * entry cannot await, so without the wait the first read answers `project.not-found`.
 */
export function harnessProjectWork(project: Project, plans: readonly Plan[], unreadable: number): ProjectWorkServices {
	const stack = createRepositoryStack();
	const root = createCompositionRoot({ ...DEFAULT_SETTINGS, libraryFolder: stack.libraryFolder }, stack.logger, stack.deps);
	const persistence = expectDefined(root.persistence, 'harness schedule persistence');
	const work = expectDefined(
		projectWorkServices(root, stack.deps.vault as Vault, new FakeWorkspace() as unknown as Workspace),
		'harness schedule services',
	);
	const ready = (async () => {
		expectOk(await stack.projects.save(project, 'absent'));
		for (const plan of plans) expectOk(await stack.plans.save(plan, 'absent'));
		stack.metadataCache.catchUp();
		const scan = buildProjectIndexEntries({ ...stack.deps, echo: persistence.vaultDeps.echo });
		persistence.index.rebuild(scan.entries, scan.exclusions);
		for (const plan of plans.slice(0, unreadable)) {
			const path = expectDefined(persistence.index.getPath(plan.id), 'harness plan path');
			const note = expectDefined(stack.vault.entries.get(path), 'harness plan note');
			stack.vault.entries.set(path, note.replace(/^name:.*$/m, 'name: []'));
		}
	})();
	return { ...work, read: async (id) => { await ready; return work.read(id); } };
}
