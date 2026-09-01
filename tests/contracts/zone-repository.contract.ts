import { describe, expect, it } from 'vitest';
import type { ZoneRepository } from '../../src/application/ports/ZoneRepository';
import type { EntityVersion } from '../../src/application/ports/versioning';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import type { PlanId } from '../../src/domain/plan/PlanId';
import type { Zone } from '../../src/domain/zone/Zone';
import type { ZoneId } from '../../src/domain/zone/ZoneId';
import { expectErr, expectOk } from '../helpers/domain';
import { expectIdKeyedUpsert } from './upsert';

/**
 * The shared ZoneRepository contract (SDD §72) — the suite SDD §36's own interface
 * example backs. See project-repository.contract.ts for the reuse and `touch` story.
 */
export interface ZoneFixture {
	readonly repository: ZoneRepository;
	makeZone(projectId: ProjectId, planId: PlanId, name?: string): Zone;
	touch(id: ZoneId): void;
	/** Fresh, unused parent ids / a fresh, unused project id. */
	otherParents(): { projectId: ProjectId; planId: PlanId };
	otherProject(): ProjectId;
}

function fabricated(observed: EntityVersion['observed']): EntityVersion {
	return { revision: 99, observed };
}

/** One fresh zone under fresh parents — the fixture half every test below needs. */
function seedNew(f: ZoneFixture): { projectId: ProjectId; planId: PlanId; zone: Zone } {
	const parents = f.otherParents();
	return { ...parents, zone: f.makeZone(parents.projectId, parents.planId) };
}

export function zoneRepositoryContract(make: () => ZoneFixture): void {
	describe('ZoneRepository contract', () => {
		it('getById answers ok(null) for a missing id', async () => {
			const f = make();
			const { zone } = seedNew(f);
			expect(await f.repository.getById(zone.id)).toEqual({ ok: true, value: null });
		});

		it("save with 'absent' inserts at revision 1 and reads back", async () => {
			const f = make();
			const { planId, zone } = seedNew(f);
			const written = expectOk(await f.repository.save(zone, 'absent'));
			expect(written.version.revision).toBe(1);
			expect(expectOk(await f.repository.getById(zone.id))?.entity.planId).toBe(planId);
		});

		it('save is an ID-keyed upsert when given the version it returned', async () => {
			const f = make();
			const { zone } = seedNew(f);
			const written = await expectIdKeyedUpsert({
				repository: f.repository,
				entity: zone,
				replacementName: 'After',
			});
			expect(written.version.revision).toBe(2);
		});

		it("save with 'absent' refuses when something already holds the id", async () => {
			const f = make();
			const { zone } = seedNew(f);
			expectOk(await f.repository.save(zone, 'absent'));
			expect((await f.repository.save(zone, 'absent')).ok).toBe(false);
		});

		it('save refuses a stale revision', async () => {
			const f = make();
			const { zone } = seedNew(f);
			const written = expectOk(await f.repository.save(zone, 'absent'));
			const error = expectErr(await f.repository.save(zone, fabricated(written.version.observed)));
			expect(error.code).toBe('zone.revision-conflict');
		});

		it('save refuses after an external modification', async () => {
			const f = make();
			const { zone } = seedNew(f);
			const written = expectOk(await f.repository.save(zone, 'absent'));
			f.touch(zone.id);
			// Same revision as what this caller read — only the token moved.
			const error = expectErr(
				await f.repository.save(zone, {
					revision: written.version.revision,
					observed: written.version.observed,
				}),
			);
			expect(error.code).toBe('zone.external-modification');
		});

		it('delete removes conditionally and answers ok(null) afterwards', async () => {
			const f = make();
			const { zone } = seedNew(f);
			const written = expectOk(await f.repository.save(zone, 'absent'));
			await f.repository.delete(zone.id, written.version);
			expect(await f.repository.getById(zone.id)).toEqual({ ok: true, value: null });
		});

		it('delete refuses a stale expectation or an unknown id', async () => {
			const f = make();
			const { zone } = seedNew(f);
			const written = expectOk(await f.repository.save(zone, 'absent'));
			expect(
				(await f.repository.delete(zone.id, fabricated(written.version.observed))).ok,
			).toBe(false);
			const stranger = seedNew(f).zone;
			expect((await f.repository.delete(stranger.id, written.version)).ok).toBe(false);
		});

		it('listByPlan and listByProject each return only their own zones', async () => {
			const f = make();
			const onTarget = f.otherParents();
			const elsewhereParents = f.otherParents();
			const zoneA = f.makeZone(onTarget.projectId, onTarget.planId, 'A');
			const alsoOnTarget = f.makeZone(onTarget.projectId, onTarget.planId, 'A2');
			const elsewhere = f.makeZone(onTarget.projectId, elsewhereParents.planId, 'B');
			const otherProjectZone = f.makeZone(f.otherProject(), elsewhereParents.planId, 'C');
			expectOk(await f.repository.save(zoneA, 'absent'));
			expectOk(await f.repository.save(alsoOnTarget, 'absent'));
			expectOk(await f.repository.save(elsewhere, 'absent'));
			expectOk(await f.repository.save(otherProjectZone, 'absent'));

			expect(
				expectOk(await f.repository.listByPlan(onTarget.planId)).loaded.map((z) => z.entity.name),
			).toEqual(['A', 'A2']);
			expect(
				expectOk(await f.repository.listByProject(onTarget.projectId)).loaded.map((z) => z.entity.name),
			).toEqual(['A', 'A2', 'B']);
			// Part of the contract rather than of one implementation: every zone here is readable,
			// so BOTH must answer zero. The disk-backed one has a non-zero arm and the in-memory
			// one cannot — it holds entities rather than text — and this is the assertion that
			// keeps the shape one shape across that difference.
			expect(expectOk(await f.repository.listByPlan(onTarget.planId)).refused).toBe(0);
		});
	});
}
