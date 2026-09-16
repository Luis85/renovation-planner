/**
 * ADR-0034's one user-facing sentence: what a guarded command says when it is refused
 * because the vault holds an open write incident.
 *
 * The KEY is the error's own `code` — `toUserMessage` resolves a code directly when a key of
 * that exact name exists, ahead of the suffix and category tiers — so this row and
 * `WRITES_PAUSED_CODE` in `guardAgainstThrowing.ts` have to stay spelled identically.
 *
 * Its own FILE rather than a row in `en.ts`, and that is the standing rule rather than a
 * preference: both tables sit within about twenty counted lines of the 400-line `max-lines`
 * cap (`skipBlankLines`/`skipComments`, so this docblock is free and a key is not), and the
 * previous two increments that hit this wall — `en/editor.ts` and `en/errorFallback.ts` —
 * both settled it the same way. The fix is the extraction, never a wider budget.
 *
 * **What the copy may not say.** It must not offer to repair anything and must not imply the
 * plugin will clear itself: ADR-0034 refuses a plugin-decided all-clear outright, because
 * nothing here can tell a write that mended the affected files from any other write that
 * happened to land. So the only remedy it names is the one the user performs — check the
 * vault against a backup, then remove the file. The register is `settings.unrecovered`'s,
 * which already names a plugin-folder file by name for exactly this kind of dead end.
 *
 * Unannotated, like its sibling partials and for the same circular-type reason: `StringKey`
 * is `keyof typeof en` and `en` is assembled by spreading this module. `de/writeIncident.ts`
 * carries the parity type instead, so a key added here with no German counterpart is a
 * compile error rather than a case that goes red later.
 */
export const writeIncidentEn = {
	'write-incident.writes-paused':
		'Writing is paused. An earlier change was written and could not be undone, so files in this vault may be left half-written. Check them against a backup, then remove write-incidents.json from the plugin folder to resume writing.',
	'diagnostics.incidents': 'Open write incidents',
	'diagnostics.incidents.none': 'No write incident is open.',
	// The retirement gesture, and the ONE place in the diagnostics report a path appears. It
	// names the file rather than offering to remove it, because ADR-0034 refuses a
	// plugin-decided all-clear outright: nothing here can tell a write that mended the
	// affected files from any other write that happened to land, so a control would be a lie
	// with a button on it. One key with a `{path}` hole rather than a sentence concatenated
	// around a path — word order and the punctuation around it are the translator's.
	'diagnostics.incidents.remove':
		'Nothing here clears these. Check the affected files against a backup, then remove {path} to resume writing.',
	// The `unreadableWriteIncident` pair — a record written by a version whose shape this build
	// does not know. It is the incident a user most needs named and the one with the least to
	// say, so it gets a sentence instead of a blank row: the id and timestamp columns really
	// are empty, and an empty row reads as a rendering defect rather than as a fact.
	'diagnostics.incidents.unreadable': 'This build cannot read this record, so only its presence is known.',
	// An EMPTY affected list is a legal stamp (ADR-0034) meaning the raise site could not name
	// what it left standing — not a stamp with nothing wrong behind it.
	'diagnostics.incidents.unnamed': 'Affected files could not be named.',
};
