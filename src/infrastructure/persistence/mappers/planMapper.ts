import type { CalculationError, ValidationError } from '../../../core/errors/AppError';
import type { Result } from '../../../core/result/Result';
import { Plan } from '../../../domain/plan/Plan';
import { PlanFrontmatterSchemaV1, PLAN_TYPE, type PlanFrontmatterDTO } from '../dto/planFrontmatter';
import type { PlanGeometryDTO } from '../dto/planGeometry';
import { parsePersisted } from './parse';

/**
 * The Plan mapper: frontmatter DTO ↔ domain entity, never partial (SDD §37). The
 * revision is an argument on the way down — persistence bookkeeping, not domain state
 * (see projectMapper).
 *
 * `background` lowers into three flat frontmatter keys; a page number is meaningful only
 * for a pdf background and persists as null otherwise. Calibration is NOT frontmatter:
 * it travels in the plan's sidecar, and the repository hands the parsed value in here.
 */
export function planToPersistence(plan: Plan, revision: number): Record<string, unknown> {
	const background = plan.background;
	return {
		type: PLAN_TYPE,
		'schema-version': 1,
		id: plan.id,
		revision,
		project: plan.projectId,
		name: plan.name,
		'background-path': background?.path ?? '',
		'background-kind': background?.kind ?? 'image',
		'background-page': background?.kind === 'pdf' ? (background.page ?? 1) : null,
		layers: [...plan.layers],
	};
}

function fromDto(
	dto: PlanFrontmatterDTO,
	calibration: Plan['calibration'],
): Result<Plan, ValidationError | CalculationError> {
	const path = dto['background-path'];
	const constructed = Plan.create({
		id: dto.id as Plan['id'],
		projectId: dto.project as Plan['projectId'],
		name: dto.name,
		background: path
			? {
					path,
					kind: dto['background-kind'],
					page: dto['background-kind'] === 'pdf' ? (dto['background-page'] ?? 1) : undefined,
				}
			: null,
		layers: dto.layers,
	});
	if (!constructed.ok) {
		return constructed;
	}
	if (calibration === null || calibration === undefined) {
		return constructed;
	}
	// Annotated rather than chained off `.value`: fallow resolves a class member through an
	// explicit type annotation, and this is the ONE caller of `withCalibration` now that the
	// entity no longer derives its own calibration — a property access here reads as dead.
	const plan: Plan = constructed.value;
	return plan.withCalibration(calibration);
}

export function planFromPersistence(
	raw: unknown,
	calibration: Plan['calibration'],
): Result<Plan, ValidationError | CalculationError> {
	const parsed = parsePersisted(PlanFrontmatterSchemaV1, raw, 'plan.frontmatter-invalid', 'Plan note');
	if (!parsed.ok) return parsed;
	return fromDto(parsed.value, calibration);
}

/**
 * Calibration's sidecar DTO ↔ domain value. The shapes are field-for-field identical by
 * design (ADR-002: the sidecar stores what the entity holds), which is exactly why the
 * conversion is written down rather than spread by hand: `planFromPersistence` reads it
 * beside this function, and `ObsidianPlanGeometrySidecar` — the one WRITER of the field —
 * lowers it back.
 */
export function calibrationToPersistence(
	calibration: NonNullable<Plan['calibration']>,
): PlanGeometryDTO['calibration'] {
	return {
		pointA: { x: calibration.pointA.x, y: calibration.pointA.y },
		pointB: { x: calibration.pointB.x, y: calibration.pointB.y },
		knownDistance: calibration.knownDistance,
		pixelsPerWorldUnit: calibration.pixelsPerWorldUnit,
	};
}

export function calibrationFromPersistence(
	dto: NonNullable<PlanGeometryDTO['calibration']>,
): NonNullable<Plan['calibration']> {
	return {
		pointA: { x: dto.pointA.x, y: dto.pointA.y },
		pointB: { x: dto.pointB.x, y: dto.pointB.y },
		knownDistance: dto.knownDistance,
		pixelsPerWorldUnit: dto.pixelsPerWorldUnit,
	};
}
