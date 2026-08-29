import { describe, expect, it } from 'vitest';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AppError, PersistenceError } from '../../../src/core/errors/AppError';
import {
	requirementResolutionSteps,
	runDeleteResolution,
	type ResolutionOps,
	type SequenceMarker,
	type SequenceMarkerStore,
} from '../../../src/application/reference/deleteResolution';
import type {
	EntityVersion,
	Expected,
	Loaded,
	ObservationToken,
} from '../../../src/application/ports/versioning';

import type { Requirement } from '../../../src/domain/requirement/Requirement';
import { makeRequirement } from '../../helpers/entities';
import { ReferenceLocks } from '../../../src/application/reference/ReferenceLocks';
import { leftWritesBehind, markUncompensated } from '../../../src/application/commands/DispatchOutcome';
import { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';

/**
 * The compensated sequence's own arms, driven at the engine with hand-built `ops` — the
 * compensation, marker and refusal branches the command-level suites reach only through
 * their kind-specific closures. Every failure here is injected once, at one step, so a
 * green run says exactly which arm held.
 */

function injectedPersistenceError(): PersistenceError {
	return { category: 'Persistence', code: 'test.injected-failure', message: 'Injected.' };
}

const V1: EntityVersion = { revision: 1, observed: 't1' as ObservationToken };
const V2: EntityVersion = { revision: 2, observed: 't2' as ObservationToken };

function referent(id: string): Loaded<Requirement> {
	const entity = makeRequirement({
		projectId: 'project-x' as never,
		assetId: 'asset-x' as never,
		origin: { kind: 'zone', zoneId: 'zone-x' as never },
		id: id as never,
	});
	return { entity, version: { ...V1 } };
}

const REQUIREMENT_IDS = ['requirement-1', 'requirement-2'];

interface RecordedOps extends ResolutionOps<Record<string, unknown>> {
	readonly warnings: string[];
	readonly errors: string[];
	readonly deletedAtVersions: EntityVersion[];
	restored: { id: string; expected: Expected }[];
	markStaleResults: Result<EntityVersion, PersistenceError>[];
	removeResults: Result<void, PersistenceError>[];
	repointResults: Result<EntityVersion, PersistenceError>[];
	recalculateResults: Result<unknown, AppError>[];
	restoreResult: Result<EntityVersion, PersistenceError> | null;
}

function makeOps(overrides?: {
	referents?: readonly Loaded<Requirement>[];
	loadEntity?: () => Promise<Result<Loaded<Record<string, unknown>> | null, PersistenceError>>;
	deleteEntityError?: PersistenceError;
	validateTargetError?: AppError;
}): RecordedOps {
	const warnings: string[] = [];
	const errors: string[] = [];
	const ops: RecordedOps = {
		entityId: 'entity-1',
		entityKind: 'zone',
		logger: {
			debug() {},
			info() {},
			warn(event) {
				warnings.push(event);
			},
			error(event) {
				errors.push(event);
			},
		},
		warnings,
		errors,
		deletedAtVersions: [],
		restored: [],
		listReferents: () =>
			Promise.resolve(ok([...(overrides?.referents ?? REQUIREMENT_IDS.map((id) => referent(id)))])),
		loadEntity:
			overrides?.loadEntity ??
			(() =>
				Promise.resolve(
					ok({ entity: {} as Record<string, unknown>, version: { ...V1 } }),
				)),
		deleteEntity: (expected) => {
			if (overrides?.deleteEntityError) return Promise.resolve(err(overrides.deleteEntityError));
			ops.deletedAtVersions.push(expected);
			return Promise.resolve(ok(undefined));
		},
		validateReassignTarget: () =>
			Promise.resolve(
				overrides?.validateTargetError
					? err(overrides.validateTargetError)
					: ok(undefined),
			),
		markStalePersisted: (snapshot) => {
			const next = ops.markStaleResults.shift();
			if (next === undefined) throw new Error(`unexpected markStale for ${String(snapshot.entity.id)}`);
			return Promise.resolve(next);
		},
		removeRequirement: (snapshot) => {
			const next = ops.removeResults.shift();
			if (next === undefined) throw new Error(`unexpected remove for ${String(snapshot.entity.id)}`);
			return Promise.resolve(next);
		},
		repointAndMarkStale: (snapshot) => {
			const next = ops.repointResults.shift();
			if (next === undefined) throw new Error(`unexpected repoint for ${String(snapshot.entity.id)}`);
			return Promise.resolve(next);
		},
		recalculateInline: (id) => {
			const result = ops.recalculateResults.shift();
			if (result === undefined) throw new Error(`unexpected recalculate for ${String(id)}`);
			return Promise.resolve(result);
		},
		restoreRequirement: (snapshot, expected) => {
			ops.restored.push({ id: String(snapshot.entity.id), expected });
			const scripted = ops.restoreResult;
			if (scripted && !scripted.ok) return Promise.resolve(scripted as never);
			return Promise.resolve(ok({ ...(expected === 'absent' ? V1 : expected), observed: 'r' as ObservationToken }));
		},
	};
	// Two forward writes succeed by default; each test shifts in failures it needs.
	ops.markStaleResults = [ok({ ...V2 }), ok({ ...V2 })];
	ops.removeResults = [ok(undefined), ok(undefined)];
	ops.repointResults = [ok({ ...V2 }), ok({ ...V2 })];
	ops.recalculateResults = [];
	ops.restoreResult = null;
	return ops;
}

/** A marker store whose Nth write or clear fails — the durable-record failure points. */
class ScriptedMarkers implements SequenceMarkerStore {
	private writes = 0;
	private clears = 0;
	lastWrite: SequenceMarker | null = null;

	constructor(
		private readonly failWriteOn: readonly number[] = [],
		private readonly failClearOn: readonly number[] = [],
	) {}

	read(): Promise<Result<SequenceMarker | null, PersistenceError>> {
		return Promise.resolve(ok(null));
	}

	write(marker: SequenceMarker): Promise<Result<void, PersistenceError>> {
		this.writes += 1;
		this.lastWrite = marker;
		return Promise.resolve(
			this.failWriteOn.includes(this.writes) ? err(injectedPersistenceError()) : ok(undefined),
		);
	}

	clear(entityId: string): Promise<Result<void, PersistenceError>> {
		this.clears += 1;
		void entityId;
		return Promise.resolve(
			this.failClearOn.includes(this.clears) ? err(injectedPersistenceError()) : ok(undefined),
		);
	}
}

describe('runDeleteResolution refusals before any write', () => {
	it('answers reference.entity-gone when the entity vanished after the locks', async () => {
		const ops = makeOps({
			referents: [],
			loadEntity: () => Promise.resolve(ok(null)),
		});
		const locks = {
			beginSession: () => ({
				acquire: () => Promise.resolve(undefined),
				release: () => undefined,
			}),
		} as never;
		const error = (await runDeleteResolution(ops, {}, locks)) as { ok: false; error: AppError };
		expect(error.error.code).toBe('reference.entity-gone');
		expect(ops.deletedAtVersions).toHaveLength(0);
	});

	it('propagates a failed referent listing without touching the entity', async () => {
		const ops = makeOps();
		ops.listReferents = () => Promise.resolve(err(injectedPersistenceError()));
		const result = await runDeleteResolution(ops, {}, new ReferenceLocks());
		expect(result).toMatchObject({ ok: false, error: { code: 'test.injected-failure' } });
	});

	it('validates the reassignment target under the lock and refuses on its answer', async () => {
		const ops = makeOps({
			validateTargetError: {
				category: 'Reference',
				code: 'reference.reassign-target-gone',
				message: 'gone',
			},
		});
		const result = await runDeleteResolution(
			ops,
			{ resolution: 'reassign', reassignTo: 'entity-9', resolvedReferents: [] },
			new ReferenceLocks(),
		);
		expect(result).toMatchObject({ ok: false, error: { code: 'reference.reassign-target-gone' } });
	});

	it('a failing FIRST marker write aborts before any mutation', async () => {
		const ops = makeOps();
		const markers = new ScriptedMarkers([1]);
		const result = await runDeleteResolution(ops, { resolution: 'delete-anyway', resolvedReferents: REQUIREMENT_IDS }, new ReferenceLocks(), markers);
		expect(result).toMatchObject({ ok: false, error: { code: 'test.injected-failure' } });
		expect(ops.markStaleResults).toHaveLength(2);
		expect(ops.deletedAtVersions).toHaveLength(0);
	});

	it('propagates a failed entity snapshot read', async () => {
		const ops = makeOps({
			referents: [],
			loadEntity: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const result = await runDeleteResolution(ops, {}, new ReferenceLocks());
		expect(result).toMatchObject({ ok: false, error: { code: 'test.injected-failure' } });
	});
});

describe('compensation', () => {
	it('a forward write failing mid-sequence restores the completed writes with their recorded versions', async () => {
		const ops = makeOps();
		// First requirement marks stale fine; second fails. The scripted store stands in
		// for the real one because the real one structuredClones the marker, and a
		// Requirement carries Decimal instances no clone can copy.
		ops.markStaleResults = [ok({ ...V2 }), err(injectedPersistenceError())];
		const markers = new ScriptedMarkers();

		const result = await runDeleteResolution(
			ops,
			{ resolution: 'delete-anyway', resolvedReferents: REQUIREMENT_IDS },
			new ReferenceLocks(),
			markers,
		);

		expect(result).toMatchObject({ ok: false, error: { code: 'test.injected-failure' } });
		expect(ops.restored).toEqual([{ id: 'requirement-1', expected: { ...V2 } }]);
		expect(ops.deletedAtVersions).toHaveLength(0);
		// The durable record survives for recovery: the completed write is still in progress.
		if (markers.lastWrite === null) throw new Error('expected a marker to have been written');
		expect(markers.lastWrite.progress).toEqual([
			{ id: 'requirement-1', outcome: 'written', version: { ...V2 } },
		]);
	});

	it('a removed requirement is restored against `absent`, not a revision', async () => {
		const ops = makeOps({ referents: [referent('requirement-1')] });
		ops.removeResults = [err(injectedPersistenceError())];
		const result = await runDeleteResolution(
			ops,
			{ resolution: 'remove-references', resolvedReferents: ['requirement-1'] },
			new ReferenceLocks(),
		);
		expect(result).toMatchObject({ ok: false, error: { code: 'test.injected-failure' } });
	});

	it('a failed DELETE compensates both removals against `absent`', async () => {
		const ops = makeOps({ deleteEntityError: injectedPersistenceError() });
		const result = await runDeleteResolution(
			ops,
			{ resolution: 'remove-references', resolvedReferents: REQUIREMENT_IDS },
			new ReferenceLocks(),
		);
		expect(result).toMatchObject({ ok: false, error: { code: 'test.injected-failure' } });
		expect(ops.restored).toEqual([
			{ id: 'requirement-2', expected: 'absent' },
			{ id: 'requirement-1', expected: 'absent' },
		]);
	});

	it('a failed reassignment repoint compensates and fails the sequence', async () => {
		const ops = makeOps({ referents: [referent('requirement-1')] });
		ops.repointResults = [err(injectedPersistenceError())];
		const result = await runDeleteResolution(
			ops,
			{ resolution: 'reassign', reassignTo: 'entity-9', resolvedReferents: ['requirement-1'] },
			new ReferenceLocks(),
		);
		expect(result).toMatchObject({ ok: false, error: { code: 'test.injected-failure' } });
		expect(ops.deletedAtVersions).toHaveLength(0);
	});

	it('restoreRequirement refusing during compensation is LOGGED and the original cause still returned', async () => {
		const ops = makeOps();
		ops.markStaleResults = [ok({ ...V2 }), err(injectedPersistenceError())];
		ops.restoreResult = err(injectedPersistenceError());

		const result = await runDeleteResolution(
			ops,
			{ resolution: 'delete-anyway', resolvedReferents: REQUIREMENT_IDS },
			new ReferenceLocks(),
		);

		expect(result).toMatchObject({ ok: false, error: { code: 'test.injected-failure' } });
		expect(ops.errors).toContain('sequence.compensation.failed');
	});

	/**
	 * **A refusal the category axis cannot see, which is what this stamp exists for.** The
	 * sequence marks the first Requirement stale — a WRITE — refuses on the second, and then
	 * fails to restore the first. The vault is left holding a stale marker nothing put back.
	 * The error the caller receives is whatever the FORWARD step refused with; here that is a
	 * `Persistence` code, but `applyAll`'s reachable refusals include `Reference` ones
	 * (`markStalePersisted` re-reads through `loadRequirement` AFTER its own write), and a
	 * `Reference` error is exactly what `affectsSaveState` reads as "wrote nothing". The
	 * stamp is what makes the answer independent of the category the refusal happened to carry.
	 *
	 * Asserted BESIDE the existing log expectation rather than instead of it: a log entry is
	 * not a recovery, and it was never the user-facing half — the badge is.
	 */
	it('a FAILED compensation stamps the refusal as having left writes behind', async () => {
		const ops = makeOps();
		ops.markStaleResults = [ok({ ...V2 }), err(injectedPersistenceError())];
		ops.restoreResult = err(injectedPersistenceError());

		const result = await runDeleteResolution(
			ops,
			{ resolution: 'delete-anyway', resolvedReferents: REQUIREMENT_IDS },
			new ReferenceLocks(),
		);

		if (result.ok) throw new Error('expected the sequence to refuse');
		expect(leftWritesBehind(result.error)).toBe(true);
		// The stamp is ADDITIVE: nothing a message or a mapping reads has moved, which is the
		// property that kept this out of slice 17's error-to-surface territory.
		expect(result.error.code).toBe('test.injected-failure');
		expect(result.error.category).toBe('Persistence');
	});

	/**
	 * **The two stamping sites compose, and this is the only case where they disagree.** A step
	 * can stamp its own refusal (`markStalePersisted`, whose write lands before its re-read
	 * refuses) while compensation of the EARLIER referents then succeeds — so `compensate`
	 * computes `uncompensated: false` and must still return the stamp it was handed rather
	 * than the clean copy its own loop concluded. Nothing about the successful restores makes
	 * the step's own unrecorded write go away.
	 */
	it('a stamp already on the cause survives a compensation that succeeds', async () => {
		const ops = makeOps();
		ops.markStaleResults = [
			ok({ ...V2 }),
			err(markUncompensated(injectedPersistenceError())),
		];

		const result = await runDeleteResolution(
			ops,
			{ resolution: 'delete-anyway', resolvedReferents: REQUIREMENT_IDS },
			new ReferenceLocks(),
		);

		if (result.ok) throw new Error('expected the sequence to refuse');
		expect(ops.restored).toEqual([{ id: 'requirement-1', expected: { ...V2 } }]);
		expect(leftWritesBehind(result.error)).toBe(true);
	});

	/**
	 * The other half, and the reason this is a stamp rather than "any refusal after step 2".
	 * A compensation that SUCCEEDS has put the vault back at its pre-state, so nothing the
	 * refusal wrote survived and neutral is the TRUE answer. Marking it would be the false
	 * badge the two rejected fixes were rejected for.
	 */
	it('a SUCCESSFUL compensation leaves the refusal unstamped', async () => {
		const ops = makeOps();
		ops.markStaleResults = [ok({ ...V2 }), err(injectedPersistenceError())];

		const result = await runDeleteResolution(
			ops,
			{ resolution: 'delete-anyway', resolvedReferents: REQUIREMENT_IDS },
			new ReferenceLocks(),
		);

		if (result.ok) throw new Error('expected the sequence to refuse');
		expect(ops.restored).toEqual([{ id: 'requirement-1', expected: { ...V2 } }]);
		expect(leftWritesBehind(result.error)).toBe(false);
	});

	/**
	 * A refusal on the FIRST requirement leaves `progress` empty, so compensation restores
	 * nothing and there is nothing to be uncompensated — even with `restoreRequirement`
	 * rigged to refuse. Pins that an empty loop cannot stamp.
	 */
	it('a refusal before the first write is unstamped even when restore would refuse', async () => {
		const ops = makeOps();
		ops.markStaleResults = [err(injectedPersistenceError())];
		ops.restoreResult = err(injectedPersistenceError());

		const result = await runDeleteResolution(
			ops,
			{ resolution: 'delete-anyway', resolvedReferents: REQUIREMENT_IDS },
			new ReferenceLocks(),
		);

		if (result.ok) throw new Error('expected the sequence to refuse');
		expect(ops.restored).toEqual([]);
		expect(leftWritesBehind(result.error)).toBe(false);
	});

	it('an inline recalculation failure does NOT fail a successful reassignment — it logs', async () => {
		const ops = makeOps({ referents: [referent('requirement-1')] });
		ops.recalculateResults = [
			err({ category: 'Calculation', code: 'requirement.zone-gone', message: 'gone' }),
		];
		const result = await runDeleteResolution(
			ops,
			{ resolution: 'reassign', reassignTo: 'entity-9', resolvedReferents: ['requirement-1'] },
			new ReferenceLocks(),
		);
		expect(result.ok).toBe(true);
		expect(ops.warnings).toContain('requirement.reassignment-recalculation.failed');
		if (!result.ok) throw new Error('expected success');
		expect(result.value.affectedAfter).toHaveLength(1);
	});
});

describe('marker bookkeeping on the success path', () => {
	it('the post-delete marker update failing is logged but does not fail the sequence', async () => {
		const ops = makeOps();
		// Writes: the initial marker, one per completed forward write (two), then the
		// post-delete update — the fourth is the arm this test drives.
		const markers = new ScriptedMarkers([4]);
		const result = await runDeleteResolution(
			ops,
			{ resolution: 'delete-anyway', resolvedReferents: REQUIREMENT_IDS },
			new ReferenceLocks(),
			markers,
		);
		expect(result.ok).toBe(true);
		expect(ops.errors).toContain('sequence.marker-update.failed');
	});

	it('a marker write failing MID-sequence compensates the write it followed', async () => {
		const ops = makeOps({ referents: [referent('requirement-1')] });
		// Write #1 is the initial marker; write #2 records the first completed forward
		// write — its failure must not strand that write uncompensated.
		const markers = new ScriptedMarkers([2]);
		const result = await runDeleteResolution(
			ops,
			{ resolution: 'delete-anyway', resolvedReferents: ['requirement-1'] },
			new ReferenceLocks(),
			markers,
		);
		expect(result).toMatchObject({ ok: false, error: { code: 'test.injected-failure' } });
		expect(ops.restored).toEqual([{ id: 'requirement-1', expected: { ...V2 } }]);
		expect(ops.deletedAtVersions).toHaveLength(0);
	});

	it('a failed final marker CLEAR is logged and the resolution still answers', async () => {
		const ops = makeOps();
		const markers = new ScriptedMarkers([], [1]);
		const result = await runDeleteResolution(
			ops,
			{ resolution: 'remove-references', resolvedReferents: REQUIREMENT_IDS },
			new ReferenceLocks(),
			markers,
		);
		expect(result.ok).toBe(true);
		expect(ops.errors).toContain('sequence.marker-clear.failed');
	});
});


/**
 * **The post-write refusal that never reaches `compensate`'s loop, which is why closing the
 * loop case alone would have been a partial fix wearing a complete one's clothes.**
 * `markStalePersisted` WRITES (`requirements.markStale`) and then re-reads through
 * `loadRequirement`. When the re-read refuses, `applyResolutionToRequirement` returns before
 * `applyAll` can append anything to `marker.progress` — so the write that just landed is in
 * no progress record, `compensate` iterates past it, and nothing restores it. The step is the
 * only code that knows, so the step is what stamps.
 *
 * `repointAndMarkStale` deliberately has no counterpart case: its own refusals all precede
 * its `save`, and a failed `save` wrote nothing.
 */
const noRecalculation = { execute: () => Promise.resolve(ok(undefined)) };

/** `delete-anyway` never repoints, so this arm of the step set must not be reached. */
function repointNowhere(): never {
	throw new Error('not reached');
}

describe('requirementResolutionSteps', () => {
	/** `markStale` lands; the requirement is gone by the time the step re-reads it. */
	class VanishesAfterMarkStale extends InMemoryRequirementRepository {
		private vanished = false;

		override markStale(id: Parameters<InMemoryRequirementRepository['markStale']>[0]) {
			const marked = super.markStale(id);
			this.vanished = true;
			return marked;
		}

		override getById(id: Parameters<InMemoryRequirementRepository['getById']>[0]) {
			if (this.vanished) return Promise.resolve(ok(null));
			return super.getById(id);
		}
	}

	it('stamps a re-read refusal that follows its own markStale write', async () => {
		const requirements = new VanishesAfterMarkStale();
		const saved = await requirements.save(referent('requirement-1').entity, 'absent');
		if (!saved.ok) throw new Error('fixture failed to save');

		const steps = requirementResolutionSteps(requirements, noRecalculation, repointNowhere);
		const result = await steps.markStalePersisted(saved.value);

		if (result.ok) throw new Error('expected the re-read to refuse');
		// The category is the one `affectsSaveState` reads as "wrote nothing" — the exact
		// misreading the stamp exists to overrule.
		expect(result.error.category).toBe('Reference');
		expect(result.error.code).toBe('requirement.not-found');
		expect(leftWritesBehind(result.error)).toBe(true);
	});

	it('does NOT stamp a markStale that refused, because that one wrote nothing', async () => {
		class RefusesMarkStale extends InMemoryRequirementRepository {
			override markStale() {
				return Promise.resolve(err(injectedPersistenceError()));
			}
		}
		const requirements = new RefusesMarkStale();
		const saved = await requirements.save(referent('requirement-1').entity, 'absent');
		if (!saved.ok) throw new Error('fixture failed to save');

		const steps = requirementResolutionSteps(requirements, noRecalculation, repointNowhere);
		const result = await steps.markStalePersisted(saved.value);

		if (result.ok) throw new Error('expected markStale to refuse');
		expect(leftWritesBehind(result.error)).toBe(false);
	});
});
