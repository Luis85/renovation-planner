import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { DeleteZoneCommand } from '../../../src/application/commands/zone/DeleteZone';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import { expectOk } from '../../helpers/domain';
import { makeAsset, makeRequirement, makeZone } from '../../helpers/entities';
import { recorder as logger } from '../../helpers/logger';
import { requirementFixture, TEN_SQUARE_METERS } from '../../helpers/slice10';
import type { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';

/**
 * The event-announcement half of the resolution's tests, split out of
 * `deleteResolutions.test.ts` (which keeps the reference-integrity rules — refusals, the
 * bare mechanics of each resolution, the reference-lock race) once this file's own line
 * count crossed the suite's cap. `wiredWithRequirement()` is duplicated rather than shared,
 * matching the precedent this task already set splitting
 * `requirementResolutionSteps.test.ts` out of `deleteResolutionEngine.test.ts`: the two
 * files no longer have a reason to import from each other, and a shared helper module would
 * be a dependency neither file's own subject needs.
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

/**
 * Test seam: fail `requirements.markStale` for exactly ONE named id, permanently — the
 * `delete-anyway` sibling of `failDeleteForRequirement`, needed so a `written`-outcome
 * referent's compensation (rather than a `remove-references` `'absent'`-outcome one) has a
 * failing second referent to trigger it.
 */
function failMarkStaleForRequirement(repo: InMemoryRequirementRepository, id: RequirementId): void {
	const inner = repo.markStale.bind(repo);
	repo.markStale = ((markId: Parameters<typeof inner>[0]) => {
		if (markId === id) {
			return Promise.resolve({
				ok: false as const,
				error: {
					category: 'Persistence' as const,
					code: 'requirement.mark-stale-failed',
					message: `markStale was configured to fail for ${String(id)}.`,
				},
			});
		}
		return inner(markId);
	}) as typeof repo.markStale;
}

/**
 * Test seam: fail the ZONE repository's `delete` — the entity being deleted, never a
 * referent — always. Used to reach `runDeleteResolution`'s compensation path AFTER every
 * referent write has already landed, which is the one window `deleteEntity` itself owns and
 * `failDeleteForRequirement` (which fails inside `applyAll`, before `deleteEntity` is ever
 * reached) cannot exercise.
 */
function failZoneDeleteAlways(zones: Awaited<ReturnType<typeof requirementFixture>>['zones']): void {
	zones.delete = (() =>
		Promise.resolve({
			ok: false as const,
			error: {
				category: 'Persistence' as const,
				code: 'zone.delete-failed',
				message: 'delete was configured to fail for the entity itself.',
			},
		})) as typeof zones.delete;
}

/**
 * Test seam: fail every `requirements.save` — the door BOTH a forward `written` write and a
 * `compensate` restore go through, but never the door `remove-references`'s forward write
 * uses (`requirements.delete`). Applied after a rig is fully built (fixture setup itself
 * saves requirements to create referents), it reaches only the compensating restore for a
 * `remove-references` resolution, which is the one write no case exercised failing.
 */
function failSaveAlways(repo: InMemoryRequirementRepository): void {
	repo.save = (() =>
		Promise.resolve({
			ok: false as const,
			error: {
				category: 'Persistence' as const,
				code: 'requirement.save-failed',
				message: 'save was configured to fail.',
			},
		})) as typeof repo.save;
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
	/** Fails deleting the entity itself, AFTER every referent write has landed — the one
	 *  window `runDeleteResolution`'s own publish-after-`deleteEntity` ordering is about. */
	readonly failEntityDelete?: boolean;
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
	if (options.failEntityDelete) {
		failZoneDeleteAlways(w.zones);
	}
	// `failSaveAlways` has no rig option: it must apply strictly AFTER fixture setup (which
	// itself saves requirements to create referents), so its one caller applies it directly
	// to `rig.requirements` once this function has returned.

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
/**
 * The resolution touches Requirements a deleted Zone's own `ZoneDeleted` event cannot
 * reach — a referent whose own `projectId` differs from the zone's. Not every case below
 * seeds one, and the split is deliberate rather than an oversight: it tracks what each case
 * is actually asserting rather than "every case in this file."
 *
 * The FORWARD-announcement cases (the `it.each` table, the project-naming case, and the
 * reassign-refused case — three `resolutionRig` calls) seed the referent in a DIFFERENT
 * project than the entity being deleted, because a same-project fixture passes against a
 * build that publishes nothing new: the zone event already covers it, and a same-project
 * fixture would certify the very defect this task closes.
 *
 * Every other case omits it, because none of them is asking a question a referent's
 * project can discriminate: whether a rolled-back write announces AT ALL, and which of
 * `RequirementCreated`/`RequirementRestored` it announces, turns on the write's forward
 * OUTCOME (`'deleted'` vs `'written'`) rather than on whose project it names; and the
 * reassign-succeeded case asserts that `RequirementRecalculated` fired instead of this
 * arm's own event, which `RecalculateRequirementCommand` publishes from the requirement's
 * own `projectId` regardless of which project that is.
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

	it('a successful compensation announces RequirementCreated for a removed referent it put back', async () => {
		// `remove-references`'s forward write DELETES the row, so putting it back is a
		// RE-CREATION — `RequirementCreated`, never `RequirementRestored` — the same split
		// `undoDeleteResolution` computes for its own restores (`entry.outcome === 'written'`
		// decides which). The counterpart below drives the OTHER arm of that split.
		const rig = await resolutionRig({
			resolution: 'remove-references',
			referentCount: 2,
			failSecondReferent: true,
		});
		const seenCreated: { payload: { requirementId: string; projectId: string } }[] = [];
		const seenDeleted: unknown[] = [];
		const seenRestored: unknown[] = [];
		rig.events.subscribe('RequirementCreated', (event) => {
			seenCreated.push(event as never);
		});
		// Collected rather than thrown from inside the handler: `createEventBus`'s delivery
		// wraps every subscriber in a `.catch` and swallows it, so a throwing subscriber can
		// never fail this case — it only reads as an assertion. Collect-and-assert-empty is
		// the one shape that actually discriminates.
		rig.events.subscribe('RequirementDeleted', (event) => {
			seenDeleted.push(event);
		});
		rig.events.subscribe('RequirementRestored', (event) => {
			seenRestored.push(event);
		});

		const result = await rig.command.execute(rig.input);
		expect(result.ok).toBe(false);

		// The first (lexically-earliest ULID) referent is the one whose removal succeeds
		// and is then rolled back; the second is the one whose own delete was made to fail.
		const restoredId = rig.input.resolvedReferents[0];
		expect(seenDeleted).toEqual([]);
		expect(seenRestored).toEqual([]);
		expect(seenCreated).toHaveLength(1);
		expect(seenCreated[0]?.payload.requirementId).toBe(restoredId);
	});

	it('a successful compensation announces RequirementRestored for a written referent it rolled back', async () => {
		// `delete-anyway`'s forward write only marks the row STALE — a genuine edit, not a
		// removal — so rolling it back is a restore and never a re-creation.
		const rig = await resolutionRig({ resolution: 'delete-anyway', referentCount: 2 });
		failMarkStaleForRequirement(rig.requirements, rig.input.resolvedReferents[1] as RequirementId);

		const seenRestored: { payload: { requirementId: string } }[] = [];
		const seenCreated: unknown[] = [];
		rig.events.subscribe('RequirementRestored', (event) => {
			seenRestored.push(event as never);
		});
		rig.events.subscribe('RequirementCreated', (event) => {
			seenCreated.push(event);
		});

		const result = await rig.command.execute(rig.input);
		expect(result.ok).toBe(false);

		const restoredId = rig.input.resolvedReferents[0];
		expect(seenCreated).toEqual([]);
		expect(seenRestored).toHaveLength(1);
		expect(seenRestored[0]?.payload.requirementId).toBe(restoredId);
	});

	it('does not announce RequirementDeleted when the entity itself cannot be deleted', async () => {
		// The window `runDeleteResolution`'s own "publish after deleteEntity" ordering is
		// about: every referent write has already landed when the entity's own delete
		// refuses, so `compensate` runs and rolls the referent back before anything is told.
		const rig = await resolutionRig({ resolution: 'remove-references', failEntityDelete: true });
		const seenDeleted: unknown[] = [];
		const seenCreated: { payload: { requirementId: string } }[] = [];
		rig.events.subscribe('RequirementDeleted', (event) => {
			seenDeleted.push(event);
		});
		rig.events.subscribe('RequirementCreated', (event) => {
			seenCreated.push(event as never);
		});

		const result = await rig.command.execute(rig.input);
		expect(result.ok).toBe(false);

		expect(seenDeleted).toEqual([]);
		expect(seenCreated).toHaveLength(1);
		expect(seenCreated[0]?.payload.requirementId).toBe(rig.input.resolvedReferents[0]);
	});

	it('does not announce anything for a compensation whose own restore refuses', async () => {
		// Reachable: a compensation whose `restoreRequirement` refuses sets `uncompensated`
		// and logs; nothing before this asserted what it announces.
		const rig = await resolutionRig({
			resolution: 'remove-references',
			referentCount: 2,
			failSecondReferent: true,
		});
		failSaveAlways(rig.requirements);

		const seenCreated: unknown[] = [];
		const seenRestored: unknown[] = [];
		rig.events.subscribe('RequirementCreated', (event) => {
			seenCreated.push(event);
		});
		rig.events.subscribe('RequirementRestored', (event) => {
			seenRestored.push(event);
		});

		const result = await rig.command.execute(rig.input);
		expect(result.ok).toBe(false);

		expect(seenCreated).toEqual([]);
		expect(seenRestored).toEqual([]);
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
