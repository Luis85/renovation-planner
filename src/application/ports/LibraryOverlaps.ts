import type { ProjectId } from '../../domain/project/ProjectId';

/**
 * Which projects are, right now, in the state §83 forbids: a project folder equal to the
 * library folder, or one containing the other.
 *
 * **This port exists because §83's third site has no door.** Two of the three sites §83 names
 * can refuse — creating a project chooses a folder, and moving the library is a command. The
 * third cannot: ADR-0013 derives a project's folder from where its `Project.md` sits, so a
 * user moves a project by dragging a folder in Obsidian's file explorer, and there is no
 * command in `application/commands/project/` for that gesture to pass through. Nothing can be
 * refused, so the affected project's own row says so instead.
 *
 * **Answered PER READ, never recorded.** That is the whole design and not an implementation
 * detail: a derived answer makes staleness, counting, retraction, slot caps and session
 * lifetime unrepresentable rather than handled. A user who drags the folder back is simply
 * absent from the next answer, and there is nothing to retract because nothing was kept.
 *
 * SYNCHRONOUS by construction. The answer is a fact about the Project Index — SDD §47's
 * single answer to "where is entity X" — which is already in memory, so there is no read to
 * await and therefore no second failure mode for a caller to have a policy about.
 */
export interface LibraryOverlaps {
	/** The subset of `projectIds` whose derived folder overlaps the library folder (§83). */
	overlapping(projectIds: readonly ProjectId[]): readonly ProjectId[];
}
