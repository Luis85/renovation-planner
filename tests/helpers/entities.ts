import { createPolygon, type Polygon } from '../../src/core/geometry/Polygon';
import { expectOk } from './domain';
import { Decimal } from 'decimal.js';
import { Project, type CreateProjectProps } from '../../src/domain/project/Project';
import { createProjectId, type ProjectId } from '../../src/domain/project/ProjectId';
import { Plan, type CreatePlanProps } from '../../src/domain/plan/Plan';
import { createPlanId, type PlanId } from '../../src/domain/plan/PlanId';
import { Zone, type CreateZoneProps } from '../../src/domain/zone/Zone';
import { createZoneId, type ZoneId } from '../../src/domain/zone/ZoneId';
import { Asset, type CreateAssetProps } from '../../src/domain/asset/Asset';
import { createAssetId, type AssetId } from '../../src/domain/asset/AssetId';
import {
	Requirement,
	type CalculatedFrom,
	type CreateRequirementProps,
} from '../../src/domain/requirement/Requirement';
import {
	createRequirementId,
	type RequirementId,
} from '../../src/domain/requirement/RequirementId';
import { of as moneyOf } from '../../src/core/money/Money';
import type { Quantity } from '../../src/core/units/MeasurementUnit';

/**
 * Entity fixtures for the command and contract tests. Each call mints fresh IDs, so
 * contract suites can seed several entities without colliding.
 */

export function squareAt(x = 0, y = 0): Polygon {
	return expectOk(
		createPolygon([
			{ x, y },
			{ x: x + 10, y },
			{ x: x + 10, y: y + 10 },
			{ x, y: y + 10 },
		]),
	);
}

export function makeProject(props?: Partial<CreateProjectProps> & { id?: ProjectId }): Project {
	const { id, ...rest } = props ?? {};
	return expectOk(Project.create({ id: id ?? createProjectId(), name: 'Kitchen renovation', ...rest }));
}

export function makePlan(
	props: Partial<CreatePlanProps> & { projectId: ProjectId; id?: PlanId },
): Plan {
	const { id, ...rest } = props;
	return expectOk(
		Plan.create({ id: id ?? createPlanId(), name: 'Ground floor', ...rest }),
	);
}

export function makeZone(
	props: Partial<CreateZoneProps> & { projectId: ProjectId; planId: PlanId; id?: ZoneId },
): Zone {
	const { id, ...rest } = props;
	return expectOk(
		Zone.create({ id: id ?? createZoneId(), name: 'Living room', zoneType: 'Room', geometry: squareAt(), ...rest }),
	);
}

/** `unit: m2`, 45.00 EUR, 10% waste — the "Porcelain Tile" of the end-to-end scenario. */
export function makeAsset(
	props: Partial<CreateAssetProps> & { projectId: ProjectId; id?: AssetId },
): Asset {
	const { id, ...rest } = props;
	return expectOk(
		Asset.create({
			id: id ?? createAssetId(),
			name: 'Porcelain Terrace Tile',
			category: 'material',
			unit: 'm2',
			unitCost: moneyOf('45.00', 'EUR'),
			wasteFactorDefault: new Decimal('0.10'),
			...rest,
		}),
	);
}

/**
 * A Requirement whose figures say what its inputs say: `zoneArea` in m², priced per m².
 * Callers pass a consistent `calculatedFrom` (or accept the default one built from
 * `zoneAreaM2` and `unitCost`), so read-model staleness comparisons behave honestly.
 */
export function makeRequirement(
	props: Partial<CreateRequirementProps> & {
		projectId: ProjectId;
		assetId: AssetId;
		origin: CreateRequirementProps['origin'];
		id?: RequirementId;
	},
): Requirement {
	const { id, zoneAreaM2 = new Decimal(10), unitCostAmount = '45.00', ...rest } = props as Partial<CreateRequirementProps> & {
		projectId: ProjectId;
		assetId: AssetId;
		origin: CreateRequirementProps['origin'];
		id?: RequirementId;
		zoneAreaM2?: Decimal;
		unitCostAmount?: string;
	};
	const quantity: Quantity = { value: zoneAreaM2, unit: 'm2' };
	const calculatedFrom: CalculatedFrom = rest.calculatedFrom ?? {
		zoneArea: quantity,
		unitCost: moneyOf(unitCostAmount, 'EUR'),
		assetUnit: 'm2',
	};
	return expectOk(
		Requirement.create({
			id: id ?? createRequirementId(),
			unit: 'm2',
			wasteFactor: new Decimal('0.10'),
			quantity: { calculated: quantity },
			estimatedCost: { calculated: moneyOf(zoneAreaM2.mul(unitCostAmount).toFixed(2), 'EUR') },
			calculatedFrom,
			...rest,
		}),
	);
}
