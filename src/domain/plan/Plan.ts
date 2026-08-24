import { err, ok, type Result } from '../../core/result/Result';
import type { CalculationError, ValidationError } from '../../core/errors/AppError';
import type { ProjectId } from '../project/ProjectId';
import { createCalibration, validateCalibration, type Calibration, type CreateCalibrationInput } from './Calibration';
import { PLAN_BACKGROUND_KINDS, type PlanBackgroundRef } from './PlanBackgroundRef';
import { planError } from './Plan.errors';
import type { PlanId } from './PlanId';

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

export interface CreatePlanProps {
	readonly id: PlanId;
	readonly projectId: ProjectId;
	readonly name: string;
	readonly background?: PlanBackgroundRef | null;
	readonly layers?: readonly string[];
}

interface PlanFields {
	readonly id: PlanId;
	readonly projectId: ProjectId;
	readonly name: string;
	readonly background: PlanBackgroundRef | null;
	readonly calibration: Calibration | null;
	readonly layers: readonly string[];
}

/**
 * A floor plan belonging to exactly one Project (PRD §59). Immutable; `projectId` is set
 * once at creation and no command moves a Plan between Projects. Calibration starts
 * `null` until a `CalibratePlanCommand` succeeds.
 */
export class Plan {
	readonly id: PlanId;
	readonly projectId: ProjectId;
	readonly name: string;
	readonly background: PlanBackgroundRef | null;
	readonly calibration: Calibration | null;
	readonly layers: readonly string[];

	private constructor(fields: PlanFields) {
		this.id = fields.id;
		this.projectId = fields.projectId;
		this.name = fields.name;
		this.background = fields.background;
		this.calibration = fields.calibration;
		this.layers = fields.layers;
	}

	static create(props: CreatePlanProps): Result<Plan, ValidationError> {
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
				id: props.id,
				projectId: props.projectId,
				name,
				background,
				calibration: null,
				layers: [...layers],
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

	withCalibration(
		calibration: Calibration,
	): Result<Plan, ValidationError | CalculationError> {
		const checked = validateCalibration(calibration);
		if (!checked.ok) {
			return checked;
		}
		return ok(new Plan({ ...this.fields(), calibration }));
	}

	/**
	 * Derives and stores the calibration in one step — what `CalibratePlanCommand`
	 * actually calls, so a calibration cannot be validated twice through two different
	 * doors.
	 */
	calibrate(input: CreateCalibrationInput): Result<Plan, ValidationError | CalculationError> {
		const calibration = createCalibration(input);
		if (!calibration.ok) {
			return calibration;
		}
		return this.withCalibration(calibration.value);
	}

	private fields(): PlanFields {
		return {
			id: this.id,
			projectId: this.projectId,
			name: this.name,
			background: this.background,
			calibration: this.calibration,
			layers: this.layers,
		};
	}
}
