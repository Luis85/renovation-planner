/**
 * The asset library vocabulary for duplicating a definition and showing which plans use one before an impactful change (AD13).
 * Spread into `en/editor.ts`.
 *
 * **Created EMPTY by the integrator, before AD13 duplicate and usage-scope half was dispatched.** Every locale module and both
 * aggregators are integrator-owned (AD01 §2), so a card that needed strings would otherwise be a
 * card that needed a shared file, and two cards wanting one table is two workers appending to one
 * file. One pair per card, wired in advance, is what keeps the leases disjoint.
 *
 * **A pair whose card adds no strings is DELETED, not left standing.** `assetMarquee` was deleted
 * for exactly that reason once AD08's fix round turned out to need none.
 *
 * **German is Sie throughout** and `strings.test.ts` enforces it with an ENUMERATED verb list that
 * is still incomplete. See `de/assetOpenLines.ts`'s header for what reading the neighbours instead
 * of the rule cost this package once.
 *
 * **`used-in-plans` is a SECOND section beside `used-in` rather than a widening of it**, and the
 * two answer different questions: `used-in` groups the REQUIREMENTS that reference this asset by
 * project, and this one names the PLANS whose geometry places it. An asset can be placed with no
 * requirement and required with nothing placed, so one key family cannot serve both.
 *
 * **The `(s)` plural is the house convention here**, copied from
 * `view.asset-library.used-in.project` rather than invented: there is no plural mechanism in `t`,
 * and inventing one for two strings would put a second answer to pluralisation in the tree.
 * Ruling **AD18-R7** settled that it stays, and nothing below touches it.
 *
 * **`used-in-plans.plan` names the PROJECT as well, inside this one key rather than beside it.**
 * A plan name is not unique across a vault — the catalogue is vault-level, so one definition is
 * placeable from plans in different projects — and two plans both named `Kitchen` drew as two
 * rows of identical visible text until the query carried a project name to fill this hole. A
 * project name is not unique either, so this narrows the collision rather than removing it;
 * `PlanAssetUsage`'s own header carries the residual arm and what closing it would cost. The
 * alternative was a second element beside the label, and `strings.ts`'s own rule is what refuses
 * it: *"ONE KEY PER LABEL, never a translated fragment concatenated with a name: word order and
 * the punctuation around an interpolated name are the translator's to choose."* Markup deciding
 * where the project sits and what separates it from the plan is exactly that concatenation, with
 * the punctuation moved out of the translator's reach — so the parentheses are in the template,
 * where German may spell them differently if it ever needs to.
 */
export const assetDuplicateEn = {
	'view.asset-library.used-in-plans': 'Used in plans',
	'view.asset-library.used-in-plans.loading': 'Loading which plans place this…',
	'view.asset-library.used-in-plans.failed': 'The plans that place this asset could not be read, so the scope below is unknown.',
	'view.asset-library.used-in-plans.none': 'No plan places this asset',
	'view.asset-library.used-in-plans.plan': '{name} ({project}) — {count} placement(s)',
	// The count is said out loud rather than drawn as a caveat marker, because a scope that is
	// silently incomplete is worse than one that says so: this section exists to tell a user what
	// an edit will touch, and a note it could not read is a plan it cannot promise about. "Note"
	// and not "plan", because the query counts three kinds — a project note, a plan note and a
	// plan's geometry sidecar — and naming only plans would be narrower than the number is.
	'view.asset-library.used-in-plans.unreadable': '{count} note(s) could not be read, so this list may be incomplete',
	'view.asset-library.duplicate': 'Duplicate',
	'view.asset-library.duplicate.title': 'Duplicate as new asset',
	// C11's own sentence, said where the gesture is: a duplicate is for intentional divergence, so
	// the thing a user most needs to know is that the plans listed above keep the original.
	'view.asset-library.duplicate.explains': 'The copy is a new definition with its own geometry. Plans that place this asset keep the original.',
	'view.asset-library.duplicate.name': 'Name of the copy',
	'view.asset-library.duplicate.suggested': '{name} (copy)',
	'view.asset-library.duplicate.confirm': 'Create copy',
	'view.asset-library.duplicate.cancel': 'Cancel',
} as const;
