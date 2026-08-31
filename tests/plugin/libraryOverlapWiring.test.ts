/**
 * @vitest-environment jsdom
 *
 * That the composed root builds `IndexLibraryOverlaps` from the ROOT'S OWN index and the
 * CONFIGURED library folder (§83, design slice 19).
 *
 * The same shape as `slice10CascadeWiring.test.ts` and `sequenceNoticeWiring.test.ts`, and it
 * exists for the same reason those do: a composition that passes the wrong collaborator
 * compiles, passes every other test here, and says nothing. Measured before this file was
 * written — replacing `libraryFolder` with `'Zzz/Unrelated'` at `composition-root.ts`'s
 * construction site left 1594 tests across `tests/plugin`, `tests/harness` and
 * `tests/presentation` green, because the only case reading the project list read it through
 * `createRenovationProjectQueries`, which maps `projects` and `unreadable` and drops
 * `overlapping` by design.
 *
 * So the assertion is made at the GUARDED QUERY (`persistence.listProjects`), which sits
 * ABOVE the read model that erases the field. Asserting through the read model cannot work,
 * and that is the whole finding rather than a detail of it.
 *
 * The gesture is the one §83 has no door for: ADR-0013 derives a project's folder from where
 * its `Project.md` sits, so a user moves a project by dragging a folder in Obsidian's file
 * explorer. There is no command to refuse — so the note is moved in the vault directly, with
 * its own basename intact the way a dragged FOLDER leaves it, and the plugin's own load-time
 * scan is what finds it in its new place.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { createProjectId, type ProjectId } from '../../src/domain/project/ProjectId';
import { createRepositoryStack, type RepositoryStack } from '../helpers/vault';
import { installObsidianDom } from '../helpers/dom';
import { loadedPlugin } from '../helpers/plugin';
import { expectOk } from '../helpers/domain';
import { makeProject } from '../helpers/entities';

installObsidianDom();

/**
 * One project, written where the configured project root puts it — `Renovation/Kitchen
 * refit`, a sibling of `Renovation/Library` and therefore the state §83 asks for.
 *
 * `catchUp` is Obsidian's parse queue draining. Without it the note stays inside the fake's
 * create window, where a freshly loaded plugin holding its OWN echo window cannot read it —
 * a faithful model of two sessions, and not what these cases are asking about.
 */
async function vaultWithOneProject(): Promise<{ stack: RepositoryStack; projectId: ProjectId }> {
	const stack = createRepositoryStack(DEFAULT_SETTINGS.projectFolder);
	const projectId = createProjectId();
	expectOk(await stack.projects.save(makeProject({ id: projectId, name: 'Kitchen refit' }), 'absent'));
	stack.metadataCache.catchUp();
	return { stack, projectId };
}

/**
 * The drag, performed on the vault rather than through any command, because there is no
 * command: the note keeps its own basename and lands under a new parent. Bytes written
 * straight into `entries` stand for vault content that was already there, which is exactly
 * what a note somebody moved in the file explorer is.
 */
function dragProjectInto(stack: RepositoryStack, projectId: ProjectId, folder: string): string {
	const from = stack.index.getPath(projectId) ?? '';
	const to = `${folder}/${from.slice(from.lastIndexOf('/') + 1)}`;
	stack.vault.entries.set(to, stack.vault.entries.get(from) ?? '');
	stack.vault.entries.delete(from);
	return to;
}

describe('the library overlap the composed root answers', () => {
	it('reports a project whose folder the user dragged inside the library', async () => {
		const { stack, projectId } = await vaultWithOneProject();
		const dragged = dragProjectInto(stack, projectId, `${DEFAULT_SETTINGS.libraryFolder}/Kitchen refit`);

		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		// The REAL scan, into the root's OWN index — never a re-spelling of it here.
		workspace.layoutReady();

		const persistence = plugin.root.persistence as NonNullable<typeof plugin.root.persistence>;
		expect(persistence.index.getPath(projectId)).toBe(dragged);

		const listed = expectOk(await persistence.listProjects.execute());

		expect(listed.projects.map((project) => project.id)).toEqual([projectId]);
		// The two arguments this case exists for: the root's own index is what placed the
		// note, and the CONFIGURED library folder is what it was measured against. A wrong
		// folder at that construction site changes this line and nothing else in the suite.
		expect(listed.overlapping).toEqual([projectId]);
	});

	/**
	 * The contrast, and it is not decoration: without it the case above is equally true of a
	 * root that reports every project it can place. A sibling of the library is the state §83
	 * asks for, and it must come back unmarked through the same door.
	 */
	it('reports nothing for a project sitting beside the library', async () => {
		const { stack, projectId } = await vaultWithOneProject();

		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();

		const persistence = plugin.root.persistence as NonNullable<typeof plugin.root.persistence>;
		const listed = expectOk(await persistence.listProjects.execute());

		expect(listed.projects.map((project) => project.id)).toEqual([projectId]);
		expect(listed.overlapping).toEqual([]);
	});
});
