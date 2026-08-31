import { normalizeFolder } from './paths';

/**
 * `toLowerCase` on the normalised path — see the asymmetry note in `foldersOverlap` — with
 * the vault ROOT reduced to the one spelling `contains` recognises.
 *
 * **This is UNVERIFIED from this repository and is deliberately not resting on either
 * answer.** `normalizePath` is `@public` in `obsidian.d.ts` with nothing documented about
 * the empty input, and Obsidian cannot be run here, so what it hands back for the vault
 * root is not a fact anything in this tree can establish. The mock in
 * `tests/helpers/obsidian-mock.ts` strips leading and trailing slashes and answers `''`; a
 * real vault may answer `'/'`. `contains` recognises the root as `''` alone, so under that
 * second reading `foldersOverlap('', 'Shared')` answers `false` — and §83's guard silently
 * stops covering a project whose `Project.md` sits at the vault root, which
 * `projectFolderOf` really produces from a user dragging that note there. Both §83
 * safeguards would be off, with every test green.
 *
 * Stripping the slashes here accepts BOTH spellings, which is the same trade the case-fold
 * below makes for the same reason: over-refusing costs a rename, under-refusing costs every
 * project's catalogue, and nothing here can ask which reading is true. It is a `replace`
 * rather than a test against `'/'` so that it holds for any root-ish answer and adds no arm
 * that only one of the two readings could ever reach — an untested arm is a failed gate.
 */
function fold(raw: string): string {
	return normalizeFolder(raw)
		.replace(/^\/+|\/+$/g, '')
		.toLowerCase();
}

/** Whether `outer` is an ancestor of `inner`, at a folder boundary. */
function contains(outer: string, inner: string): boolean {
	if (outer === '') return true;
	return inner.startsWith(`${outer}/`);
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
	const left = fold(a);
	const right = fold(b);
	if (left === right) return true;
	return contains(left, right) || contains(right, left);
}
