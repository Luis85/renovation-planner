import type { ProjectStatus } from '../../domain/project/ProjectStatus';
import type { StringKey } from '../i18n/locales/en';

/**
 * One locale key per `ProjectStatus` (PRD §35's Renovation Lifecycle), so
 * `NewProjectForm`'s status control shows real copy rather than the raw enum member
 * (`IDEA`, `AS_BUILT`, …) — measured on the shipped form: nothing lints a string that
 * never passes through a literal, since these come from `PROJECT_STATUSES` rather than
 * from `.setText(...)`/`.createEl(...)`.
 *
 * A `Record` over the full union, not a partial lookup: TypeScript refuses to compile this
 * file at all if a `ProjectStatus` member is missing, which is HALF of "impossible to add a
 * status with no label" — the other half is `projectStatusLabels.test.ts`, which asks
 * whether the key each entry names actually resolves to something in the shipped locale
 * tables, a question this file's own type cannot answer about `en.ts`/`de.ts`.
 *
 * These are ordinary UI labels, not `AppError` codes — the "every key here must equal a
 * minted `AppError.code`" rule in `en.ts`'s error block does not apply to them.
 */
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, StringKey> = {
	IDEA: 'form.new-project.status.idea',
	SURVEY: 'form.new-project.status.survey',
	DESIGN: 'form.new-project.status.design',
	ESTIMATE: 'form.new-project.status.estimate',
	PROCUREMENT: 'form.new-project.status.procurement',
	READY: 'form.new-project.status.ready',
	EXECUTION: 'form.new-project.status.execution',
	INSPECTION: 'form.new-project.status.inspection',
	COMPLETE: 'form.new-project.status.complete',
	AS_BUILT: 'form.new-project.status.as-built',
};
