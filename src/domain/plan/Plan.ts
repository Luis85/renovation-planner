import { err, ok, type Result } from '../../core/result/Result';
import type { CalculationError, ValidationError } from '../../core/errors/AppError';
import type { ProjectId } from '../project/ProjectId';
import { createCalibration, validateCalibration, type Calibration, type CreateCalibrationInput } from './Calibration';
import type { PlanBackgroundRef } from './PlanBackgroundRef';
import { planError } from './Plan.errors';
import type { PlanId } from './PlanId';

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
		if (background && !background.path.trim()) {
			return err(planError('empty-background-path', 'A background reference needs a path.'));
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
