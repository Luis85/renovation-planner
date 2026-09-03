import { describe, expect, it } from 'vitest';
import { DeleteRequirementCommand } from '../../../../src/application/commands/requirement/DeleteRequirement';
import { isErr } from '../../../../src/core/result/Result';
import type { DomainEvent } from '../../../../src/core/events/EventBus';
import type { RequirementId } from '../../../../src/domain/requirement/RequirementId';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';
import { expectOk } from '../../../helpers/domain';
import { requirementFixture } from '../../../helpers/slice10';
import { makeRequirement } from '../../../helpers/entities';

/**
 * `DeleteRequirementCommand` is the one plain removal `remove-references` resolves
 * through — not an unused door. Task 1 minted `RequirementDeleted`; this pins that the
 * command actually raises it, and only after a real write. The write-refusal half of
 * that "only after" claim is pinned in `recalculateAndDerivation.test.ts` instead, whose
 * "propagates a refused delete" case already overrides `delete` to fail — this file's own
 * refusal case below drives a refused LOAD, which never reaches the write at all.
 */
describe('DeleteRequirementCommand', () => {
	it('announces the removal so a project-scoped subscriber can refresh', async () => {
		const w = await requirementFixture();
		const requirement = expectOk(
			await w.requirements.save(
				makeRequirement({
					projectId: w.project.entity.id,
					assetId: createAssetId(),
					origin: { kind: 'zone', zoneId: createZoneId() },
				}),
				'absent',
			),
		);
		w.events.clear();
		const seen: DomainEvent[] = [];
		w.events.subscribe('RequirementDeleted', (event) => {
			seen.push(event);
		});

		const result = await new DeleteRequirementCommand(w.requirements, w.events).execute({
			requirementId: requirement.entity.id,
		});

		expectOk(result);
		expect(seen).toEqual([
			{
				type: 'RequirementDeleted',
				payload: { requirementId: requirement.entity.id, projectId: requirement.entity.projectId },
			},
		]);
	});

	// This drives a refused LOAD (loadRequirement never finds the entity, so `delete` is
	// never reached) — a real path, worth keeping on its own. It does NOT reach the write,
	// so it cannot tell correct code from a build that publishes right after the load
	// succeeds and before checking whether the delete itself refused. That case lives in
	// recalculateAndDerivation.test.ts's "propagates a refused delete", which already
	// overrides `delete` to fail and now asserts nothing was published either.
	it('announces nothing when the requirement cannot be found', async () => {
		const w = await requirementFixture();
		const seen: DomainEvent[] = [];
		w.events.subscribe('RequirementDeleted', (event) => {
			seen.push(event);
		});

		const result = await new DeleteRequirementCommand(w.requirements, w.events).execute({
			requirementId: 'requirement-does-not-exist' as RequirementId,
		});

		expect(isErr(result)).toBe(true);
		expect(seen).toEqual([]);
	});
});
