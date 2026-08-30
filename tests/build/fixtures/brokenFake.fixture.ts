/**
 * A DELIBERATELY FAILING spec. It exists to be run by a CHILD vitest process and to fail
 * there, which is what `tests/build/contractDiscriminates.test.ts` reads.
 *
 * `*.fixture.ts` rather than `*.test.ts`, and the choice had to satisfy three gates at
 * once — two rounds of design weighed only the first two:
 *
 *  1. Vitest's collection. `include` is `tests/**\/*.test.ts`, so a `.test.ts` here would be
 *     collected by the OUTER `npm run check`, which would then fail before the meta-test
 *     could interpret the child's exit code — the fixture would break the very gate it is
 *     part of.
 *  2. `tests/build/spec-files.test.ts`, which bans `.spec.ts` outright. That is not the
 *     escape either.
 *  3. `npm run analyze`. A file reachable only through a spawned child's `include` glob is
 *     seeded by nothing and imported by nothing, so fallow reports it and the child config
 *     as unused files. Both are declared in `.fallowrc.json`'s `entry` list for that reason,
 *     the same way the two `*.test-d.ts` files and `scripts/lint-edited.mjs` already are.
 *
 * Stated here so a later reader does not "tidy" this into a `.test.ts` and rediscover all
 * three by breaking the build.
 */
import type { ZoneRepository } from '../../../src/application/ports/ZoneRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { zoneRepositoryContract } from '../../contracts/zone-repository.contract';
import { makeZone } from '../../helpers/entities';
import { createPlanId, type PlanId } from '../../../src/domain/plan/PlanId';
import { createProjectId, type ProjectId } from '../../../src/domain/project/ProjectId';

function fresh<T>(used: Set<T>, mint: () => T): T {
	let id = mint();
	while (used.has(id)) {
		id = mint();
	}
	used.add(id);
	return id;
}

zoneRepositoryContract(() => {
	const inner = new InMemoryZoneRepository();

	/**
	 * The one mutation this fixture exists to be caught by: `save` silently blanks the
	 * zone's `name`, so the contract's round-trip case sees a different entity come back
	 * than it put in.
	 *
	 * DELEGATION, not `{ ...inner }`. Spreading a class instance copies its OWN properties
	 * only — every method lives on the prototype — so the spread form hands the contract an
	 * object with no `getById` at all, and the run then fails for the wrong reason: a
	 * TypeError during construction rather than a round-trip mismatch. That failure exits
	 * non-zero and names the same case, which is exactly what the parent's collected-count
	 * and failure-text discriminators exist to tell apart.
	 */
	const repository: ZoneRepository = {
		getById: (id) => inner.getById(id),
		listByPlan: (planId) => inner.listByPlan(planId),
		listByProject: (projectId) => inner.listByProject(projectId),
		delete: (id, expected) => inner.delete(id, expected),
		save: (zone, expected) => inner.save({ ...zone, name: '' }, expected),
	};

	const usedPlans = new Set<PlanId>();
	const usedProjects = new Set<ProjectId>();
	return {
		repository,
		makeZone: (projectId, planId, name = 'Living room') => makeZone({ projectId, planId, name }),
		touch: (id) => inner.poke(id),
		otherParents: () => ({
			projectId: fresh(usedProjects, createProjectId),
			planId: fresh(usedPlans, createPlanId),
		}),
		otherProject: () => fresh(usedProjects, createProjectId),
	};
});
