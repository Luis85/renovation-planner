import { describe, expect, it } from 'vitest';
import { createRepositoryStack, type RepositoryStack } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import {
	makeAsset,
	makePlan,
	makeProject,
	makeRequirement,
	makeZone,
} from '../../../helpers/entities';
import { expectTargetedUpdatePreservesUserContent } from '../../../contracts/notePreservation';
import { Decimal } from 'decimal.js';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { createPlanId, type PlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';

/**
 * Slice 11 DoD item 8 — "a note with unknown extra frontmatter keys and a hand-authored
 * body survives a targeted property-update round trip unchanged in both" — driven for
 * EVERY note-backed write path the plugin has, not for one of them.
 *
 * The rule itself lives in `tests/contracts/notePreservation.ts`; this file is the list of
 * callers. It was a single Zone case in `consistency.test.ts` for seven slices, under a
 * title that read as a category: the guarantee is `writeOwnedFrontmatter`'s and
 * `observeFrontmatter`'s, both shared by five repositories and by `markStale`, so a Zone
 * sample said nothing about the four that go through `saveNoteBackedEntity` or about the
 * one write path that is not a save at all.
 */

async function seedProject(stack: RepositoryStack): Promise<ProjectId> {
	const projectId = createProjectId();
	expectOk(await stack.projects.save(makeProject({ id: projectId }), 'absent'));
	return projectId;
}

async function seedPlan(stack: RepositoryStack): Promise<{ projectId: ProjectId; planId: PlanId }> {
	const projectId = await seedProject(stack);
	const planId = createPlanId();
	expectOk(await stack.plans.save(makePlan({ id: planId, projectId }), 'absent'));
	return { projectId, planId };
}

describe('a targeted property update preserves the user’s own note content', () => {
	it('project.save', async () => {
		const stack = createRepositoryStack();
		const id = createProjectId();
		const written = expectOk(await stack.projects.save(makeProject({ id }), 'absent'));

		await expectTargetedUpdatePreservesUserContent({
			stack,
			id,
			write: () => stack.projects.save(makeProject({ id, name: 'Renamed project' }), written.version),
			expectOwned: { name: 'Renamed project' },
		});

		// Read back through the repository, not only off the bytes: a note carrying a key no
		// schema declares must still parse into its entity.
		expect(expectOk(await stack.projects.getById(id))?.entity.name).toBe('Renamed project');
	});

	it('plan.save', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seedPlan(stack);
		const read = expectOk(await stack.plans.getById(planId));

		await expectTargetedUpdatePreservesUserContent({
			stack,
			id: planId,
			write: () =>
				stack.plans.save(makePlan({ id: planId, projectId, name: 'Renamed plan' }), read.version),
			expectOwned: { name: 'Renamed plan' },
		});

		expect(expectOk(await stack.plans.getById(planId))?.entity.name).toBe('Renamed plan');
	});

	it('zone.save — the note half of a write that also touches the geometry sidecar', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seedPlan(stack);
		const id = createZoneId();
		const written = expectOk(await stack.zones.save(makeZone({ id, projectId, planId }), 'absent'));

		await expectTargetedUpdatePreservesUserContent({
			stack,
			id,
			write: () =>
				stack.zones.save(
					makeZone({ id, projectId, planId, name: 'Renamed zone', zoneType: 'Terrace' }),
					written.version,
				),
			// Two keys, because a Zone's write is the compensated one: a restore that put
			// back the pre-write bytes would leave both at their old values.
			expectOwned: { name: 'Renamed zone', 'zone-type': 'terrace' },
		});

		expect(expectOk(await stack.zones.getById(id))?.entity.zoneType).toBe('Terrace');
	});

	it('asset.save', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		const id = createAssetId();
		const written = expectOk(await stack.assets.save(makeAsset({ id, projectId }), 'absent'));

		await expectTargetedUpdatePreservesUserContent({
			stack,
			id,
			write: () =>
				stack.assets.save(makeAsset({ id, projectId, name: 'Renamed asset' }), written.version),
			expectOwned: { name: 'Renamed asset' },
		});

		expect(expectOk(await stack.assets.getById(id))?.entity.name).toBe('Renamed asset');
	});

	it('requirement.save', async () => {
		const stack = createRepositoryStack();
		const projectId = createProjectId();
		const origin = { kind: 'zone', zoneId: createZoneId() } as const;
		const assetId = createAssetId();
		const requirement = makeRequirement({ projectId, assetId, origin });
		const written = expectOk(await stack.requirements.save(requirement, 'absent'));

		await expectTargetedUpdatePreservesUserContent({
			stack,
			id: requirement.id,
			write: () =>
				stack.requirements.save(
					makeRequirement({
						id: requirement.id,
						projectId,
						assetId,
						origin,
						wasteFactor: new Decimal('0.25'),
					}),
					written.version,
				),
			// A Requirement has no name to rename, so the proof is the field this entity
			// actually owns — persisted as a decimal STRING (ADR-010).
			expectOwned: { 'waste-factor': '0.25' },
		});

		const reread = expectOk(await stack.requirements.getById(requirement.id));
		expect(reread?.entity.wasteFactor.toString()).toBe('0.25');
	});

	/**
	 * The write path no contract term over `save` can reach: `markStale` sets ONE field on
	 * a note it read itself, through a second `writeOwnedFrontmatter` call of its own. It
	 * also keeps the revision it read, so "the note changed" cannot be argued from the
	 * revision here — the stale marker itself is the evidence.
	 */
	it('requirement.markStale — a second writeOwnedFrontmatter call, and not an upsert', async () => {
		const stack = createRepositoryStack();
		const requirement = makeRequirement({
			projectId: createProjectId(),
			assetId: createAssetId(),
			origin: { kind: 'zone', zoneId: createZoneId() },
		});
		expectOk(await stack.requirements.save(requirement, 'absent'));

		await expectTargetedUpdatePreservesUserContent({
			stack,
			id: requirement.id,
			write: () => stack.requirements.markStale(requirement.id),
			expectOwned: { 'recalculation-status': 'stale' },
		});

		const reread = expectOk(await stack.requirements.getById(requirement.id));
		expect(reread?.entity.recalculationStatus).toBe('stale');
	});
});
