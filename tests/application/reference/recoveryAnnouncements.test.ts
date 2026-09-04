import { describe, expect, it } from 'vitest';
import { err } from '../../../src/core/result/Result';
import type { Result } from '../../../src/core/result/Result';
import type { RepositoryError } from '../../../src/application/ports/repositoryErrors';
import { of as moneyOf } from '../../../src/core/money/Money';
import { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { InMemorySequenceMarkerStore } from '../../../src/infrastructure/persistence/in-memory/InMemorySequenceMarkerStore';
import { recoverInterruptedSequences, type RecoveryDeps } from '../../../src/application/reference/recoverInterruptedSequences';
import type { SequenceMarker, SequenceProgress } from '../../../src/application/reference/deleteResolution';
import type { Requirement } from '../../../src/domain/requirement/Requirement';
import type { RequirementRepository } from '../../../src/application/ports/RequirementRepository';
import type { Loaded } from '../../../src/application/ports/versioning';
import type { Logger, LogLevel } from '../../../src/application/ports/Logger';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import { expectOk } from '../../helpers/domain';
import { makeRequirement } from '../../helpers/entities';
import { dispatchingEventBus, type RecordingBus } from '../../helpers/slice10';

/**
 * Task 10: crash recovery announces what it restores. `recoverInterruptedSequences`
 * computes the identical written/'absent' split `deleteResolution.ts`'s `compensate` and
 * `undoDeleteResolution.ts` already publish for their own restores (see
 * `RequirementRestored`'s docblock), and until this task it computed that split and
 * published NOTHING — `RecoveryDeps` carried no `EventBus` at all.
 *
 * The markers here are built by hand rather than by running a real delete resolution to
 * completion and killing it mid-sequence: `EntityVersion.observed` is minted by the store
 * at write time and cannot be fabricated, so each scenario seeds a real repository to get a
 * real token rather than inventing one.
 */

interface RecoveryScenario {
	readonly entityDeleted: boolean;
	/** The pre-state content a completed forward write is rolled back to. */
	readonly before: Requirement;
	/**
	 * What the store holds BEFORE recovery runs — the interrupted forward write's own
	 * result — or `null` when that write removed the referent (`remove-references`).
	 */
	readonly live: Requirement | null;
}

function overridePort<T extends object>(inner: T, patch: Record<string, unknown>): T {
	return Object.assign(Object.create(Object.getPrototypeOf(inner)), inner, patch) as T;
}

function baseRequirement(overrides: Partial<Parameters<typeof makeRequirement>[0]> = {}): Requirement {
	return makeRequirement({
		projectId: createProjectId(),
		assetId: createAssetId(),
		origin: { kind: 'zone', zoneId: createZoneId() },
		...overrides,
	});
}

/**
 * `delete-anyway`, interrupted after the stale marker landed: a WRITTEN restore that moves
 * no figure at all. This is the case that used to reach nobody, because no `CostEstimateChanged`
 * can carry a status-only change — restoring a referent to `current` marks nothing stale
 * and nothing else says so.
 */
function interruptedDeleteAnyway(): RecoveryScenario {
	const before = baseRequirement({ recalculationStatus: 'current' });
	const live = expectOk(before.markedStale());
	return { entityDeleted: false, before, live };
}

/** `remove-references`, interrupted after the requirement was deleted: putting it back is
 *  a re-creation, never a restore of a row that was merely edited. */
function interruptedRemoveReferences(): RecoveryScenario {
	return { entityDeleted: false, before: baseRequirement(), live: null };
}

/** A WRITTEN restore whose figures genuinely differ from what is live — the pre-state has
 *  no cost override and the interrupted write left one behind, so restoring moves the
 *  effective cost and earns a `CostEstimateChanged` beside the `RequirementRestored`. */
function interruptedWithMovedCost(): RecoveryScenario {
	const before = baseRequirement();
	const live = expectOk(before.withCostOverride(moneyOf('999.00', 'EUR')));
	return { entityDeleted: false, before, live };
}

interface LoggedLine {
	readonly level: LogLevel;
	readonly event: string;
	readonly context?: Record<string, unknown>;
}

function makeRecordingLogger(): Logger & { errors(): LoggedLine[]; lines: LoggedLine[] } {
	const recorded: LoggedLine[] = [];
	const record =
		(level: LogLevel) =>
		(event: string, context?: Record<string, unknown>): void => {
			recorded.push({ level, event, context });
		};
	return {
		debug: record('debug'),
		info: record('info'),
		warn: record('warn'),
		error: record('error'),
		errors: () => recorded.filter((line) => line.level === 'error'),
		lines: recorded,
	};
}

interface RecoveryRig {
	readonly deps: RecoveryDeps;
	readonly events: RecordingBus;
	readonly referentId: Requirement['id'];
	readonly projectId: Requirement['projectId'];
	readonly logger: ReturnType<typeof makeRecordingLogger>;
}

async function recoveryRig(opts: {
	readonly marker: RecoveryScenario;
	readonly failSave?: boolean;
}): Promise<RecoveryRig> {
	const scenario = opts.marker;
	const requirements = new InMemoryRequirementRepository();

	// Seed a REAL version token either way — `snapshot.version` in `affectedBefore` is
	// unused by `recoverOne` (only `.entity` is read), so any real token satisfies the type;
	// what has to be real is the PROGRESS entry's version, since that is what the
	// conditional restore compares against.
	const seeded = expectOk(await requirements.save(scenario.live ?? scenario.before, 'absent'));
	if (scenario.live === null) {
		expectOk(await requirements.delete(scenario.before.id, seeded.version));
	}

	const progress: SequenceProgress[] =
		scenario.live !== null
			? [{ id: scenario.before.id, outcome: 'written', version: seeded.version }]
			: [{ id: scenario.before.id, outcome: 'deleted' }];

	const markers = new InMemorySequenceMarkerStore();
	const marker: SequenceMarker = {
		schemaVersion: 1,
		kind: 'delete-resolution',
		entityKind: 'zone',
		entityId: 'recovery-announcements-zone',
		entitySnapshot: { entity: {}, version: seeded.version } as never,
		entityDeleted: scenario.entityDeleted,
		affectedBefore: [{ entity: scenario.before, version: seeded.version }],
		progress,
	};
	await markers.write(marker);

	const requirementsPort: RequirementRepository = opts.failSave
		? overridePort(requirements, {
				save: () =>
					Promise.resolve(
						err({ category: 'Persistence', code: 'test.injected', message: 'injected restore refusal' }),
					),
			})
		: requirements;

	const events = dispatchingEventBus();
	const logger = makeRecordingLogger();

	return {
		deps: { markers, requirements: requirementsPort, events, logger },
		events,
		referentId: scenario.before.id,
		projectId: scenario.before.projectId,
		logger,
	};
}

describe('recoverInterruptedSequences announces what it restores', () => {
	it('announces a status-only restore, which no cost event can carry', async () => {
		// delete-anyway left the referent stale; the pre-state is current; no figure moves.
		const rig = await recoveryRig({ marker: interruptedDeleteAnyway() });
		const seen: unknown[] = [];
		rig.events.subscribe('RequirementRestored', (event) => {
			seen.push(event);
		});
		// Collected rather than thrown — `createEventBus`'s `deliver` wraps each handler in
		// `.catch` and swallows, so asserting a forbidden event by throwing would pass
		// whether or not it fired.
		const costs: unknown[] = [];
		rig.events.subscribe('CostEstimateChanged', (event) => {
			costs.push(event);
		});

		await recoverInterruptedSequences(rig.deps);

		expect(seen).toEqual([
			{
				type: 'RequirementRestored',
				payload: { requirementId: rig.referentId, projectId: rig.projectId },
			},
		]);
		expect(costs).toEqual([]);
	});

	it('announces a requirement put back from absent as a creation', async () => {
		const rig = await recoveryRig({ marker: interruptedRemoveReferences() });
		const seen: string[] = [];
		rig.events.subscribe('RequirementCreated', () => {
			seen.push('created');
		});
		rig.events.subscribe('RequirementRestored', () => {
			seen.push('restored');
		});

		await recoverInterruptedSequences(rig.deps);

		expect(seen).toEqual(['created']);
	});

	it('announces the cost too when the restore actually moved one', async () => {
		const rig = await recoveryRig({ marker: interruptedWithMovedCost() });
		const seen: string[] = [];
		rig.events.subscribe('RequirementRestored', () => {
			seen.push('restored');
		});
		rig.events.subscribe('CostEstimateChanged', () => {
			seen.push('cost');
		});

		await recoverInterruptedSequences(rig.deps);

		expect(seen).toEqual(['restored', 'cost']);
	});

	it('announces nothing for a refused restore', async () => {
		const rig = await recoveryRig({ marker: interruptedDeleteAnyway(), failSave: true });
		const seen: unknown[] = [];
		rig.events.subscribe('RequirementRestored', (event) => {
			seen.push(event);
		});

		await recoverInterruptedSequences(rig.deps);

		expect(seen).toEqual([]);
		expect(rig.logger.errors()).toContainEqual(
			expect.objectContaining({ event: 'sequence.recovery.restore-refused' }),
		);
	});

	// A COMPLETED sequence is not rolled back, so it announces nothing — the guard
	// `recoverOne`'s docblock exists for, asserted so a build that starts publishing here
	// fails.
	it('announces nothing for a marker describing a completed sequence', async () => {
		const rig = await recoveryRig({ marker: { ...interruptedDeleteAnyway(), entityDeleted: true } });
		const seen: unknown[] = [];
		rig.events.subscribe('RequirementRestored', (event) => {
			seen.push(event);
		});

		await recoverInterruptedSequences(rig.deps);

		expect(seen).toEqual([]);
	});
});

/**
 * The cost pre-read is BEST-EFFORT and must never gate the restore — a malformed live note
 * is exactly what `getById` refuses and exactly what the conditional `save` can still
 * overwrite, so failing here would abandon the row recovery exists to fix, and (before this
 * pair existed) a REJECTED read escaped past the missing `.catch` and took the outer
 * `try`/`catch` with it, abandoning every marker still queued behind it. Two cases, because
 * a refused read and a rejected one arrive through different arms of the same expression
 * and a case for one passes against a build that mishandles the other.
 */
describe('the cost pre-read is best-effort and never gates the restore', () => {
	async function twoMarkerRig(
		getByIdForA: () => Promise<Result<Loaded<Requirement> | null, RepositoryError>>,
	) {
		const a = interruptedDeleteAnyway();
		const b = interruptedDeleteAnyway();
		const requirements = new InMemoryRequirementRepository();
		const markers = new InMemorySequenceMarkerStore();

		for (const [index, scenario] of [a, b].entries()) {
			const seeded = expectOk(await requirements.save(scenario.live ?? scenario.before, 'absent'));
			await markers.write({
				schemaVersion: 1,
				kind: 'delete-resolution',
				entityKind: 'zone',
				entityId: `recovery-announcements-zone-${index}`,
				entitySnapshot: { entity: {}, version: seeded.version } as never,
				entityDeleted: false,
				affectedBefore: [{ entity: scenario.before, version: seeded.version }],
				progress: [{ id: scenario.before.id, outcome: 'written', version: seeded.version }],
			});
		}

		const innerGetById = requirements.getById.bind(requirements);
		const requirementsPort = overridePort(requirements, {
			getById: (id: Requirement['id']) => (id === a.before.id ? getByIdForA() : innerGetById(id)),
		});

		const events = dispatchingEventBus();
		const logger = makeRecordingLogger();
		return {
			deps: { markers, requirements: requirementsPort, events, logger } as RecoveryDeps,
			a,
			b,
			logger,
		};
	}

	it('restores past a REFUSED pre-read and still recovers the marker behind it', async () => {
		const rig = await twoMarkerRig(() =>
			Promise.resolve(
				err({ category: 'Persistence', code: 'test.injected', message: 'the cost baseline refused to be read' }),
			),
		);
		const restored: unknown[] = [];
		rig.deps.events.subscribe('RequirementRestored', (event) => {
			restored.push(event);
		});
		const costs: unknown[] = [];
		rig.deps.events.subscribe('CostEstimateChanged', (event) => {
			costs.push(event);
		});

		await recoverInterruptedSequences(rig.deps);

		// Both markers restored — the refused pre-read on A did not abandon B — and neither
		// moved a figure, so no CostEstimateChanged fires for either.
		expect(restored).toHaveLength(2);
		expect(costs).toEqual([]);
		expect(rig.logger.lines).toContainEqual(
			expect.objectContaining({ event: 'sequence.recovery.cost-baseline-unreadable' }),
		);
		expect(expectOk(await rig.deps.markers.list())).toEqual([]);
	});

	it('restores past a REJECTED pre-read and still recovers the marker behind it', async () => {
		const rig = await twoMarkerRig(() =>
			Promise.reject(new Error('the vault exploded reading the cost baseline')),
		);
		const restored: unknown[] = [];
		rig.deps.events.subscribe('RequirementRestored', (event) => {
			restored.push(event);
		});

		await recoverInterruptedSequences(rig.deps);

		expect(restored).toHaveLength(2);
		expect(rig.logger.lines).toContainEqual(
			expect.objectContaining({ event: 'sequence.recovery.cost-baseline-unreadable' }),
		);
		expect(expectOk(await rig.deps.markers.list())).toEqual([]);
	});
});
