import type { EntityType, ProjectIndex, ProjectIndexEntry } from '../application/ports/ProjectIndex';

/**
 * Every entry of one kind the Project Index knows about (§47) — the index rather than the
 * Vault, because it is the single answer to where an entity is and a second scan here could
 * disagree with it.
 *
 * A filter over `entries()` because the question is asked once, when a palette command runs:
 * `getIdsByType` would answer ids alone, and a picker needs the PATH to render a row.
 *
 * ONE function rather than a `planEntries` beside a `projectEntries`, and the distinction
 * this repository draws elsewhere is what says so: two guards that merely LOOK alike are two
 * questions, while these two are the same question with its type argument spelled
 * differently. `undefined` is the unrecovered-settings session, which composes no index at
 * all and therefore knows of no entries — the same answer an empty vault gives, which is what
 * lets both palette commands take one branch for both.
 */
export function entriesOfType(index: ProjectIndex | undefined, type: EntityType): ProjectIndexEntry[] {
	return (index?.entries() ?? []).filter((entry) => entry.type === type);
}
