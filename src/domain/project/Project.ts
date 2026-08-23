import { err, ok, type Result } from '../../core/result/Result';
import type { ValidationError } from '../../core/errors/AppError';
import type { Money } from '../../core/money/Money';
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
