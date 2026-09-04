import { isProjectStatus, PROJECT_STATUSES } from '../../domain/project/ProjectStatus';

/**
 * How many cells the lifecycle tick strip draws — the arc's own length, read from the enum
 * rather than written as `10`.
 *
 * A literal here is a second declaration of a fact the domain already owns, and the direction
 * it fails in is silent: a status added to `PROJECT_STATUSES` would render a strip one cell
 * short of the stage it is trying to show, with every test green.
 */
export const PROJECT_STATUS_STAGE_COUNT = PROJECT_STATUSES.length;

/**
 * Where this status sits in the Renovation Lifecycle (PRD §35), 0-based — or `null` for a
 * value this build does not recognise.
 *
 * The Home spec §6 is why this exists: `ProjectStatus` has ten members and they are an ARC,
 * not a flat category, so a badge throws away the one fact a renovator actually wants. The
 * strip is the arc drawn; this is the only thing that says where on it a project is.
 *
 * `null` rather than `0` for an unrecognised value, and the difference is a claim rather than
 * a convenience: `ProjectSummaryDto.status` is typed `string` precisely so a note this build
 * cannot fully read still gets a row (`statusLabel` states the same rule for the word), and a
 * strip drawn at stage 0 would tell the user that project is at IDEA. It renders no strip at
 * all instead, which is the honest picture and is also what the narrow composition already
 * looks like, so nothing new has to be designed for it.
 */
export function projectStatusStage(status: string): number | null {
	if (!isProjectStatus(status)) return null;
	return PROJECT_STATUSES.indexOf(status);
}
