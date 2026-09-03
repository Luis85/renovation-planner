import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { DeleteZoneCommand } from '../../../src/application/commands/zone/DeleteZone';
import { AssignAssetCommand } from '../../../src/application/commands/requirement/AssignAsset';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import { expectErr, expectOk } from '../../helpers/domain';
import { makeAsset, makeRequirement, makeZone } from '../../helpers/entities';
import { recorder as logger } from '../../helpers/logger';
import {
	failMarkStaleOnce,
	requirementFixture,
	TEN_SQUARE_METERS,
} from '../../helpers/slice10';
import type { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';

/**
 * The deletion & reference-integrity rules, at the command — the enforcement a script or
 * migration must not be able to walk past.
 */

async function wiredWithRequirement() {
	const w = await requirementFixture();
	const zoneEntity = expectOk(
		await w.zones.save(
			expectOk(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
					points: TEN_SQUARE_METERS,
				}),
			),
			'absent',
		),
	);
	const assetEntity = expectOk(
		await w.assets.save(
			makeAsset({ wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);
	const assigned = await w.assign.execute({ zoneId: zoneEntity.entity.id, assetId: assetEntity.entity.id });
	if (!assigned.ok) throw new Error(String(assigned.error));

	const command = new DeleteZoneCommand({
		zones: w.zones,
		requirements: w.requirements,
		recalculate: w.recalculate,
		events: w.events,
		locks: w.locks,
		logger,
	});
	return {
		...w,
		zoneId: zoneEntity.entity.id,
		assetId: assetEntity.entity.id,
		requirementId: assigned.value.requirement.id,
		command,
	};
}

/**
 * Test seam: fail `requirements.delete` for exactly ONE named id, permanently — narrower
 * than `failMarkStaleOnce`'s "the next call" because a compensation case needs to know
 * WHICH of two referents fails, independent of the engine's own sort order over
 * `affectedBefore` (ULID ids, so insertion order and sort order already agree here, but
 * naming the id rather than a call count is what stays true if that ever changes).
 */
function failDeleteForRequirement(repo: InMemoryRequirementRepository, id: RequirementId): void {
	const inner = repo.delete.bind(repo);
	repo.delete = ((deleteId: Parameters<typeof inner>[0], expected: Parameters<typeof inner>[1]) => {
		if (deleteId === id) {
			return Promise.resolve({
				ok: false as const,
				error: {
					category: 'Persistence' as const,
					code: 'requirement.delete-failed',
					message: `delete was configured to fail for ${String(id)}.`,
				},
			});
		}
		return inner(deleteId, expected);
	}) as typeof repo.delete;
}

interface ResolutionRigOptions {
	readonly resolution: 'remove-references' | 'delete-anyway' | 'reassign';
	/**
	 * Moves the FIRST referent's own `projectId` to one that names no saved project — the
	 * cross-project case CLAUDE.md's currency section records: `projectId` and
	 * `origin.zoneId` are two independent frontmatter keys with no cross-check, so a hand
	 * edit (here, saving directly rather than going through `AssignAssetCommand`, which
	 * always sets `projectId: zone.projectId`) can part them. For `reassign` this also
	 * doubles as the refusal fixture: `RecalculateRequirementCommand` resolves the project
	 * from the REQUIREMENT's own `projectId`, so a name that resolves to nothing is a
	 * genuine, reachable `requirement.project-gone` refusal rather than a synthetic one.
	 */
	readonly referentInOtherProject?: boolean;
	readonly referentCount?: number;
	/** Fails the SECOND referent's removal — the first must still land, so there is
	 *  something for `compensate` to restore. */
	readonly failSecondReferent?: boolean;
}

async function resolutionRig(options: ResolutionRigOptions) {
	const w = await wiredWithRequirement();
	const deletedEntityProjectId = w.project.entity.id;
	const referentProjectId = options.referentInOtherProject
		? ('project-unsaved' as ProjectId)
		: deletedEntityProjectId;

	if (options.referentInOtherProject) {
		const original = expectOk(await w.requirements.getById(w.requirementId));
		if (original === null) throw new Error('fixture requirement missing');
		const moved = makeRequirement({
			id: w.requirementId,
			projectId: referentProjectId,
			assetId: original.entity.assetId,
			origin: original.entity.origin,
		});
		expectOk(await w.requirements.save(moved, original.version));
	}

	const referentIds: RequirementId[] = [w.requirementId];
	const count = options.referentCount ?? 1;
	for (let i = 1; i < count; i += 1) {
		const asset = expectOk(await w.assets.save(makeAsset(), 'absent'));
		const assigned = await w.assign.execute({ zoneId: w.zoneId, assetId: asset.entity.id });
		if (!assigned.ok) throw new Error(String(assigned.error));
		referentIds.push(assigned.value.requirement.id);
	}

	if (options.failSecondReferent) {
		failDeleteForRequirement(w.requirements, referentIds[1] as RequirementId);
	}

	let reassignTo: typeof w.zoneId | undefined;
	if (options.resolution === 'reassign') {
		const target = expectOk(
			await w.zones.save(
				expectOk(
					makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
						points: [
							{ x: 0, y: 0 },
							{ x: 4000, y: 0 },
							{ x: 4000, y: 5000 },
							{ x: 0, y: 5000 },
						],
					}),
				),
				'absent',
			),
		);
		reassignTo = target.entity.id;
	}

	return {
		events: w.events,
		referentProjectId,
		deletedEntityProjectId,
		requirements: w.requirements,
		input: {
			zoneId: w.zoneId,
			resolution: options.resolution,
			resolvedReferents: referentIds,
			...(reassignTo !== undefined ? { reassignTo } : {}),
		},
		command: w.command,
	};
}

describe('DeleteZoneCommand reference integrity', () => {
	it('a bare delete with live referents refuses naming them — the path a script takes', async () => {
		const w = await wiredWithRequirement();
		const error = expectErr(await w.command.execute({ zoneId: w.zoneId }));
		expect(error.code).toBe('reference.referents-exist');
		expect(error.message).toContain(w.requirementId);
		// Nothing written.
		expect(expectOk(await w.zones.getById(w.zoneId))).not.toBeNull();
		expect(expectOk(await w.requirements.getById(w.requirementId))).not.toBeNull();
	});

	it('a resolution without resolvedReferents is a ValidationError', async () => {
		const w = await wiredWithRequirement();
		const error = expectErr(
			await w.command.execute({ zoneId: w.zoneId, resolution: 'remove-references' }),
		);
		expect(error.code).toBe('reference.resolution-without-set');
	});

	it('a set that moved since the dialog is refused with reference.set-changed and nothing written', async () => {
		const w = await wiredWithRequirement();
		const asset2 = expectOk(
			await w.assets.save(
				makeAsset(),
				'absent',
			),
		);
		// A second referent appears AFTER the user was shown one.
		await w.assign.execute({ zoneId: w.zoneId, assetId: asset2.entity.id });

		const error = expectErr(
			await w.command.execute({
				zoneId: w.zoneId,
				resolution: 'remove-references',
				resolvedReferents: [w.requirementId],
			}),
		);
		expect(error.code).toBe('reference.set-changed');
		expect(error.message).toContain('2');
		expect(expectOk(await w.zones.getById(w.zoneId))).not.toBeNull();
	});

	it('remove-references deletes the referencing requirements then the zone', async () => {
		const w = await wiredWithRequirement();
		const result = expectOk(
			await w.command.execute({
				zoneId: w.zoneId,
				resolution: 'remove-references',
				resolvedReferents: [w.requirementId],
			}),
		);
		expect(result.affectedAfter).toEqual([{ id: w.requirementId, outcome: 'deleted' }]);
		expect(await w.requirements.getById(w.requirementId)).toEqual({ ok: true, value: null });
		expect(await w.zones.getById(w.zoneId)).toEqual({ ok: true, value: null });
	});

	it('delete-anyway strands the requirement, visibly stale', async () => {
		const w = await wiredWithRequirement();
		expectOk(
			await w.command.execute({
				zoneId: w.zoneId,
				resolution: 'delete-anyway',
				resolvedReferents: [w.requirementId],
			}),
		);
		const stranded = expectOk(await w.requirements.getById(w.requirementId));
		expect(stranded?.entity.origin).toEqual({ kind: 'zone', zoneId: w.zoneId });
		expect(stranded?.entity.recalculationStatus).toBe('stale');
	});

	it('reassign repoints, marks stale, and recalculates INLINE to the new target figures', async () => {
		const w = await wiredWithRequirement();
		// A 20 m² target zone.
		const target = expectOk(
			await w.zones.save(
				expectOk(
					makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
						points: [
							{ x: 0, y: 0 },
							{ x: 4000, y: 0 },
							{ x: 4000, y: 5000 },
							{ x: 0, y: 5000 },
						],
					}),
				),
				'absent',
			),
		);
		expectOk(
			await w.command.execute({
				zoneId: w.zoneId,
				resolution: 'reassign',
				reassignTo: target.entity.id,
				resolvedReferents: [w.requirementId],
			}),
		);
		const repointed = expectOk(await w.requirements.getById(w.requirementId));
		expect(repointed?.entity.origin).toEqual({ kind: 'zone', zoneId: target.entity.id });
		// 20 m² × 1.10 waste = 22 m² — recalculated inline, not left for a later pass.
		expect(repointed?.entity.quantity.calculated.value.toFixed(1)).toBe('22.0');
	});

	it('a failing markStale mid-resolution compensates every write and fails the command', async () => {
		const w = await wiredWithRequirement();
		// Two referents so step 2 has a partial state to compensate.
		const asset2 = expectOk(await w.assets.save(makeAsset(), 'absent'));
		const second = await w.assign.execute({ zoneId: w.zoneId, assetId: asset2.entity.id });
		if (!second.ok) throw new Error('unexpected failure');
		const ids = [w.requirementId, second.value.requirement.id].toSorted();


		// Inject via the test seam in helpers/slice10 — production carries no test-only branch.
		failMarkStaleOnce(w.requirements);

		const error = expectErr(
			await new DeleteZoneCommand({
				zones: w.zones,
				requirements: w.requirements,
				recalculate: w.recalculate,
				events: w.events,
				locks: w.locks,
				logger,
			}).execute({
				zoneId: w.zoneId,
				resolution: 'delete-anyway',
				resolvedReferents: ids,
			}),
		);
		expect(error.code).toBe('requirement.mark-stale-failed');
		// Compensated: both referents still exist, the zone still exists.
		for (const id of ids) {
			expect(expectOk(await w.requirements.getById(id))?.entity.recalculationStatus).not.toBe('stale');
		}
		expect(expectOk(await w.zones.getById(w.zoneId))).not.toBeNull();
	});

	it('an assignment dispatched DURING a delete serializes on the lock instead of dangling', async () => {
		const w = await wiredWithRequirement();
		const otherAsset = expectOk(
			await w.assets.save(makeAsset(), 'absent'),
		);

		// Start the resolution WITHOUT awaiting it, then dispatch the assignment.
		const deleting = w.command.execute({
			zoneId: w.zoneId,
			resolution: 'remove-references',
			resolvedReferents: [w.requirementId],
		});
		const assigning = new AssignAssetCommand({
			zones: w.zones,
			assets: w.assets,
			requirements: w.requirements,
			events: w.events,
			locks: w.locks,
			projects: w.projects,
			overrides: w.overrides,
		}).execute({ zoneId: w.zoneId, assetId: otherAsset.entity.id });

		const results = await Promise.all([deleting, assigning] as const);
		// Either the assignment landed first (the delete then refuses on the moved set)
		// or it waited and failed to resolve a zone that is gone — but no dangling
		// requirement survives either way.
		const [, assignment] = results;
		let originZoneId: string | null = null;
		if (assignment.ok) {
			// Assignment won the race; its requirement references a LIVE zone.
			originZoneId = (
				assignment.value.requirement.origin as unknown as { zoneId: string }
			).zoneId;
		}
		let originZoneLive = true;
		if (originZoneId !== null) {
			originZoneLive = expectOk(await w.zones.getById(originZoneId as never)) !== null;
		}
		expect(originZoneLive).toBe(true);
		const survivors = expectOk(await w.requirements.listByZone(w.zoneId));
		for (const r of survivors) {
			expect(expectOk(await w.zones.getById((r.entity.origin as { zoneId: string }).zoneId as never))).not.toBeNull();
		}
	});
});

/**
 * The resolution touches Requirements a deleted Zone's own `ZoneDeleted` event cannot
 * reach — a referent whose own `projectId` differs from the zone's. Every case here seeds
 * the referent in a DIFFERENT project than the entity being deleted: a same-project
 * fixture passes against a build that publishes nothing new, because the zone event
 * already covers it, and would certify the very defect this task closes.
 */
describe('the delete resolution announces per referent it touched', () => {
	it.each([
		['remove-references', 'RequirementDeleted'],
		['delete-anyway', 'RequirementInvalidated'],
		// `reassign` is not in this table — its event depends on the inline recalculation's
		// outcome and gets its own pair of cases below.
	] as const)('the %s arm announces %s for a referent in another project', async (resolution, type) => {
		const rig = await resolutionRig({ resolution, referentInOtherProject: true });
		const seen: unknown[] = [];
		rig.events.subscribe(type, (event) => {
			seen.push(event);
		});

		expectOk(await rig.command.execute(rig.input));

		expect(seen).toHaveLength(1);
	});

	it('names the REFERENT’s project, not the deleted entity’s', async () => {
		// The one assertion that discriminates a correct payload from a plausible one:
		// taking the project off the entity being deleted compiles, reads fine, and
		// reaches the wrong pane.
		const rig = await resolutionRig({ resolution: 'remove-references', referentInOtherProject: true });
		const seen: { payload: { projectId: string } }[] = [];
		rig.events.subscribe('RequirementDeleted', (event) => {
			seen.push(event as never);
		});

		expectOk(await rig.command.execute(rig.input));

		expect(seen[0]?.payload.projectId).toBe(rig.referentProjectId);
		expect(seen[0]?.payload.projectId).not.toBe(rig.deletedEntityProjectId);
	});

	// A resolution that fails part-way is compensated back to the pre-state, so it must not
	// leave subscribers believing referent 1 was removed.
	it('announces nothing for referents a failed resolution compensated', async () => {
		const rig = await resolutionRig({
			resolution: 'remove-references',
			referentCount: 2,
			failSecondReferent: true,
		});
		const seen: unknown[] = [];
		rig.events.subscribe('RequirementDeleted', (event) => {
			seen.push(event);
		});

		expect((await rig.command.execute(rig.input)).ok).toBe(false);

		expect(seen).toEqual([]);
	});

	it('a successful compensation announces RequirementRestored for the referent it put back', async () => {
		const rig = await resolutionRig({
			resolution: 'remove-references',
			referentCount: 2,
			failSecondReferent: true,
		});
		const seen: { payload: { requirementId: string; projectId: string } }[] = [];
		rig.events.subscribe('RequirementRestored', (event) => {
			seen.push(event as never);
		});
		rig.events.subscribe('RequirementDeleted', () => {
			throw new Error('must never reach here — the failing case above proves the absence');
		});

		const result = await rig.command.execute(rig.input);
		expect(result.ok).toBe(false);

		// The first (lexically-earliest ULID) referent is the one whose removal succeeds
		// and is then rolled back; the second is the one whose own delete was made to fail.
		const restoredId = rig.input.resolvedReferents[0];
		expect(seen).toHaveLength(1);
		expect(seen[0]?.payload.requirementId).toBe(restoredId);
	});

	describe('reassign, whose event depends on the inline recalculation it runs', () => {
		it('announces RequirementInvalidated when the inline recalculation refuses', async () => {
			// The referent's own projectId names no saved project, so
			// RecalculateRequirementCommand's project lookup genuinely refuses.
			const rig = await resolutionRig({ resolution: 'reassign', referentInOtherProject: true });
			const seenInvalidated: unknown[] = [];
			const seenRecalculated: unknown[] = [];
			rig.events.subscribe('RequirementInvalidated', (event) => {
				seenInvalidated.push(event);
			});
			rig.events.subscribe('RequirementRecalculated', (event) => {
				seenRecalculated.push(event);
			});

			expectOk(await rig.command.execute(rig.input));

			expect(seenInvalidated).toHaveLength(1);
			expect(seenRecalculated).toEqual([]);
		});

		it('announces nothing when the inline recalculation succeeds — the command already told the story', async () => {
			const rig = await resolutionRig({ resolution: 'reassign' });
			const seenInvalidated: unknown[] = [];
			const seenRecalculated: unknown[] = [];
			rig.events.subscribe('RequirementInvalidated', (event) => {
				seenInvalidated.push(event);
			});
			rig.events.subscribe('RequirementRecalculated', (event) => {
				seenRecalculated.push(event);
			});

			expectOk(await rig.command.execute(rig.input));

			expect(seenInvalidated).toEqual([]);
			expect(seenRecalculated).toHaveLength(1);
		});
	});
});
