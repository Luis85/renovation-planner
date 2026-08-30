import { describe, expect, it } from 'vitest';
import type { PlanRepository } from '../../src/application/ports/PlanRepository';
import type { EntityVersion } from '../../src/application/ports/versioning';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import type { Plan } from '../../src/domain/plan/Plan';
import type { PlanId } from '../../src/domain/plan/PlanId';
import { expectErr, expectOk } from '../helpers/domain';
import { assertSaveUpsertsById } from './upsert';

/**
 * The shared PlanRepository contract (SDD §72) — see project-repository.contract.ts for
 * the reuse and `touch` story. Identical assertions, plus listByProject.
 */
export interface PlanFixture {
	readonly repository: PlanRepository;
	makePlan(projectId: ProjectId, name?: string): Plan;
	touch(id: PlanId): void;
	/** A second, distinct project id — never one a makePlan call used. */
	otherProject(): ProjectId;
}

function fabricated(observed: EntityVersion['observed']): EntityVersion {
	return { revision: 99, observed };
}

export function planRepositoryContract(make: () => PlanFixture): void {
	describe('PlanRepository contract', () => {
		it('getById answers ok(null) for a missing id', async () => {
			const { repository, makePlan, otherProject } = make();
			const found = await repository.getById(makePlan(otherProject()).id);
			expect(found).toEqual({ ok: true, value: null });
		});

		it("save with 'absent' inserts at revision 1 and reads back", async () => {
			const { repository, makePlan, otherProject } = make();
			const projectId = otherProject();
			const plan = makePlan(projectId);
			const written = expectOk(await repository.save(plan, 'absent'));
			expect(written.version.revision).toBe(1);
			expect(expectOk(await repository.getById(plan.id))?.entity.projectId).toBe(projectId);
		});

		it('save is an ID-keyed upsert when given the version it returned', async () => {
			const { repository, makePlan, otherProject } = make();
			const plan = makePlan(otherProject(), 'Before');
			const written = await assertSaveUpsertsById({
				repository,
				entity: plan,
				read: async () => expectOk(await repository.getById(plan.id))?.entity ?? null,
				replacementName: 'After',
			});
			expect(written.version.revision).toBe(2);
		});

		it("save with 'absent' refuses when something already holds the id", async () => {
			const { repository, makePlan, otherProject } = make();
			const plan = makePlan(otherProject());
			expectOk(await repository.save(plan, 'absent'));
			expect((await repository.save(plan, 'absent')).ok).toBe(false);
		});

		it('save refuses a stale revision', async () => {
			const { repository, makePlan, otherProject } = make();
			const plan = makePlan(otherProject());
			const written = expectOk(await repository.save(plan, 'absent'));
			const error = expectErr(await repository.save(plan, fabricated(written.version.observed)));
			expect(error.code).toBe('plan.revision-conflict');
		});

		it('save refuses after an external modification', async () => {
			const { repository, makePlan, touch, otherProject } = make();
			const plan = makePlan(otherProject());
			const written = expectOk(await repository.save(plan, 'absent'));
			touch(plan.id);
			const error = expectErr(
				await repository.save(plan, {
					revision: written.version.revision,
					observed: written.version.observed,
				}),
			);
			expect(error.code).toBe('plan.external-modification');
		});

		it('delete removes conditionally and answers ok(null) afterwards', async () => {
			const { repository, makePlan, touch, otherProject } = make();
			void touch;
			const plan = makePlan(otherProject());
			const written = expectOk(await repository.save(plan, 'absent'));
			await repository.delete(plan.id, written.version);
			expect(await repository.getById(plan.id)).toEqual({ ok: true, value: null });
		});

		it('delete refuses a stale expectation or an unknown id', async () => {
			const { repository, makePlan, otherProject } = make();
			const plan = makePlan(otherProject());
			const written = expectOk(await repository.save(plan, 'absent'));
			expect(
				(await repository.delete(plan.id, fabricated(written.version.observed))).ok,
			).toBe(false);
			const stranger = makePlan(otherProject());
			expect((await repository.delete(stranger.id, written.version)).ok).toBe(false);
		});

		it('listByProject returns only that project’s plans', async () => {
			const { repository, makePlan, otherProject } = make();
			const projectA = otherProject();
			const onA = makePlan(projectA, 'A');
			const alsoOnA = makePlan(projectA, 'A2');
			makePlan(otherProject(), 'B');
			expectOk(await repository.save(onA, 'absent'));
			expectOk(await repository.save(alsoOnA, 'absent'));
			const listed = expectOk(await repository.listByProject(projectA));
			expect(listed.map((p) => p.entity.name)).toEqual(['A', 'A2']);
		});
	});
}
