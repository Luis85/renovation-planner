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
	// A noun phrase rather than an imperative, so the Sie/du question does not arise at all —
	// `de/assetOpenLines.ts`'s header is why that is the safer spelling here.
	'designer.reference.remove': 'Referenz entfernen',
};
