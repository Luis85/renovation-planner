import type { Result } from '../../../../src/core/result/Result';
import { expectOk } from '../../../helpers/domain';
import { makeZone } from '../../../helpers/entities';
import { assignedRequirementFixture, requirementFixture, TEN_SQUARE_METERS } from '../../../helpers/slice10';

/**
 * The seams the requirement-command refusal suites inject through, shared by
 * `requirementRefusals.test.ts` and `recalculateAndDerivation.test.ts` so a fixture
 * change lands once.
 */

/** A port double that keeps the inner's behaviour and overrides the patched members. */
export function overridePort<T extends object>(inner: T, patch: Record<string, unknown>): T {
	return Object.assign(Object.create(Object.getPrototypeOf(inner)), inner, patch) as T;
}

/**
 * What `withConflictingReads` actually needs, which is narrower than any repository port and
 * wider than any one implementation: a `poke` that advances the observed token, declared by
 * the three in-memory repositories and by no port at all.
 *
 * The parameter said `RequirementRepository` until `tests/**` was type-checked — a signature
 * promising this worked over any implementation of that port when it only ever worked over
 * the one with that method. Narrowing it to `InMemoryRequirementRepository` was the obvious
 * next answer and was wrong in the other direction: `requirementRefusals.test.ts` wraps the
 * ASSET repository with it. Generic over the repository, constrained on the two members it
 * touches, is the shape that is true of both call sites and of the third.
 */
export interface Pokeable<TId> {
	getById(id: TId): Promise<Result<unknown, unknown>>;
	poke(id: TId): void;
}

/**
 * A repository whose reads advance the observed token behind the caller's back -- the
 * stand-in for "another tab wrote between your read and your write", which turns the
 * NEXT conditional save into an external-modification conflict.
 */
export function withConflictingReads<TId, T extends Pokeable<TId>>(inner: T): T {
	return overridePort(inner, {
		getById: async (id: TId) => {
			const result = await inner.getById(id);

			if (result.ok && result.value !== null) inner.poke(id);
			return result;
		},
	});
}

/**
 * The refusal suites' own name for `assignedRequirementFixture` — a 10 m² zone, an asset with
 * a 10% waste factor, and the Requirement the assign produced. It WAS a byte-for-byte second
 * copy of that helper until fallow reported the pair; what is left is the alias, because both
 * suites read as `wiredWithLink()` and renaming their call sites buys nothing.
 */
export const wiredWithLink = assignedRequirementFixture;

/** One saved 10 square-meter zone in the fixture's plan -- shared by the arms below. */
export async function wiredZoneFor(w: Awaited<ReturnType<typeof requirementFixture>>) {
	const geometry = expectOk(
		makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
			points: TEN_SQUARE_METERS,
		}),
	);
	const zoneEntity = expectOk(await w.zones.save(geometry, 'absent'));
	return { zoneId: zoneEntity.entity.id };
}
