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
import { currencyOf, of as moneyOf } from '../../src/core/money/Money';
import type { Quantity } from '../../src/core/units/MeasurementUnit';
import type { ObservationToken } from '../../src/application/ports/versioning';
import type { CatalogueEntryDto, UnreadableEntry } from '../../src/application/queries/ListCatalogueEntries';

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
	return expectOk(
		Project.create({
			id: id ?? createProjectId(),
			name: 'Kitchen renovation',
			currency: currencyOf('EUR'),
			...rest,
		}),
	);
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

/**
 * `unit: m2`, 45.00 EUR, 10% waste — the "Porcelain Tile" of the end-to-end scenario.
 * No project: since design slice 19 the catalogue is a vault-level library, so a call
 * naming one would be naming a field the entity does not have.
 */
export function makeAsset(props: Partial<CreateAssetProps> & { id?: AssetId } = {}): Asset {
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

/**
 * The Asset library's two read-model fixtures, here rather than in
 * `assetLibraryRootHarness.ts` because that harness MOUNTS `AssetLibraryRoot.vue` and a
 * node-environment test wanting only a DTO must not reach an SFC through it —
 * `scripts/vitest-no-ssr-sfc.mjs` refuses the SSR transform that reach produces, and
 * `tests/build/no-ssr-sfc.test.ts` says why. The harness re-exports both.
 */
export function anEntry(overrides: Partial<CatalogueEntryDto> = {}): CatalogueEntryDto {
	return {
		version: { revision: 1, observed: 'fixture' as ObservationToken },
		assetId: createAssetId(),
		name: 'Oak plank floor',
		category: 'material',
		unit: 'm2',
		unitCostAmount: '34.95',
		currency: currencyOf('EUR'),
		wasteFactorDefault: '0.08',
		supplier: 'Holzhandel Nord',
		sku: 'EIC-1200-190',
		height: null,
		notes: null,
		background: null,
		...overrides,
	};
}

export function aNoIdNote(overrides: Partial<UnreadableEntry> = {}): UnreadableEntry {
	return {
		assetId: null,
		path: 'Renovation/Library/mystery.md',
		reason: 'no-id',
		code: null,
		...overrides,
	};
}
