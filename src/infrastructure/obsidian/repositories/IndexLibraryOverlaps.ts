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
