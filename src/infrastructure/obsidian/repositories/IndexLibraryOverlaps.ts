import type { LibraryOverlaps } from '../../../application/ports/LibraryOverlaps';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import type { ProjectId } from '../../../domain/project/ProjectId';
import { foldersOverlap } from './foldersOverlap';
import { projectFolderOf } from './paths';

/**
 * §83's third site has no door. ADR-0013 derives a project's folder from where its
 * `Project.md` sits, so a user moves a project by dragging a folder in Obsidian's file
 * explorer — there is no command to refuse. This answers which projects are currently in
 * that state, PER READ, so a user who fixes it simply stops being reported.
 *
 * **Per read is not the same as promptly, and the difference belongs to this very gesture.**
 * The answer is derived from the Project Index, and a folder dragged in Obsidian's file
 * explorer is never reported to that index: `RenovationPlannerPlugin` filters the vault's
 * create/modify/delete and rename events to `TFile`, so the `TFolder` Obsidian hands it is
 * dropped and the index keeps the note's OLD path. `projectFolderOf` then derives the old
 * folder, and the row gains or loses its marker at the next full index REBUILD — at
 * `onLayoutReady`, so a reload, or after a settings save — rather than as the drag lands.
 * PRE-EXISTING and not this class's to fix: that filter dates from design slice 4's
 * persistence pipeline and this is the first consumer that makes it visible. Forwarding a
 * folder rename is a change to the vault-change pipeline that every index consumer inherits.
 *
 * Here rather than in `application/`: it is built from `projectFolderOf` and
 * `foldersOverlap`, the two modules that already own how a vault path is taken apart and
 * how §83's rule is spelled, and duplicating either of them one layer up is how one rule
 * becomes two that disagree. The `libraryFolder` is the SETTING as composed, taken as a
 * constructor argument so this object cannot outlive the settings it was built from — a
 * settings save retires the whole root and composes a new one.
 */
export class IndexLibraryOverlaps implements LibraryOverlaps {
	constructor(
		private readonly index: ProjectIndex,
		private readonly libraryFolder: string,
	) {}

	overlapping(projectIds: readonly ProjectId[]): readonly ProjectId[] {
		return projectIds.filter((id) => {
			const folder = projectFolderOf(this.index, id);
			// `undefined` is a REFUSAL and not a prompt to fall back: a project the index
			// cannot place has no folder to compare, and marking a row over a path nobody
			// knows is worse than not marking it.
			return folder !== undefined && foldersOverlap(folder, this.libraryFolder);
		});
	}
}
