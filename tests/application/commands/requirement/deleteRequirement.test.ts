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
 * command actually raises it, and only after a real write.
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

	// The pair, not the count: "an event was raised" is equally true of a build that raises it
	// before the write and then fails to delete.
	it('announces nothing when the delete refuses', async () => {
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
