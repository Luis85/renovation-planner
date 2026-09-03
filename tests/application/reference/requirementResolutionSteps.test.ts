import { describe, expect, it } from 'vitest';
import { err, ok } from '../../../src/core/result/Result';
import type { PersistenceError } from '../../../src/core/errors/AppError';
import { requirementResolutionSteps } from '../../../src/application/reference/deleteResolution';
import type { EntityVersion, Loaded, ObservationToken } from '../../../src/application/ports/versioning';
import type { Requirement } from '../../../src/domain/requirement/Requirement';
import type { RequirementId } from '../../../src/domain/requirement/RequirementId';
import { makeRequirement } from '../../helpers/entities';
import { leftWritesBehind } from '../../../src/application/commands/DispatchOutcome';
import { InMemoryRequirementRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';

/**
 * `requirementResolutionSteps` builds the per-kind closures `DeleteZoneCommand` and
 * `DeleteAssetCommand` hand `runDeleteResolution` — split from `deleteResolutionEngine.test.ts`
 * (which drives the ENGINE itself with hand-built `ops`, over `runDeleteResolution`) because
 * this is a different unit with a different failure mode: the step-builder's own
 * `markStalePersisted`, which WRITES and then RE-READS, and has to stamp a post-write refusal
 * that the engine's own `compensate` loop can never see (the write never reached
 * `marker.progress` for it to iterate over). Nothing here calls `runDeleteResolution`.
 */

function injectedPersistenceError(): PersistenceError {
	return { category: 'Persistence', code: 'test.injected-failure', message: 'Injected.' };
}

const V1: EntityVersion = { revision: 1, observed: 't1' as ObservationToken };

/** The single-referent cases all name the same id. */
const FIRST_REQUIREMENT = 'requirement-1' as unknown as RequirementId;

function referent(id: RequirementId): Loaded<Requirement> {
	const entity = makeRequirement({
		projectId: 'project-x' as never,
		assetId: 'asset-x' as never,
		origin: { kind: 'zone', zoneId: 'zone-x' as never },
		id,
	});
	return { entity, version: { ...V1 } };
}

const noRecalculation = { execute: () => Promise.resolve(ok(undefined)) };

/** `delete-anyway` never repoints, so this arm of the step set must not be reached. */
function repointNowhere(): never {
	throw new Error('not reached');
}

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
		const saved = await requirements.save(referent(FIRST_REQUIREMENT).entity, 'absent');
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
		const saved = await requirements.save(referent(FIRST_REQUIREMENT).entity, 'absent');
		if (!saved.ok) throw new Error('fixture failed to save');

		const steps = requirementResolutionSteps(requirements, noRecalculation, repointNowhere);
		const result = await steps.markStalePersisted(saved.value);

		if (result.ok) throw new Error('expected markStale to refuse');
		expect(leftWritesBehind(result.error)).toBe(false);
	});
});
