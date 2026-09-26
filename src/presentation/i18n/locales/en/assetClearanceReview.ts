/**
 * The asset designer vocabulary for the clearance review state: the notice a preserved clearance carries after a resize, and the action that answers it (AD14-R1).
 * Spread into `en/editor.ts`.
 *
 * **Created EMPTY by the integrator, before AD14 was dispatched.** Every locale module and both
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
 */
export const assetClearanceReviewEn = {
	/**
	 * The notice, and it says what HAPPENED rather than warning about what might: the boundary on
	 * screen is the one the user drew, standing beside an object that is no longer the size it was
	 * drawn for. AD14-R1's own argument is that the wrongness is visible — this sentence only
	 * explains it.
	 */
	'designer.clearance.review.notice':
		'This clearance was kept at the size you drew it when the object was resized. Check that it still describes the space you need.',
	'designer.clearance.review.action': 'Mark clearance as reviewed',
	/**
	 * A refusal no command can produce, so it reaches a user only through a hand-edited sidecar —
	 * `absent-clearance-cannot-be-pending`'s exact position. It lives in THIS table rather than
	 * beside its sibling in `en.ts` for a lease reason and not a taxonomic one: the aggregators are
	 * integrator-owned, and `hasLocaleKey` asks `key in en`, which a key spread through
	 * `en/editor.ts` satisfies identically.
	 */
	'asset.absent-clearance-cannot-need-review': 'There is no clearance to review.',
} as const;
