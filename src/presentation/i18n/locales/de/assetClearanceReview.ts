import type { assetClearanceReviewEn } from '../en/assetClearanceReview';

/**
 * German counterpart of `en/assetClearanceReview.ts`. **Sie throughout**, like every other German table here;
 * `strings.test.ts` asserts no du-form imperative anywhere in `de.ts`, and its verb list is
 * enumerated rather than exhaustive, so matching a neighbour is not evidence that a form is allowed.
 */
export const assetClearanceReviewDe: Record<keyof typeof assetClearanceReviewEn, string> = {};
