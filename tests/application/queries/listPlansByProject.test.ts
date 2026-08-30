/**
 * `ListPlansByProject` — the project detail state's read (design slice 21).
 *
 * An Application Test in the SDD §71 sense: the query against an in-memory repository, with
 * no Obsidian anywhere. Two of its four cases pin behaviour this slice INHERITS from
 * `PlanRepository.listByProject` rather than chooses — the loop fails the whole list for one
 * unreadable note (`if (!one.ok) return one`) and silently drops an indexed id whose note is
 * gone (`if (one.value) loaded.push(...)`). The store above cannot tell the second from a
 * project that really has fewer plans, because both arrive as a successful array. Pinned so
 * that changing either is a deliberate act with a red test behind it.
 */
import { describe, expect, it } from 'vitest';
import { ListPlansByProject } from '../../../src/application/queries/ListPlansByProject';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { err, isErr, isOk, ok } from '../../../src/core/result/Result';
import type { PersistenceError } from '../../../src/core/errors/AppError';
import type { PlanRepository } from '../../../src/application/ports/PlanRepository';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import type { Loaded } from '../../../src/application/ports/versioning';
import type { Plan } from '../../../src/domain/plan/Plan';
import { expectOk } from '../../helpers/domain';
import { makePlan } from '../../helpers/entities';

const PROJECT = 'project-01JAAA' as ProjectId;

const READ_FAILED: PersistenceError = {
	category: 'Persistence',
	code: 'plan.read-failed',
	message: 'boom',
};

/**
 * Declared member by member rather than spread from an instance: spreading copies only own
 * enumerable properties and drops every prototype method, leaving a double that does not
 * satisfy the port at runtime. `listProjects.test.ts` states the same ruling.
 */
function repositoryAnswering(
	listByProject: PlanRepository['listByProject'],
): PlanRepository {
	return {
		listByProject,
		getById: () => Promise.reject(new Error('not exercised')),
		save: () => Promise.reject(new Error('not exercised')),
		delete: () => Promise.reject(new Error('not exercised')),
	};
}

describe('ListPlansByProject', () => {
	it('answers an empty list for a project with no plans', async () => {
		const result = await new ListPlansByProject(new InMemoryPlanRepository()).execute({
			projectId: PROJECT,
		});

		expect(isOk(result) && result.value).toEqual([]);
	});

	it('answers the project’s plans as domain entities', async () => {
		const plans = new InMemoryPlanRepository();
		const ground = expectOk(await plans.save(makePlan({ projectId: PROJECT, name: 'Ground floor' }), 'absent'));

		const result = await new ListPlansByProject(plans).execute({ projectId: PROJECT });

		expect(isOk(result) && result.value.map((plan) => plan.name)).toEqual(['Ground floor']);
		expect(isOk(result) && result.value[0]?.id).toBe(ground.entity.id);
	});

	/**
	 * The STRICT half, and the one with teeth: a single plan note written by a newer build
	 * refuses as a `MigrationError` and takes the entire detail state with it — every other
	 * plan in the project hidden behind one file's schema version, where the project LIST
	 * would have shown its readable rows and counted the rest. Inherited from the port, not
	 * chosen here. Trigger to change it: a second surface wanting per-row resilience, or the
	 * first report of a project made unopenable by one plan note.
	 */
	it('hands a failed read back as a failure, never as a short list', async () => {
		const result = await new ListPlansByProject(
			repositoryAnswering(() => Promise.resolve(err(READ_FAILED))),
		).execute({ projectId: PROJECT });

		expect(isErr(result) && result.error.code).toBe('plan.read-failed');
	});

	/**
	 * The LOSSY half, bounded and self-correcting: `ok(null)` for an indexed id means the note
	 * is gone, which `VaultChangeAdapter` corrects on its next pass. A row vanishing for a
	 * moment is the honest picture of a note that is not there — but the ROW COUNT then
	 * disagrees with the index, silently, and this case is what makes that a fact somebody
	 * chose. Driven at the port, because `InMemoryPlanRepository` cannot produce the state.
	 */
	it('drops an indexed id whose note is gone rather than reporting it', async () => {
		const survivor: Loaded<Plan> = { entity: makePlan({ projectId: PROJECT, name: 'First floor' }), version: 1 };

		const result = await new ListPlansByProject(
			repositoryAnswering(() => Promise.resolve(ok([survivor]))),
		).execute({ projectId: PROJECT });

		expect(isOk(result) && result.value.map((plan) => plan.name)).toEqual(['First floor']);
	});
});
