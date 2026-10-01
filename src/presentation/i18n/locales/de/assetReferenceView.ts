import type { assetReferenceViewEn } from '../en/assetReferenceView';

/**
 * German counterpart of `en/assetReferenceView.ts`. **Sie throughout**, like every other German table here;
 * `strings.test.ts` asserts no du-form imperative anywhere in `de.ts`, and its verb list is
 * enumerated rather than exhaustive, so matching a neighbour is not evidence that a form is allowed.
 */
export const assetReferenceViewDe: Record<keyof typeof assetReferenceViewEn, string> = {
	// "Referenz" and not "Vorlage": `de/assetReference.ts` already uses the first for this block's
	// own heading and the second for the document's NAME row, and these two strings are about the
	// reference rather than about which file it is.
	'designer.view.reference-opacity': 'Deckkraft der Referenz',
	// An INFINITIVE (`entfernen`), not a noun phrase and not a du-imperative. The infinitive is the
	// neutral Sie-compatible form German UI uses for an action label, which is what keeps this out
	// of the register `strings.test.ts` refuses — and that rule's verb list is enumerated rather
	// than exhaustive, so a form it does not name is unjudged and not blessed
	// (`de/assetOpenLines.ts`'s header is what this package already paid for reading neighbours
	// instead of the rule).
	'designer.reference.remove': 'Referenz entfernen',
};
