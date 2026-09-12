import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { EMPTY_DEPTH } from '../../../domain/renovation/PlanningDepth';
import type { CalculationError, ValidationError } from '../../../core/errors/AppError';
import { err, type Result } from '../../../core/result/Result';
import { planError } from '../../../domain/plan/Plan.errors';
import { Plan } from '../../../domain/plan/Plan';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { PlanFrontmatterSchema, PLAN_TYPE, type PlanFrontmatterDTO } from '../dto/planFrontmatter';
import type { PlanGeometryDTO } from '../dto/planGeometry';
import { parsePersisted } from './parse';
/** The lowest version that still makes an older writer refuse the note rather than strip a fact it carries. */
function planSchemaVersion(plan: Plan): number {
	if (plan.north !== undefined) return 10;
	return plan.parent ? 9 : renovationSchemaVersion(plan);
}

function renovationSchemaVersion(plan: Plan): number {
	const { work, depth = EMPTY_DEPTH } = plan.renovation ?? EMPTY_RENOVATION;
	if (depth.evidence.some(item => item.date !== undefined)) return 8;
	if (work.some(item => item.responsibility === 'trade' || item.schedule !== undefined)) return 7;
	if (plan.spatialElements?.length) return 6;
	const shared = [...work, ...depth.evidence].some(item => (item.links?.length ?? 0) > 0);
	return shared ? 5 : plan.renovation?.depth ? 4 : plan.renovation ? 3 : plan.background?.appearance ? 2 : 1;
}

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
		'schema-version': planSchemaVersion(plan),
		...(plan.spatialElements?.length ? { 'spatial-elements': plan.spatialElements } : {}),
		...(plan.renovation ? { renovation: plan.renovation } : {}),
		id: plan.id,
		revision,
		project: plan.projectId,
		name: plan.name,
		'background-path': background?.path ?? '',
		'background-kind': background?.kind ?? 'image',
		'background-page': background?.kind === 'pdf' ? (background.page ?? 1) : null,
		layers: [...plan.layers],
		...(background?.appearance ? { 'reference-appearance': background.appearance } : {}),
		...(plan.parent ? { 'parent-plan': plan.parent.planId, 'parent-zone': plan.parent.zoneId } : {}),
		...(plan.north !== undefined ? { north: plan.north } : {}),
	};
}

function fromDto(
	dto: Omit<PlanFrontmatterDTO, 'schema-version'>,
	calibration: Plan['calibration'],
): Result<Plan, ValidationError | CalculationError> {
	const path = dto['background-path'];
	const parentPlan = dto['parent-plan'], parentZone = dto['parent-zone'];
	if ((parentPlan === undefined) !== (parentZone === undefined)) {
		// `planError` prefixes `plan.`, so this is the same `plan.frontmatter-invalid` a schema refusal carries.
		return err(planError('frontmatter-invalid', 'parent-plan and parent-zone must be set together.'));
	}
	// A hand-edited note naming ITSELF as its own parent reads as parentless rather than
	// refusing the whole note — `Plan.create`'s `plan.parent-is-self` guard stays for the
	// CREATION path, where a self-link can only be a bug in the caller; here it is user data,
	// and a two-plan cycle already opens fine (`ancestryOf` stops the walk). Retired on this
	// plan's next save: `planToPersistence` never re-derives `parent-plan` from `dto.id`, so
	// the write that follows a read persists `parent: null` and the stale keys are gone.
	const selfParent = parentPlan !== undefined && parentPlan === dto.id;
	const constructed = Plan.create({
		spatialElements: dto['spatial-elements'],
		renovation: dto.renovation,
		id: dto.id as Plan['id'],
		projectId: dto.project as Plan['projectId'],
		name: dto.name,
		background: path
			? {
					path,
					...(dto['reference-appearance'] ? { appearance: dto['reference-appearance'] } : {}),
					kind: dto['background-kind'],
					page: dto['background-kind'] === 'pdf' ? (dto['background-page'] ?? 1) : undefined,
				}
			: null,
		layers: dto.layers,
		north: dto.north,
		parent: parentPlan !== undefined && parentZone !== undefined && !selfParent ? { planId: parentPlan as Plan['id'], zoneId: parentZone as ZoneId } : null,
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
	const parsed = parsePersisted(PlanFrontmatterSchema, raw, 'plan.frontmatter-invalid', 'Plan note');
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
