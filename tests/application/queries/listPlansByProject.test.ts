/**
 * `ListPlansByProject` — the project detail state's read (design slice 21).
 *
 * An Application Test in the SDD §71 sense: the query against an in-memory repository, with
 * no Obsidian anywhere. `ListPlansByProject` itself does no reconciliation, counting or
 * validation of its own — it passes `PlanRepository.listByProject`'s array through unchanged,
 * mapping each `Loaded<Plan>` to its entity and nothing more. The third case below pins that
 * pass-through for the FAIL-whole-list behaviour the query inherits from the port (the loop
 * fails the whole list for one unreadable note, `if (!one.ok) return one`), because a
 * hand-built `PlanRepository` double can produce a failed read honestly — it is a `Result`
 * value, nothing about the note behind it. It does NOT pin the port's other inherited
 * behaviour — silently dropping an indexed id whose note is gone — because a double that
 * simply returns an already-filtered array cannot distinguish that drop from a project that
 * genuinely has fewer plans; that behaviour is pinned where it can actually be produced, at
 * `ObsidianPlanRepository.listByProject` against a real index/note loop, in
 * `tests/infrastructure/obsidian/repositories/contract.test.ts`.
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
	 * The PASS-THROUGH property, not the drop itself: whatever array the port answers is what
	 * this query hands back, entity for `Loaded<Plan>`, with no filtering, counting or
	 * reconciliation added on top. This double can only ever answer an already-filtered
	 * `[survivor]` — it has no way to also hold an indexed id whose note is gone — so it
	 * cannot tell a project that genuinely has one plan from one where a second plan's note
	 * vanished and got dropped underneath it. That distinction, and the drop behaviour itself,
	 * is pinned at `ObsidianPlanRepository.listByProject` in
	 * `tests/infrastructure/obsidian/repositories/contract.test.ts`, against a real index/note
	 * loop this fixture cannot produce.
	 */
	it('passes the port’s array through unchanged, adding no reconciliation of its own', async () => {
		const survivor: Loaded<Plan> = { entity: makePlan({ projectId: PROJECT, name: 'First floor' }), version: 1 };

		const result = await new ListPlansByProject(
			repositoryAnswering(() => Promise.resolve(ok([survivor]))),
		).execute({ projectId: PROJECT });

		expect(isOk(result) && result.value.map((plan) => plan.name)).toEqual(['First floor']);
	});
});
