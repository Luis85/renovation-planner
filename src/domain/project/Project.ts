import { err, ok, type Result } from '../../core/result/Result';
import type { ValidationError } from '../../core/errors/AppError';
import { isNegative, type Currency, type Money } from '../../core/money/Money';
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
	readonly currency: Currency;
}

/**
 * `budget` and `contingency` are the two fields here that cannot go below zero, and this
 * is the boundary that refuses one: `Money` is a SIGNED quantity — spend minus budget is
 * a difference whose sign is the answer — so non-negativity is a per-field rule, enforced
 * where the field is validated.
 *
 * This entity is that place, and today it is the ONLY one: neither field is persisted yet
 * (`ProjectFrontmatterSchemaV1` declares `name` and `status`, not these two), so there is
 * no schema to state it at, and both `CreateProjectCommand` and the persistence mapper
 * construct through `Project.create` rather than validating beside it — the constructor is
 * private, so there is no other way to make one. When the frontmatter grows the fields, the schema states the
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
 * A project has ONE currency, and this is the boundary that says so. `budget` and
 * `contingency` are `Money`, so each carries a currency of its own — without this guard
 * `Project.currency` would be a THIRD answer to "what currency is this project in" on an
 * entity that already held two.
 *
 * The same reasoning as `negativeAmount` above, and the same shape: the constructor is
 * private, so this is the one place every `Project` passes; neither field is persisted
 * yet, so there is no schema to state it at; and one code with the field NAMED in the
 * message, because two codes would read as two rules.
 */
function mismatchedCurrency(
	field: string,
	value: Money | null | undefined,
	currency: Currency,
): ValidationError | null {
	if (!value || value.currency === currency) return null;
	return projectError(
		'currency-mismatch',
		`A project ${field} must be in the project's currency (${currency}); got ${value.currency}.`,
	);
}

/**
 * A `Date` that names a real instant, and this is the boundary that refuses one that does
 * not. `new Date('nonsense')` is an ordinary `Date` object as far as the type system is
 * concerned — truthy, assignable to `CreateProjectProps['start']` — whose `getTime()` is
 * `NaN`, and every comparison against `NaN` is false, so the `target-before-start` rule
 * below waves one through while APPEARING to have checked it.
 *
 * It has to be refused HERE rather than survived downstream, because `toISOString()` on
 * one throws a `RangeError` rather than returning anything: since design slice 16 persists
 * both dates, `projectMapper`'s `toDateOnly` is on that path, and a throw there is mapped
 * as a vault fault — the user is told the note could not be written when the truth is that
 * the date was never a date. The private constructor makes this the one place every
 * `Project` passes, so the mapper needs no second guard and deliberately has none.
 *
 * One code with the field NAMED in the message, exactly as `negativeAmount` above: two
 * codes would read as two rules.
 */
function invalidDate(field: string, value: Date | null | undefined): ValidationError | null {
	if (!value || Number.isFinite(value.getTime())) return null;
	return projectError('invalid-date', `A project ${field} must be a real date.`);
}

/**
 * Every rule about the date PAIR, in the one order they can be asked in — which is the
 * reason they are one function rather than two checks standing beside each other in
 * `create`. The ordering comparison is only meaningful once both dates are real, and it
 * FAILS OPEN rather than throwing when they are not, so a version that ran it first would
 * accept the pair and report nothing. Separated, that dependency is a fact about the line
 * order somebody has to keep noticing; together, it is the shape of the function.
 */
function invalidDates(props: CreateProjectProps): ValidationError | null {
	const unreal =
		invalidDate('start', props.start) ?? invalidDate('targetCompletion', props.targetCompletion);
	if (unreal) return unreal;
	if (
		props.start &&
		props.targetCompletion &&
		props.targetCompletion.getTime() < props.start.getTime()
	) {
		return projectError('target-before-start', 'targetCompletion must be on or after start.');
	}
	return null;
}

/**
 * The root aggregate (PRD §8). Immutable: a mutation produces a new instance through a
 * factory or `with*` method that re-validates — nothing mutates one in place. "Linked
 * plans" is deliberately NOT stored here; it is resolved by querying
 * `PlanRepository.listByProject` (see design slice 3, "Denormalization decision").
 */
interface ProjectFields {
	readonly id: ProjectId;
	readonly name: string;
	readonly description: string | null;
	readonly status: ProjectStatus;
	readonly start: Date | null;
	readonly targetCompletion: Date | null;
	readonly budget: Money | null;
	readonly contingency: Money | null;
	readonly locationDescription: string | null;
	readonly currency: Currency;
}

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
	readonly currency: Currency;

	private constructor(fields: ProjectFields) {
		this.id = fields.id;
		this.name = fields.name;
		this.description = fields.description;
		this.status = fields.status;
		this.start = fields.start;
		this.targetCompletion = fields.targetCompletion;
		this.budget = fields.budget;
		this.contingency = fields.contingency;
		this.locationDescription = fields.locationDescription;
		this.currency = fields.currency;
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
		const mismatch =
			mismatchedCurrency('budget', props.budget, props.currency)
			?? mismatchedCurrency('contingency', props.contingency, props.currency);
		if (mismatch) return err(mismatch);
		const dates = invalidDates(props);
		if (dates) {
			return err(dates);
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
				currency: props.currency,
			}),
		);
	}

	/**
	 * Re-validates, so `mismatchedCurrency` runs on the NEW value: a project holding a
	 * £10,000 budget cannot become an EUR project without the budget moving too.
	 */
	// Still unconsumed in src/ — Task 5 of this plan is its first caller. Suppressed rather
	// than deleted: deleting it is how a declared capability rots.
	// fallow-ignore-next-line unused-class-member
	withCurrency(currency: Currency): Result<Project, ValidationError> {
		return Project.create({
			id: this.id,
			name: this.name,
			description: this.description,
			status: this.status,
			start: this.start,
			targetCompletion: this.targetCompletion,
			budget: this.budget,
			contingency: this.contingency,
			locationDescription: this.locationDescription,
			currency,
		});
	}
}
