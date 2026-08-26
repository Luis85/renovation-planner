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

function makeCommand(w: ReturnType<typeof wired>) {
	return new AssignAssetCommand(
		w.zones,
		w.assets,
		w.requirements,
		w.events,
		w.locks,
	);
}

function porcelainTile(projectId: ReturnType<typeof makeProject>['id'], overrides?: { unit?: MeasurementUnit }) {
	return makeAsset({ projectId, wasteFactorDefault: new Decimal('0.10'), ...overrides });
}

describe('AssignAssetCommand', () => {
	it('creates a requirement whose calculated figures are correct on first creation', async () => {
		const w = await wired();
		const zoneId = await seedBathroom(w);
		const asset = expectOk(await w.assets.save(porcelainTile(w.project.entity.id), 'absent'));

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
		const asset = expectOk(await w.assets.save(porcelainTile(w.project.entity.id), 'absent'));
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
				await w.assets.save(porcelainTile(w.project.entity.id, { unit }), 'absent'),
			);
			const error = expectErr(await makeCommand(w).execute({ zoneId, assetId: asset.entity.id }));
			expect(error.code).toBe('requirement.unit-not-area');
			expect(expectOk(await w.requirements.listByZone(zoneId))).toEqual([]);
		},
	);

	it('rejects a cross-project pairing driven through the command itself, not any picker', async () => {
		const w = await wired();
		const zoneId = await seedBathroom(w);
		// A second project, its asset in the SAME asset repository — the picker filters
		// by project, and this input is exactly what only a non-picker caller can produce.
		const second = expectOk(
			await new InMemoryProjectRepository().save(makeProject({ name: 'Other' }), 'absent'),
		);
		const foreignAsset = expectOk(
			await w.assets.save(porcelainTile(second.entity.id), 'absent'),
		);
		const error = expectErr(
			await makeCommand(w).execute({ zoneId, assetId: foreignAsset.entity.id }),
		);
		expect(error.code).toBe('requirement.cross-project');
	});
});
