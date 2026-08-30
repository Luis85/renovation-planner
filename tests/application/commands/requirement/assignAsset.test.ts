import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { AssignAssetCommand } from '../../../../src/application/commands/requirement/AssignAsset';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryAssetRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryRequirementRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import type { ZoneRepository } from '../../../../src/application/ports/ZoneRepository';
import type { ZoneId } from '../../../../src/domain/zone/ZoneId';
import { expectErr, expectOk, RecordingEventBus } from '../../../helpers/domain';
import {
	makeAsset,
	makePlan,
	makeProject,
	makeZone,
} from '../../../helpers/entities';
import type { MeasurementUnit } from '../../../../src/core/units/MeasurementUnit';

/**
 * The end-to-end scenario's step 3, driven at the command layer — no Obsidian, Vue or
 * Konva loaded (§92 #1–3).
 */

/** A 4 m × 2.5 m rectangle in world millimeters: exactly 10 m², no rounding anywhere. */
const TEN_SQUARE_METERS = [
	{ x: 0, y: 0 },
	{ x: 4000, y: 0 },
	{ x: 4000, y: 2500 },
	{ x: 0, y: 2500 },
];

async function wired(projectName = 'Renovation') {
	const projects = new InMemoryProjectRepository();
	const plans = new InMemoryPlanRepository();
	const zones: ZoneRepository = new InMemoryZoneRepository();
	const assets = new InMemoryAssetRepository();
	const requirements = new InMemoryRequirementRepository();
	const events = new RecordingEventBus();
	const project = expectOk(await projects.save(makeProject({ name: projectName }), 'absent'));
	const plan = expectOk(
		await plans.save(makePlan({ projectId: project.entity.id }), 'absent'),
	);
	return {
		project,
		plan,
		projects,
		plans,
		zones,
		assets,
		requirements,
		events,
		locks: new ReferenceLocks(),
	};
}

async function seedBathroom(w: ReturnType<typeof wired>): Promise<ZoneId> {
	const zone = expectOk(
		await w.zones.save(
			expectOk(
				makeZone({
					projectId: w.project.entity.id,
					planId: w.plan.entity.id,
					name: 'Bathroom',
				}).withGeometry({ points: TEN_SQUARE_METERS }),
			),
			'absent',
		),
	);
	return zone.entity.id;
}

/** A second project, with its own plan and zone, in the SAME repositories. */
async function seedSecondProject(
	w: Awaited<ReturnType<typeof wired>>,
): Promise<{ projectId: ReturnType<typeof makeProject>['id']; zoneId: ZoneId }> {
	const project = expectOk(await w.projects.save(makeProject({ name: 'Loft' }), 'absent'));
	const plan = expectOk(
		await w.plans.save(makePlan({ projectId: project.entity.id }), 'absent'),
	);
	const zone = expectOk(
		await w.zones.save(
			expectOk(
				makeZone({
					projectId: project.entity.id,
					planId: plan.entity.id,
					name: 'Loft floor',
				}).withGeometry({ points: TEN_SQUARE_METERS }),
			),
			'absent',
		),
	);
	return { projectId: project.entity.id, zoneId: zone.entity.id };
}

function makeCommand(w: ReturnType<typeof wired>) {
	return new AssignAssetCommand(
		w.zones,
		w.assets,
		w.requirements,
		w.events,
		w.locks,
	);
}

function porcelainTile(overrides?: { unit?: MeasurementUnit }) {
	return makeAsset({ wasteFactorDefault: new Decimal('0.10'), ...overrides });
}

describe('AssignAssetCommand', () => {
	it('creates a requirement whose calculated figures are correct on first creation', async () => {
		const w = await wired();
		const zoneId = await seedBathroom(w);
		const asset = expectOk(await w.assets.save(porcelainTile(), 'absent'));

		const result = await makeCommand(w).execute({ zoneId, assetId: asset.entity.id });
		if (!result.ok) throw new Error(String(result.error));
		expect(result.value.created).toBe(true);
		// 10 m² × 1.10 waste = 11 m²; × 45.00 EUR = 495.00 EUR.
		expect(result.value.requirement.quantity.calculated.value.toFixed(2)).toBe('11.00');
		expect(result.value.requirement.estimatedCost.calculated.amount).toBe('495.00');
		expect(result.value.version.revision).toBe(1);
	});

	it('is idempotent on a repeated call for the same pair, reporting created:false', async () => {
		const w = await wired();
		const zoneId = await seedBathroom(w);
		const asset = expectOk(await w.assets.save(porcelainTile(), 'absent'));
		const command = makeCommand(w);

		const first = await command.execute({ zoneId, assetId: asset.entity.id });
		const second = await command.execute({ zoneId, assetId: asset.entity.id });
		if (!first.ok || !second.ok) throw new Error('unexpected failure');
		expect(first.value.created).toBe(true);
		expect(second.value.created).toBe(false);
		expect(second.value.requirement.id).toBe(first.value.requirement.id);
	});

	it.each(['m', 'm3', 'piece', 'hour', 'day', 'fixed'] as const)(
		'rejects a %s-unit asset and creates nothing',
		async (unit) => {
			const w = await wired();
			const zoneId = await seedBathroom(w);
			const asset = expectOk(
				await w.assets.save(porcelainTile({ unit }), 'absent'),
			);
			const error = expectErr(await makeCommand(w).execute({ zoneId, assetId: asset.entity.id }));
			expect(error.code).toBe('requirement.unit-not-area');
			expect(expectOk(await w.requirements.listByZone(zoneId))).toEqual([]);
		},
	);

	/**
	 * Slice 19: the catalogue left the project, so one Asset serves every project in the
	 * vault. This is the INVERSE of the deleted `requirement.cross-project` refusal — a
	 * deleted refusal leaves no test behind, and nothing would notice the guard being
	 * reintroduced, so the positive is what is asserted here.
	 */
	it('assigns one asset into zones from two different projects', async () => {
		const w = await wired();
		const kitchenZoneId = await seedBathroom(w);
		const loft = await seedSecondProject(w);
		const tiles = expectOk(await w.assets.save(porcelainTile(), 'absent'));
		const command = makeCommand(w);

		const first = await command.execute({ zoneId: kitchenZoneId, assetId: tiles.entity.id });
		const second = await command.execute({ zoneId: loft.zoneId, assetId: tiles.entity.id });

		// `expectOk` rather than a boolean, so a reintroduced refusal fails naming its own
		// code rather than reporting `false`.
		const kitchenRequirement = expectOk(first).requirement;
		const loftRequirement = expectOk(second).requirement;
		// Each Requirement carries its OWN zone's project, which is what "work stays
		// project-scoped while catalogues do not" means at the row level.
		expect(kitchenRequirement.projectId).toBe(w.project.entity.id);
		expect(loftRequirement.projectId).toBe(loft.projectId);
	});
});
