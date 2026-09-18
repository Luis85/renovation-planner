import type { assetClearanceReviewEn } from '../en/assetClearanceReview';

/**
 * German counterpart of `en/assetClearanceReview.ts`. **Sie throughout**, like every other German table here;
 * `strings.test.ts` asserts no du-form imperative anywhere in `de.ts`, and its verb list is
 * enumerated rather than exhaustive, so matching a neighbour is not evidence that a form is allowed.
 */
export const assetClearanceReviewDe: Record<keyof typeof assetClearanceReviewEn, string> = {
	// `Prüfen Sie` rather than `Prüfe`: the Sie form, and the precedent is `Prüfen Sie` itself —
	// nine hits across the German tables, measured. An earlier version of this comment cited
	// `Überprüfen Sie`, which appears exactly once in `locales/`: in the comment claiming it. `Freiraum` is this locale's word for a clearance everywhere else
	// (`asset.invalid-clearance`, `designer.toolbar.trace-clearance`), and `Grundriss` appears
	// nowhere here — that word is the plan editor's drawing surface, not an asset's outline.
	'designer.clearance.review.notice':
		'Dieser Freiraum wurde beim Ändern der Objektgröße in der gezeichneten Größe belassen. Prüfen Sie, ob er den benötigten Platz noch beschreibt.',
	// An infinitive construction, which is the neutral Sie-compatible form for a button; a
	// du-imperative (`Markiere …`) would be a different register in a file that has one.
	'designer.clearance.review.action': 'Freiraum als geprüft markieren',
	'asset.absent-clearance-cannot-need-review': 'Es gibt keinen Freiraum, der geprüft werden könnte.',
};
