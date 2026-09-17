import type { assetReferenceViewEn } from '../en/assetReferenceView';

/**
 * German counterpart of `en/assetReferenceView.ts`. **Sie throughout**, like every other German table here;
 * `strings.test.ts` asserts no du-form imperative anywhere in `de.ts`, and its verb list is
 * enumerated rather than exhaustive, so matching a neighbour is not evidence that a form is allowed.
 */
export const assetReferenceViewDe: Record<keyof typeof assetReferenceViewEn, string> = {};
