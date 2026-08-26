import { beforeEach, describe, expect, it } from 'vitest';
import { ok, type Result } from '../../../src/core/result/Result';
import {
	undoDeleteResolution,
	type Compensation,
	type UndoSequenceOps,
} from '../../../src/application/reference/undoDeleteResolution';
import type { SequenceProgress } from '../../../src/application/reference/deleteResolution';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import type { Requirement } from '../../../src/domain/requirement/Requirement';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';
import type { Expected, Loaded } from '../../../src/application/ports/versioning';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import { expectErr, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { makeRequirement } from '../../helpers/entities';
import { lines, recorder, resetRecorder } from '../../helpers/logger';

/**
 * The undo half of a delete resolution, driven DIRECTLY rather than through
 * `ReversibleDeleteZoneCommand` — because the arms that matter most here are the ones a
 * driving command cannot easily produce: a read that fails mid-sequence, a compensation
 * that also fails, and a `progress` entry naming a Requirement the pre-state does not.
 * The adapter's own test covers the same engine as the user reaches it.
 */

const PROJECT = createProjectId();
const ZONE = createZoneId();

/**
 * Fails a chosen operation at the port — where a fault the code cannot branch on belongs.
 *
 * `failSaveOn` names 1-based CALL indices rather than ids, because the sequence saves the
 * same requirement twice — once to restore it, once to compensate that restore — and "the
 * compensation failed" is a different arm from "the restore failed" on the same entity.
 */
class Faulty extends InMemoryRequirementRepository {
	failGetById = false;
	failSaveOn: readonly number[] = [];
	private saves = 0;

	arm(calls: readonly number[]): void {
		this.saves = 0;
		this.failSaveOn = calls;
	}

	override getById(id: RequirementId) {
		if (this.failGetById) return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
		return super.getById(id);
	}

	override save(requirement: Requirement, expected: Expected) {
		this.saves += 1;
		if (this.failSaveOn.includes(this.saves)) {
			return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
		}
		return super.save(requirement, expected);
	}
}

async function seed(repo: InMemoryRequirementRepository, count: number): Promise<Loaded<Requirement>[]> {
	const saved: Loaded<Requirement>[] = [];
	for (let index = 0; index < count; index += 1) {
		saved.push(
			expectOk(
				await repo.save(
					makeRequirement({
						projectId: PROJECT,
						assetId: createAssetId(),
						origin: { kind: 'zone', zoneId: ZONE },
					}),
					'absent',
				),
			),
		);
	}
	return saved;
}

interface Wiring {
	readonly ops: UndoSequenceOps;
	readonly entityRestores: number;
	readonly entityCompensations: number;
}

/** An entity half that records rather than touching a repository — the zone is not this file's subject. */
function recordingEntity(
	repo: InMemoryRequirementRepository,
	options: { failRestore?: boolean; failCompensation?: boolean } = {},
): Wiring & { counts: { restores: number; compensations: number } } {
	const counts = { restores: 0, compensations: 0 };
	const compensation: Compensation = () => {
		counts.compensations += 1;
		return Promise.resolve(
			options.failCompensation ? { ok: false, error: injectedPersistenceError() } as const : ok(undefined),
		);
	};
	const ops: UndoSequenceOps = {
		entityId: String(ZONE),
		logger: recorder,
		requirements: repo,
		restoreEntity: (): Promise<Result<Compensation, ReturnType<typeof injectedPersistenceError>>> => {
			counts.restores += 1;
			if (options.failRestore) {
				return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
			}
			return Promise.resolve(ok(compensation));
		},
	};
	return { ops, counts, entityRestores: 0, entityCompensations: 0 };
}

describe('undoDeleteResolution', () => {
	beforeEach(resetRecorder);

	it('leaves a requirement the resolution never touched alone', async () => {
		const repo = new InMemoryRequirementRepository();
		const [untouched] = await seed(repo, 1);
		if (untouched === undefined) throw new Error('seed failed');
		const wiring = recordingEntity(repo);

		// A progress entry naming something `affectedBefore` does not carry: the sequence
		// has no snapshot to restore it FROM, and inventing one would be worse than skipping.
		const stray: SequenceProgress = { id: 'req-not-in-the-snapshot' as RequirementId, outcome: 'deleted' };
		const undone = await undoDeleteResolution(
			wiring.ops,
			{ affectedBefore: [], affectedAfter: [stray] },
			new ReferenceLocks(),
		);

		expect(expectOk(undone)).toBeUndefined();
		expect(expectOk(await repo.getById(untouched.entity.id))).not.toBeNull();
		expect(wiring.counts.compensations).toBe(0);
	});

	it('a failed entity restore stops before any requirement is written', async () => {
		const repo = new InMemoryRequirementRepository();
		const [one] = await seed(repo, 1);
		if (one === undefined) throw new Error('seed failed');
		await repo.delete(one.entity.id, one.version);
		const wiring = recordingEntity(repo, { failRestore: true });

		expectErr(
			await undoDeleteResolution(
				wiring.ops,
				{ affectedBefore: [one], affectedAfter: [{ id: one.entity.id, outcome: 'deleted' }] },
				new ReferenceLocks(),
			),
		);

		// Nothing to compensate, and the requirement was never restored.
		expect(wiring.counts.compensations).toBe(0);
		expect(expectOk(await repo.getById(one.entity.id))).toBeNull();
	});

	it('a failed READ of a requirement rolls the entity restore back', async () => {
		const repo = new Faulty();
		const [one] = await seed(repo, 1);
		if (one === undefined) throw new Error('seed failed');
		const wiring = recordingEntity(repo);
		repo.failGetById = true;

		const error = expectErr(
			await undoDeleteResolution(
				wiring.ops,
				{ affectedBefore: [one], affectedAfter: [{ id: one.entity.id, outcome: 'deleted' }] },
				new ReferenceLocks(),
			),
		);

		expect(error.code).toBe('test.injected-failure');
		expect(wiring.counts.compensations).toBe(1);
	});

	it('rolling back a WRITTEN entry puts back what was actually there, not an absence', async () => {
		// `delete-anyway` and `reassign` leave the requirement present, so the compensation
		// has an entity to replay — the arm a `remove-references` fixture never reaches.
		const repo = new Faulty();
		const seeded = await seed(repo, 2);
		const [first, second] = seeded;
		if (first === undefined || second === undefined) throw new Error('seed failed');
		const wiring = recordingEntity(repo);

		// The resolution rewrote both; the second restore (walked in reverse, so `first`)
		// is armed to fail, which forces `second`'s restore to be rolled back.
		const afterFirst = expectOk(await repo.save(first.entity, first.version));
		const afterSecond = expectOk(await repo.save(second.entity, second.version));
		// Walked in reverse: save 1 restores `second`, save 2 restores `first` and fails,
		// save 3 is `second`'s compensation.
		repo.arm([2]);

		expectErr(
			await undoDeleteResolution(
				wiring.ops,
				{
					affectedBefore: [first, second],
					affectedAfter: [
						{ id: first.entity.id, outcome: 'written', version: afterFirst.version },
						{ id: second.entity.id, outcome: 'written', version: afterSecond.version },
					],
				},
				new ReferenceLocks(),
			),
		);

		// `second` is back at the revision the resolution left, not at its pre-state one.
		const live = expectOk(await repo.getById(second.entity.id));
		expect(live?.version.revision).toBeGreaterThan(afterSecond.version.revision);
		expect(wiring.counts.compensations).toBe(1);
	});

	it('a REQUIREMENT compensation that also fails is logged, not returned', async () => {
		const repo = new Faulty();
		const seeded = await seed(repo, 2);
		const [first, second] = seeded;
		if (first === undefined || second === undefined) throw new Error('seed failed');
		const wiring = recordingEntity(repo);

		const afterFirst = expectOk(await repo.save(first.entity, first.version));
		const afterSecond = expectOk(await repo.save(second.entity, second.version));
		// Save 2 is the failing restore; save 3 is the compensation that also fails.
		repo.arm([2, 3]);

		const error = expectErr(
			await undoDeleteResolution(
				wiring.ops,
				{
					affectedBefore: [first, second],
					affectedAfter: [
						{ id: first.entity.id, outcome: 'written', version: afterFirst.version },
						{ id: second.entity.id, outcome: 'written', version: afterSecond.version },
					],
				},
				new ReferenceLocks(),
			),
		);

		expect(error.code).toBe('test.injected-failure');
		expect(lines.map((line) => line.event)).toContain('sequence.undo-compensation.failed');
	});

	it('a compensation that also fails is LOGGED, and the original failure is what is returned', async () => {
		const repo = new Faulty();
		const [one] = await seed(repo, 1);
		if (one === undefined) throw new Error('seed failed');
		await repo.delete(one.entity.id, one.version);
		const wiring = recordingEntity(repo, { failCompensation: true });
		repo.failGetById = true;

		const error = expectErr(
			await undoDeleteResolution(
				wiring.ops,
				{ affectedBefore: [one], affectedAfter: [{ id: one.entity.id, outcome: 'deleted' }] },
				new ReferenceLocks(),
			),
		);

		// The FIRST fault, not the second: the caller is told what went wrong, and the
		// compensation's own failure is a diagnostic nobody can act on in the return type.
		expect(error.code).toBe('test.injected-failure');
		expect(lines.map((line) => line.event)).toContain('sequence.undo-compensation.failed');
	});
});
