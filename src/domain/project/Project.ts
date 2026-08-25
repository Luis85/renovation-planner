import { err, ok, type Result } from '../../core/result/Result';
import type { ValidationError } from '../../core/errors/AppError';
import { isNegative, type Money } from '../../core/money/Money';
import { isProjectStatus, type ProjectStatus } from './ProjectStatus';
import type { ProjectId } from './ProjectId';
import { projectError } from './Project.errors';

export interface CreateProjectProps {
	readonly id: ProjectId;
	readonly name: string;
	readonly description?: string | null;
	readonly status?: ProjectStatus;
	readonly start?: Date | null;
	readonly targetCompletion?: Date | null;
	readonly budget?: Money | null;
	readonly contingency?: Money | null;
	readonly locationDescription?: string | null;
}

/**
 * `budget` and `contingency` are the two fields here that cannot go below zero, and this
 * is the boundary that refuses one: `Money` is a SIGNED quantity — spend minus budget is
 * a difference whose sign is the answer — so non-negativity is a per-field rule, enforced
 * where the field is validated.
 *
 * This entity is that place, and today it is the ONLY one: neither field is persisted yet
 * (`ProjectFrontmatterSchemaV1` declares `name` and `status`, not these two), so there is
 * no schema to state it at, and `CreateProjectCommand` constructs through here rather than
 * validating beside it. When the frontmatter grows the fields, the schema states the
 * SHAPE and this smart constructor keeps stating the rule — a Zod refinement there would
 * be a second answer to the same question, and the entity is the one every path passes.
 *
 * One code with the field NAMED in the message, not a code per field: two codes would
 * read as two rules (the shape `quantityEngine`'s `negativeQuantity` argues for).
 */
function negativeAmount(field: string, value: Money | null | undefined): ValidationError | null {
	if (!value || !isNegative(value)) return null;
	return projectError(
		'negative-amount',
		`A project ${field} cannot be negative; got ${value.amount} ${value.currency}.`,
	);
}

/**
 * The root aggregate (PRD §8). Immutable: a mutation produces a new instance through a
 * factory or `with*` method that re-validates — nothing mutates one in place. "Linked
 * plans" is deliberately NOT stored here; it is resolved by querying
 * `PlanRepository.listByProject` (see design slice 3, "Denormalization decision").
 */
export class Project {
	readonly id: ProjectId;
	readonly name: string;
	readonly description: string | null;
	readonly status: ProjectStatus;
	readonly start: Date | null;
	readonly targetCompletion: Date | null;
	readonly budget: Money | null;
	readonly contingency: Money | null;
	readonly locationDescription: string | null;

	private constructor(fields: {
		readonly id: ProjectId;
		readonly name: string;
		readonly description: string | null;
		readonly status: ProjectStatus;
		readonly start: Date | null;
		readonly targetCompletion: Date | null;
		readonly budget: Money | null;
		readonly contingency: Money | null;
		readonly locationDescription: string | null;
	}) {
		this.id = fields.id;
		this.name = fields.name;
		this.description = fields.description;
		this.status = fields.status;
		this.start = fields.start;
		this.targetCompletion = fields.targetCompletion;
		this.budget = fields.budget;
		this.contingency = fields.contingency;
		this.locationDescription = fields.locationDescription;
	}

	static create(props: CreateProjectProps): Result<Project, ValidationError> {
		const name = props.name.trim();
		if (!name) {
			return err(projectError('empty-name', 'A project needs a non-empty name.'));
		}
		if (!isProjectStatus(props.status ?? 'IDEA')) {
			return err(projectError('unknown-status', `"${String(props.status)}" is not a project status.`));
		}
		const negative =
			negativeAmount('budget', props.budget) ?? negativeAmount('contingency', props.contingency);
		if (negative) {
			return err(negative);
		}
		if (
			props.start &&
			props.targetCompletion &&
			props.targetCompletion.getTime() < props.start.getTime()
		) {
			return err(
				projectError('target-before-start', 'targetCompletion must be on or after start.'),
			);
		}
		return ok(
			new Project({
				id: props.id,
				name,
				description: props.description ?? null,
				status: props.status ?? 'IDEA',
				start: props.start ?? null,
				targetCompletion: props.targetCompletion ?? null,
				budget: props.budget ?? null,
				contingency: props.contingency ?? null,
				locationDescription: props.locationDescription ?? null,
			}),
		);
	}
}
