import { Decimal } from 'decimal.js';
import type { ValidationError } from '../../../core/errors/AppError';
import type { Money } from '../../../core/money/Money';
import { of as moneyOf } from '../../../core/money/Money';
import { err, ok, type Result } from '../../../core/result/Result';
import type { DerivedValue } from '../../../core/derived/DerivedValue';
import type { Quantity } from '../../../core/units/MeasurementUnit';
import { toKebab } from '../dto/kebab';
import {
	Requirement,
	type CalculatedFrom,
	type RecalculationStatus,
} from '../../../domain/requirement/Requirement';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { RequirementOrigin } from '../../../domain/requirement/RequirementOrigin';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import { parsePersisted } from './parse';
import {
	REQUIREMENT_TYPE,
	RequirementFrontmatterSchemaV1,
} from '../dto/requirementFrontmatter';

function derivedQuantity(dto: {
	unit: Quantity['unit'];
	'quantity-calculated': string;
	'quantity-override': string | null;
}): DerivedValue<Quantity> {
	const calculated: Quantity = { value: new Decimal(dto['quantity-calculated']), unit: dto.unit };
	return dto['quantity-override'] === null
		? { calculated }
		: { calculated, override: { value: new Decimal(dto['quantity-override']), unit: dto.unit } };
}

function derivedMoney(dto: {
	'cost-calculated': string;
	'cost-override': string | null;
	currency: string;
}): DerivedValue<Money> {
	const calculated = moneyOf(dto['cost-calculated'], dto.currency);
	return dto['cost-override'] === null
		? { calculated }
		: { calculated, override: moneyOf(dto['cost-override'], dto.currency) };
}

/** The override side of a DerivedValue as persistence sees it: a decimal string or null. */
function decimalOrNull(value: unknown): string | null {
	return value instanceof Decimal ? value.toString() : null;
}

function moneyOrNull(value: unknown): string | null {
	return value && typeof value === 'object' && 'amount' in (value as Money)
		? (value as Money).amount
		: null;
}

/**
 * Markdown ↔ Requirement. Every `*-calculated` / `*-override` / `calculated-from-*`
 * decimal is a quoted STRING on disk (ADR-010); the mapper is the only place the
 * conversion happens. The persisted figures are deliberately cached (not recomputed on
 * load) — §3.6's named exception, so a plain-Markdown reader still sees last-known values.
 */
export function requirementToPersistence(
	requirement: Requirement,
	revision: number,
): Record<string, unknown> {
	const currency = requirement.calculatedFrom.unitCost.currency;
	return {
		type: REQUIREMENT_TYPE,
		'schema-version': 1,
		id: requirement.id,
		revision,
		project: requirement.projectId,
		asset: requirement.assetId,
		'origin-kind': toKebab(requirement.origin.kind),
		'origin-zone':
			requirement.origin.kind === 'zone' ? String(requirement.origin.zoneId) : null,

		unit: requirement.unit,
		'waste-factor': requirement.wasteFactor.toString(),

		'quantity-calculated': requirement.quantity.calculated.value.toString(),
		// The override is a Quantity; ITS value is the decimal the read side rebuilds
		// `derivedQuantity` from. Passing the wrapper here answered null for every
		// overridden requirement and silently reset it to the calculated figure on save.
		'quantity-override': decimalOrNull(requirement.quantity.override?.value),

		'cost-calculated': requirement.estimatedCost.calculated.amount,
		'cost-override': moneyOrNull(requirement.estimatedCost.override),
		currency,

		// The measured zone area, in the SAME unit and rounding the pipeline produced —
		// comparison happens on persisted values, never raw geometry against a record.
		'calculated-from-area': requirement.calculatedFrom.zoneArea.value.toString(),
		'calculated-from-unit-cost': requirement.calculatedFrom.unitCost.amount,
		'calculated-from-asset-unit': requirement.calculatedFrom.assetUnit,

		'recalculation-status': requirement.recalculationStatus satisfies RecalculationStatus,
		'required-date': requirement.requiredDate,
	};
}

export function requirementFromPersistence(rawFrontmatter: unknown): Result<Requirement, ValidationError> {
	const frontmatter = parsePersisted(
		RequirementFrontmatterSchemaV1,
		rawFrontmatter,
		'requirement.frontmatter-invalid',
		'Requirement note',
	);
	if (!frontmatter.ok) return frontmatter;
	const dto = frontmatter.value;

	if (dto['origin-kind'] !== 'zone') {
		return err({
			category: 'Validation',
			code: 'requirement.frontmatter-invalid',
			message: `"${String(dto['origin-kind'])}" is not an origin kind this version reads.`,
		});
	}

	const created = Requirement.create({
		id: dto.id as Requirement['id'],
		projectId: dto.project as ProjectId,
		assetId: dto.asset as AssetId,
		origin: { kind: 'zone', zoneId: dto['origin-zone'] as ZoneId } satisfies RequirementOrigin,
		unit: dto.unit,
		wasteFactor: new Decimal(dto['waste-factor']),
		quantity: derivedQuantity(dto),
		estimatedCost: derivedMoney(dto),
		calculatedFrom: {
			zoneArea: { value: new Decimal(dto['calculated-from-area']), unit: dto.unit },
			unitCost: moneyOf(dto['calculated-from-unit-cost'], dto.currency),
			assetUnit: dto['calculated-from-asset-unit'],
		} satisfies CalculatedFrom,
		recalculationStatus: dto['recalculation-status'],
		requiredDate: dto['required-date'] ?? null,
	});
	if (!created.ok) return created;
	return ok(created.value);
}
