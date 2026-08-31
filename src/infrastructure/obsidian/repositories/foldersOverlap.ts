import { normalizeFolder } from './paths';

/** `toLowerCase` on the normalised path — see the asymmetry note in `foldersOverlap`. */
function fold(raw: string): string {
	return normalizeFolder(raw).toLowerCase();
}

/**
 * Whether `inner` sits under `outer` — a folder or a note — at a folder BOUNDARY and with
 * the case folding the whole module argues for below.
 *
 * Exported because it is the question two doors ask, and a question asked at one door is a
 * function: `foldersOverlap` asks it in both directions, and `catalogueNotesIn` asks it of
 * every file in the vault to decide what a library move enumerates. Those two spelled it
 * separately once, and they disagreed about exactly the thing this file folds for — the
 * predicate refused a case-only mismatch as "the same folder" while the enumeration matched
 * case-sensitively and selected NOTHING, so a migration whose source differed only in case
 * moved no notes, reported success and persisted the destination over a catalogue still
 * sitting at the old path.
 *
 * The vault ROOT contains everything, which is what makes the empty-source arm an answer
 * rather than an accident.
 */
export function folderContains(outer: string, inner: string): boolean {
	const folded = fold(outer);
	if (folded === '') return true;
	return fold(inner).startsWith(`${folded}/`);
}

/**
 * §83: the library folder and a project folder may neither be EQUAL nor CONTAIN one
 * another. The consequence is not cosmetic — deleting a project is deleting its folder, so
 * a project folder holding the library would take every project's shared catalogues with
 * it.
 *
 * Containment is tested at the SEGMENT boundary, never as a string prefix: `Renovation/Lib`
 * is not inside `Renovation/Library`, and a bare `startsWith` says it is.
 *
 * The vault ROOT (`''`) contains everything, so it overlaps every folder — which is what
 * makes an empty library setting a refusal rather than a curiosity.
 *
 * Symmetric on purpose: §83 says the check "refuses in every direction, since either path
 * can be the one that moves", and one predicate with three call sites is what keeps that
 * from becoming three predicates.
 */
export function foldersOverlap(a: string, b: string): boolean {
	// CASE-INSENSITIVE, deliberately, and this is the one asymmetric decision in the file.
	// Obsidian's paths are case-sensitive; Windows and macOS filesystems usually are not, so
	// `Renovation/library` and `Renovation/Library` can be ONE folder on disk and two strings
	// here. A case-sensitive comparison answers `false` for a genuine overlap and lets through
	// exactly the state this guard exists to prevent — deleting the apparently separate
	// project folder takes the shared catalogue with it.
	//
	// Over-refusing costs a user one rename; under-refusing costs them every project's
	// catalogue. The directions are not symmetric, so the safe one is taken without waiting
	// to learn which filesystem the vault is on — which nothing here can ask anyway.
	if (fold(a) === fold(b)) return true;
	return folderContains(a, b) || folderContains(b, a);
}
