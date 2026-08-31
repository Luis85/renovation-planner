/**
 * `ListProjects` — the Renovation Project view's first read (design slice 14).
 *
 * An Application Test in the SDD §71 sense: the query against an in-memory repository, with
 * no Obsidian anywhere. What it has to establish is small but not nothing — that a failed
 * read is handed back as a failure rather than flattened into an empty list, because an empty
 * list is what the view renders an empty state for; and that a read which SKIPPED some notes
 * is a third fact again, carried out as `unreadable` rather than collapsed into either.
 */
import { describe, expect, it } from 'vitest';
import { ListProjects } from '../../../src/application/queries/ListProjects';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { err, isErr, isOk, ok } from '../../../src/core/result/Result';
import type { PersistenceError } from '../../../src/core/errors/AppError';
import type { LibraryOverlaps } from '../../../src/application/ports/LibraryOverlaps';
import type { ProjectRepository } from '../../../src/application/ports/ProjectRepository';
import { expectOk } from '../../helpers/domain';
import { makeProject } from '../../helpers/entities';

const READ_FAILED: PersistenceError = {
	category: 'Persistence',
	code: 'project.read-failed',
	message: 'boom',
};

/**
 * The §83 overlap port, answering nothing. Honest rather than kind here: these cases run
 * against an in-memory repository with no vault and no Project Index, so there is no derived
 * folder for a real adapter to compare — there is genuinely nothing to report. What the port
 * ACTUALLY does with an index is `listProjectsOverlaps.test.ts`, which drives the real
 * `IndexLibraryOverlaps` rather than this.
 */
const NO_OVERLAPS: LibraryOverlaps = { overlapping: () => [] };

describe('ListProjects', () => {
	it('answers an empty list for a vault with no projects', async () => {
		const result = await new ListProjects(new InMemoryProjectRepository(), NO_OVERLAPS).execute();

		expect(isOk(result) && result.value).toEqual({ projects: [], unreadable: 0, overlapping: [] });
	});

	/**
	 * The distinction the empty state depends on. `ok` with an empty list and `unreadable: 0`
	 * means "legitimately nothing yet" and gets onboarding copy; `isErr` means a real problem
	 * and must NOT be downgraded into it, or a persistence failure renders as a cheerful
	 * invitation to create something.
	 *
	 * Built as an explicit object literal declaring every `ProjectRepository` member, per the
	 * task ruling: spreading an `InMemoryProjectRepository` instance would copy only its own
	 * enumerable properties, dropping every prototype method and leaving a double that does
	 * not actually satisfy the port at runtime. The members this test does not exercise throw,
	 * so a future change that makes the query call one of them fails loudly instead of
	 * silently returning `undefined`.
	 */
	it('hands a failed read back as a failure, never as an empty list', async () => {
		const failing: ProjectRepository = {
			getById: () => {
				throw new Error('not used by this test');
			},
			save: () => {
				throw new Error('not used by this test');
			},
			delete: () => {
				throw new Error('not used by this test');
			},
			listAll: () => Promise.resolve(err(READ_FAILED)),
		};

		const result = await new ListProjects(failing, NO_OVERLAPS).execute();

		expect(isErr(result) && result.error.code).toBe('project.read-failed');
	});

	it('answers every project seeded into the vault', async () => {
		const repository = new InMemoryProjectRepository();
		const first = makeProject({ name: 'Kitchen renovation' });
		const second = makeProject({ name: 'Bathroom renovation' });
		await repository.save(first, 'absent');
		await repository.save(second, 'absent');

		const result = await new ListProjects(repository, NO_OVERLAPS).execute();

		const listed = expectOk(result);
		expect(listed.projects.map((p) => p.id)).toEqual(
			expect.arrayContaining([first.id, second.id]),
		);
		expect(listed.projects).toHaveLength(2);
		expect(listed.unreadable).toBe(0);
	});

	/**
	 * The third fact this query has to keep apart from the other two. `ok` with an empty list
	 * and `unreadable: 0` is "nothing here yet" and earns onboarding copy; `isErr` is a
	 * wholesale failure; an empty list with `unreadable: 3` is neither — the vault holds
	 * projects the user cannot see, and the view must say so rather than invite them to
	 * create their first one.
	 */
	it('reports how many notes refused, without failing the read', async () => {
		const refusing: ProjectRepository = {
			getById: () => {
				throw new Error('not used by this test');
			},
			save: () => {
				throw new Error('not used by this test');
			},
			delete: () => {
				throw new Error('not used by this test');
			},
			listAll: () => Promise.resolve(ok({ loaded: [], refused: 3 })),
		};

		const listed = expectOk(await new ListProjects(refusing, NO_OVERLAPS).execute());

		expect(listed.projects).toEqual([]);
		expect(listed.unreadable).toBe(3);
	});
});
