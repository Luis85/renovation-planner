/**
 * The designer's way OUT of a stale canvas — ruling AD18-R13, card W20-A's copy.
 *
 * Two keys, and the FIRST sentence is deliberately not here. `designer.refresh-failed` — what
 * the notice says the first time a re-read fails — stays in `en.ts` where it was minted, beside
 * `designer.asset-missing.*` and the two background notices it was written against. Moving an
 * existing key between locale modules is churn with no reader (`en/designerAdd.ts`'s header
 * makes the same call about four stale key NAMES), and it would put a shared, integrator-owned
 * file in a card's diff for a cut-and-paste. So the split is deliberate rather than discovered:
 * the notice's first sentence is in `en.ts`, its SECOND sentence and its control are here.
 *
 * **`designer.refresh-failed.again` is a message about a retry the user pressed, which is what
 * makes it a second key rather than a rewording of the first.** The Plan Editor's strip draws
 * the identical pair — `editor.refresh-failed` swapped for `editor.refresh-failed.again` once
 * `retriesFailed > 0` — and the reason is the same on both surfaces: a notice whose text does
 * not move after a press is indistinguishable from a press that did nothing, and this one has a
 * live region whose announcement fires on the text CHANGING.
 *
 * **The label is minted rather than borrowed, and the candidate was a real one.**
 * `view.failure.retry` already reads "Try again", is view-generic rather than named for another
 * surface, and is already resolved by this very component for the failure panel's action. It is
 * still the wrong key here: its name says FAILURE STATE, and the distinction this surface works
 * hardest to keep — `AssetDesignerRoot`'s `failure` computed, `styles/designer.css`'s own
 * comment, and step 7 of `docs/tests/cases/Recover an asset design rather than lose it.md` — is
 * that a stale notice is NOT one. `en.ts`'s note beside `designer.asset-missing.action` is the
 * general form: a borrowed key whose name names a sibling's state is not the same trade as a
 * borrowed word.
 */
export const designerRecoveryEn = {
	/**
	 * The notice's second sentence: the retry itself has now failed. It does not repeat the
	 * advice to try again — the button is still there, directly beside it — and it keeps the
	 * "may still be out of date" clause, because that is the fact the user is being asked to act
	 * on and it has not changed.
	 */
	'designer.refresh-failed.again': 'Re-reading this asset failed again; what you see may still be out of date.',
	/** The control. Two words, the same two the Plan Editor's strip uses, for the same gesture. */
	'designer.refresh-failed.retry': 'Try again',
} as const;
