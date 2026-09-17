/**
 * The asset designer vocabulary for duplicating a definition and showing which plans use one before an impactful change (AD13).
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
 */
export const assetDuplicateEn = {} as const;
