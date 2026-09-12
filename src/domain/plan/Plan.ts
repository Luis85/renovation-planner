import { validReferenceAppearance } from './ReferenceAppearance';
import { validateRenovation, type Renovation } from '../renovation/Renovation';
import { err, ok, type Result } from '../../core/result/Result';
import type { CalculationError, ValidationError } from '../../core/errors/AppError';
import type { ProjectId } from '../project/ProjectId';
import { validateCalibration, type Calibration } from './Calibration';
import { PLAN_BACKGROUND_KINDS, type PlanBackgroundRef } from './PlanBackgroundRef';
import { planError } from './Plan.errors';
import type { PlanId } from './PlanId';
import { DEFAULT_PLAN_KIND, isPlanKind, type PlanKind } from './PlanKind';
import type { SpatialElementMetadata } from '../spatial/SpatialElement';
import type { ZoneId } from '../zone/ZoneId';

/** The zone of another plan this plan details (ADR-0028). Set once at creation and never moved. */
export interface PlanParent {
	readonly planId: PlanId;
	readonly zoneId: ZoneId;
}

/** The two label fields `UpdatePlanDetailsCommand` writes (ADR-0029). */
export interface PlanDetails {
	readonly kind?: PlanKind;
	readonly order?: number;
}

/**
 * The label fields with `base` filling what `details` leaves out, validated. Owns the
 * defaulting too, because `create` sits one branch under its complexity cap.
 */
function resolveDetails(details: PlanDetails, base: Required<PlanDetails>): Result<Required<PlanDetails>, ValidationError> {
	const kind = details.kind ?? base.kind, order = details.order ?? base.order;
	if (!isPlanKind(kind)) {
		return err(planError('unknown-kind', `"${String(kind)}" is not a plan kind.`));
	}
	if (!Number.isInteger(order) || order < 0) {
		return err(planError('invalid-order', `A plan order must be a non-negative integer; got ${order}.`));
	}
	return ok({ kind, order });
}

/**
 * The ONE answer to "is this a usable background reference", shared by `create` and
 * `withBackground` so a Plan cannot be constructed with a reference that setting the
 * same reference later would refuse.
 *
 * What it deliberately does NOT reject: a page number on an `image`. The type says a page
 * is meaningful only for a pdf, and the mapper never writes one for an image — but a
 * hand-edited note carrying a stray `background-page` is a file a user still has to be
 * able to open, and refusing it here would turn a harmless extra key into an unloadable
 * Plan. Ignoring it is the tolerant half of "strict on the way out, tolerant on the way
 * in"; the mapper drops it on the next write.
 */
function validateBackground(background: PlanBackgroundRef | null): Result<void, ValidationError> {
	if (background === null) {
		return ok(undefined);
	}
	if (background.appearance !== undefined && !validReferenceAppearance(background.appearance)) {
		return err(planError('invalid-reference-appearance', 'Reference crop, rotation or appearance is invalid.'));
	}
	if (!background.path.trim()) {
		return err(planError('empty-background-path', 'A background reference needs a path.'));
	}
	if (!PLAN_BACKGROUND_KINDS.includes(background.kind)) {
		return err(
			planError('unknown-background-kind', `"${String(background.kind)}" is not a background kind.`),
		);
	}
	if (background.page !== undefined && (!Number.isInteger(background.page) || background.page < 1)) {
		return err(
			planError('invalid-background-page', `A background page must be a positive integer; got ${background.page}.`),
		);
	}
	return ok(undefined);
}

/** A bearing is whole degrees clockwise from the plan's up; absent means nobody has set one. */
function validNorth(north: number | undefined): boolean {
	return north === undefined || (Number.isInteger(north) && north >= 0 && north < 360);
}

/**
 * The bearing and the parent link, checked together for one reason only: `create` sat AT its
 * complexity cap before north arrived, and each check taken out of it is a branch it gets back.
 */
function validateNorthAndParent(props: CreatePlanProps): Result<void, ValidationError> {
	if (!validNorth(props.north)) {
		return err(planError('invalid-north', 'North must be a whole number of degrees from 0 to 359.'));
	}
	if (props.parent && props.parent.planId === props.id) {
		return err(planError('parent-is-self', 'A plan cannot detail a zone of itself.'));
	}
	return ok(undefined);
}

export interface CreatePlanProps {
	readonly spatialElements?: readonly SpatialElementMetadata[];
	readonly renovation?: Renovation;
	readonly id: PlanId;
	readonly projectId: ProjectId;
	readonly name: string;
	readonly background?: PlanBackgroundRef | null;
	readonly layers?: readonly string[];
	readonly parent?: PlanParent | null;
	readonly kind?: PlanKind;
	readonly order?: number;
	/** Whole degrees clockwise from the plan's up, 0–359; absent while nobody has set one. */
	readonly north?: number;
}

interface PlanFields {
	readonly north?: number;
	readonly spatialElements?: readonly SpatialElementMetadata[];
	readonly renovation?: Renovation;
	readonly id: PlanId;
	readonly projectId: ProjectId;
	readonly name: string;
	readonly background: PlanBackgroundRef | null;
	readonly calibration: Calibration | null;
	readonly layers: readonly string[];
	readonly parent: PlanParent | null;
	readonly kind: PlanKind;
	readonly order: number;
}

/**
 * A floor plan belonging to exactly one Project (PRD §59). Immutable; `projectId` is set
 * once at creation and no command moves a Plan between Projects. Calibration starts
 * `null` and is read out of the geometry sidecar — `ReversibleCalibratePlanCommand`
 * writes it there, never through this entity.
 */
export class Plan {
	readonly spatialElements?: readonly SpatialElementMetadata[];
	readonly renovation?: Renovation;
	readonly id: PlanId;
	readonly projectId: ProjectId;
	readonly name: string;
	readonly background: PlanBackgroundRef | null;
	readonly calibration: Calibration | null;
	readonly layers: readonly string[];
	readonly parent: PlanParent | null;
	readonly kind: PlanKind;
	readonly order: number;
	readonly north?: number;

	private constructor(fields: PlanFields) {
		this.north = fields.north;
		this.spatialElements = fields.spatialElements;
		this.renovation = fields.renovation;
		this.id = fields.id;
		this.projectId = fields.projectId;
		this.name = fields.name;
		this.background = fields.background;
		this.calibration = fields.calibration;
		this.layers = fields.layers;
		this.parent = fields.parent;
		this.kind = fields.kind;
		this.order = fields.order;
	}

	static create(props: CreatePlanProps): Result<Plan, ValidationError> {
		if (props.spatialElements && (new Set(props.spatialElements.map(item => item.id)).size !== props.spatialElements.length || props.spatialElements.some(item => !item.id.startsWith('element-') || !item.name.trim()))) {
			return err(planError('invalid-spatial-elements', 'Spatial element labels need unique identities and non-empty names.'));
		}
		if (props.renovation) {
			const valid = validateRenovation(props.renovation);
			if (!valid.ok) return valid;
		}
		const linked = validateNorthAndParent(props);
		if (!linked.ok) {
			return linked;
		}
		const details = resolveDetails(props, { kind: DEFAULT_PLAN_KIND, order: 0 });
		if (!details.ok) {
			return details;
		}
		const name = props.name.trim();
		if (!name) {
			return err(planError('empty-name', 'A plan needs a non-empty name.'));
		}
		const background = props.background ?? null;
		const checkedBackground = validateBackground(background);
		if (!checkedBackground.ok) {
			return checkedBackground;
		}
		const layers = props.layers ?? [];
		if (new Set(layers).size !== layers.length) {
			return err(planError('duplicate-layer', 'Layer names must be unique.'));
		}
		return ok(
			new Plan({
				north: props.north,
				spatialElements: props.spatialElements?.map(item => ({ ...item, name: item.name.trim() })),
				renovation: props.renovation,
				id: props.id,
				projectId: props.projectId,
				name,
				background,
				calibration: null,
				layers: [...layers],
				parent: props.parent ? { planId: props.parent.planId, zoneId: props.parent.zoneId } : null,
				...details.value,
			}),
		);
	}

	/**
	 * Which document this Plan's background IS — the one field `SetPlanBackgroundCommand`
	 * writes (design slice 5). `null` clears it, which is what an undo of the FIRST import
	 * restores; an adapter treating `null` as "nothing to restore" is exactly the defect
	 * that passes every replace-an-existing-background test.
	 *
	 * Immutable like every other change here: a new `Plan`, re-validated, never a field
	 * written in place.
	 */
	withBackground(background: PlanBackgroundRef | null): Result<Plan, ValidationError> {
		const checked = validateBackground(background);
		if (!checked.ok) {
			return checked;
		}
		return ok(new Plan({ ...this.fields(), background }));
	}

	/**
	 * READ-path only: what `planFromPersistence` merges out of the geometry sidecar, the
	 * one file that owns this field. There is deliberately no `calibrate()` beside it —
	 * a Plan cannot derive its own calibration, because deriving one means rescaling every
	 * spatial-object coordinate in the same transaction, which is
	 * `ReversibleCalibratePlanCommand`'s whole job and nothing an immutable entity can do
	 * to files it cannot see. Re-validated here anyway: a hand-edited sidecar reaches this
	 * door, and the sidecar's Zod schema checks shapes, not the relationships between them.
	 *
	 * `null` clears it, exactly as `withBackground(null)` does: a sidecar CAN go back to
	 * uncalibrated — `ReversibleCalibratePlanCommand.undo` restores the exact document it
	 * read, and past a FIRST calibration that document carries `calibration: null` — so a
	 * reader merging a fresh snapshot over an entity loaded earlier has to be able to drop
	 * the stale one (a Codex P2 on pull request #85).
	 */
	withCalibration(
		calibration: Calibration | null,
	): Result<Plan, ValidationError | CalculationError> {
		const checked = calibration === null ? ok(null) : validateCalibration(calibration);
		if (!checked.ok) {
			return checked;
		}
		return ok(new Plan({ ...this.fields(), calibration }));
	}

	/**
	 * The label fields, re-validated (ADR-0029). `parent` is untouched: reparenting is not a
	 * thing this entity offers, and this is the only mutator that could have been mistaken for it.
	 */
	withDetails(details: PlanDetails): Result<Plan, ValidationError> {
		const resolved = resolveDetails(details, this);
		if (!resolved.ok) {
			return resolved;
		}
		return ok(new Plan({ ...this.fields(), ...resolved.value }));
	}

	private fields(): PlanFields {
		return {
			north: this.north,
			spatialElements: this.spatialElements,
			renovation: this.renovation,
			id: this.id,
			projectId: this.projectId,
			name: this.name,
			background: this.background,
			calibration: this.calibration,
			layers: this.layers,
			parent: this.parent,
			kind: this.kind,
			order: this.order,
		};
	}
}

export function withPlanRenovation(plan: Plan, renovation: Renovation | undefined): Result<Plan, ValidationError> {
	return Plan.create({ ...plan, renovation });
}

export function withPlanNorth(plan: Plan, north: number | undefined): Result<Plan, ValidationError> {
	return Plan.create({ ...plan, north });
}

export function withPlanSpatialElements(plan: Plan, spatialElements: readonly SpatialElementMetadata[] | undefined): Result<Plan, ValidationError> {
	return Plan.create({ ...plan, spatialElements });
}
