import { isProjectStatus } from '../../domain/project/ProjectStatus';
import { PROJECT_STATUS_LABELS } from './projectStatusLabels';
import { tr } from '../i18n/strings';

/**
 * `ProjectSummaryDto.status` is typed `string`, not `ProjectStatus` — a project note this
 * build cannot recognise the lifecycle stage of is still a project this list must draw a row
 * for, so this cannot refuse the way `PROJECT_STATUS_LABELS[status]` alone would (an index
 * outside `Record<ProjectStatus, StringKey>`'s domain, `undefined` at runtime through the type
 * system's back). A recognised status resolves through the same label table `NewProjectForm`
 * uses, via `tr`; an unrecognised one renders as the raw value it actually is, deliberately,
 * rather than inventing a locale key for a value nothing in the domain can produce today
 * (`Project.create` refuses any `status` that fails `isProjectStatus`) — the fallback exists
 * for a note this build cannot fully make sense of, not for a value this build itself would
 * ever write.
 *
 * Extracted out of `ProjectList.vue` at its SECOND consumer (design slice 21's detail header),
 * rather than copied into it: two expressions of one question, two files apart, drift
 * immediately.
 */
export function statusLabel(status: string): string {
	return isProjectStatus(status) ? tr(PROJECT_STATUS_LABELS[status]) : status;
}
