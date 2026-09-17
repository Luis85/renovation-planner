/**
 * The asset designer vocabulary for the library-designer-plan workflow: Use in plan, the plan picker, Edit shared asset and the return path (AD13).
 * Spread into `en/editor.ts`.
 *
 * **Created EMPTY by the integrator, before AD13 navigation half was dispatched.** Every locale module and both
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
export const assetWorkflowEn = {
	/**
	 * The designer's hand-off into a plan (AD13). The label names the WORKFLOW rather than the
	 * single step this build performs — see `DesignerUsePlan.vue`, whose docblock states exactly
	 * how far the gesture currently reaches and what is owed to finish it.
	 */
	'designer.inspector.use-in-plan': 'Use in plan',
} as const;
