/**
 * The two GENERIC tiers `toUserMessage` falls back through when no key equals the raised
 * `AppError.code` exactly: the closed `CODE_SUFFIX_KEYS` table, keyed by the stable half of a
 * code whose prefix varies per entity kind, and the one honest sentence per slice-2 category
 * beneath it. Every other error string stays in `en.ts`, because those are keyed by a single
 * minted code and belong beside the surface that raises them — the `asset-price.*` rows that
 * deliberately OVERRIDE `error.suffix.revision-conflict` and `.external-modification` are the
 * clearest case, and their reasons are written where they sit.
 *
 * Split out of `en.ts` when this branch's `error.suffix.uncompensated` row took that file to
 * 402 lines against the 400-line `max-lines` cap (`skipBlankLines`/`skipComments`, so this
 * docblock is free and a key is not). The fix is the extraction, not a wider budget — `en.ts`'s
 * own docblock settled that at the previous increment that hit this wall. `en` is still the one
 * object `StringKey` derives from; the spread adds a FILE, never a second source of truth.
 *
 * Unannotated, like its sibling partials, and deliberately NOT typed against `StringKey`:
 * `StringKey` is `keyof typeof en` and `en` is assembled by spreading this module, so naming
 * it here would be a circular type. `de/errorFallback.ts` carries the parity type instead
 * (`Record<keyof typeof errorFallbackEn, string>`), which most pairs in these two directories
 * use and is stricter than the table-wide check in
 * `strings.test.ts`: a key added here with no German counterpart is a compile error rather
 * than a case that goes red later.
 */
export const errorFallbackEn = {
	'error.suffix.schema-version-unsupported':
		'This note was written by a newer version of this plugin. Update the plugin to open it.',
	'error.suffix.revision-conflict': 'This entry changed elsewhere in the meantime. Reload and try again.',
	'error.suffix.external-modification': 'This entry was edited outside the plugin. Reload and try again.',
	'error.suffix.migration-failed': 'This note could not be converted to the current format.',
	// THREE more suffixes, and the class they belong to is no longer described here at all: it
	// is ASSERTED, by `toUserMessage.test.ts`'s 'every per-kind suffix raised in
	// src/infrastructure/ resolves to something other than its category sentence'. The prose
	// this replaces quoted a grep and read FOUR off it; the same grep prints SIX, and one of the
	// six is not a code at all (a logger EVENT name), which is the half no text scan can settle
	// and why that case carries a named exclusion table rather than a number.
	//
	// Both are SUFFIXES rather than per-kind entries because each is raised from ONE site
	// parameterised by kind, so a direct `asset-price.` entry would answer it for one kind and
	// leave `plan.`, `zone.` and the rest on the generic category sentence — which is where they
	// were until this row: measured, `schema-version-malformed` appeared nowhere in this file.
	// PRE-EXISTING, and one row fixes it for every kind.
	'error.suffix.schema-version-malformed':
		"This note's version could not be read, so it was not opened.",
	'error.suffix.project-folder-unresolved':
		'This note could not be saved, because the folder of the project it belongs to could not be found.',
	// Raised when a note's own `id` names a different entity from the one the index sent us
	// looking for it, which is a STALE INDEX rather than an unreadable vault — so the category
	// sentence it fell back to ("The vault could not be read or written") named the wrong thing
	// to do about it as well as the wrong cause.
	'error.suffix.note-id-mismatch':
		'This note belongs to a different entry, so it was not opened. Reload the vault to rebuild the index.',
	// Every refusal whose code ends in `-uncompensated`: a write landed, the undo for it also
	// refused, and something of it is still in the vault.
	//
	// **It names NO object, and that is the correction rather than vagueness.** This sentence
	// inherited "inspect the affected notes" from `zone.sidecar-*-uncompensated` above, where
	// the note IS on disk and that is a real action. It is false for four of the five codes
	// this row covers: `project.write-uncompensated`'s residue is an empty FOLDER and no note
	// was written at all, `plan.write-uncompensated`'s is an orphan geometry sidecar with no
	// note either, and the three delete codes TRASHED the note — nothing is at the path to
	// inspect. Carving `project.` out to its own row would not have fixed it; the other four
	// would still have been pointed at notes that are not there.
	//
	// The developer console is the one pointer true of all five: every path here logs a
	// `*-compensation-failed` line naming what it could not take back, before it returns.
	'error.suffix.uncompensated':
		'A change was written and could not be undone again, so part of it is still in the vault. Check the developer console to see what was left behind before editing further.',
	'error.category.domain': 'Something about the project data is invalid.',
	'error.category.validation': 'This data is not in the expected form.',
	'error.category.persistence': 'The vault could not be read or written.',
	'error.category.geometry': 'A geometry value is invalid.',
	'error.category.import': 'Importing failed.',
	'error.category.migration': 'This note cannot be read with this version of the plugin.',
	'error.category.reference': 'That entry no longer exists.',
	'error.category.calculation': 'A quantity could not be calculated.',
};
