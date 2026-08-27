/**
 * `ListProjects` — the Renovation Project view's first read (design slice 14).
 *
 * An Application Test in the SDD §71 sense: the query against an in-memory repository, with
 * no Obsidian anywhere. What it has to establish is small but not nothing — that a failed
 * read is handed back as a failure rather than flattened into an empty list, because an empty
 * list is what the view renders an empty state for.
 */
import { describe, expect, it } from 'vitest';
import { ListProjects } from '../../../src/application/queries/ListProjects';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { err, isErr, isOk } from '../../../src/core/result/Result';
import type { PersistenceError } from '../../../src/core/errors/AppError';
import type { ProjectRepository } from '../../../src/application/ports/ProjectRepository';
import { expectOk } from '../../helpers/domain';
import { makeProject } from '../../helpers/entities';

const READ_FAILED: PersistenceError = {
	category: 'Persistence',
	code: 'project.read-failed',
	message: 'boom',
};

describe('ListProjects', () => {
	it('answers an empty list for a vault with no projects', async () => {
		const result = await new ListProjects(new InMemoryProjectRepository()).execute();

		expect(isOk(result) && result.value).toEqual([]);
	});

	/**
	 * The distinction the empty state depends on. `ok([])` means "legitimately nothing yet"
	 * and gets onboarding copy; `isErr` means a real problem and must NOT be downgraded into
	 * it, or a persistence failure renders as a cheerful invitation to create something.
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

		const result = await new ListProjects(failing).execute();

		expect(isErr(result) && result.error.code).toBe('project.read-failed');
	});

	it('answers every project seeded into the vault', async () => {
		const repository = new InMemoryProjectRepository();
		const first = makeProject({ name: 'Kitchen renovation' });
		const second = makeProject({ name: 'Bathroom renovation' });
		await repository.save(first, 'absent');
		await repository.save(second, 'absent');

		const result = await new ListProjects(repository).execute();

		const projects = expectOk(result);
		expect(projects.map((p) => p.id)).toEqual(expect.arrayContaining([first.id, second.id]));
		expect(projects).toHaveLength(2);
	});
});
