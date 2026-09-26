import type { assetWorkflowEn } from '../en/assetWorkflow';

/**
 * German counterpart of `en/assetWorkflow.ts`. **Sie throughout**, like every other German table here;
 * `strings.test.ts` asserts no du-form imperative anywhere in `de.ts`, and its verb list is
 * enumerated rather than exhaustive, so matching a neighbour is not evidence that a form is allowed.
 */
export const assetWorkflowDe: Record<keyof typeof assetWorkflowEn, string> = {
	'designer.inspector.use-in-plan': 'In einem Plan verwenden',
};
