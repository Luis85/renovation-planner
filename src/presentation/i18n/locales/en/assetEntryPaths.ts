/**
 * The asset designer's CREATION vocabulary (AD07): the empty state's three entry paths, the
 * preset gallery's search and previews, and what the measurement-first dialog says.
 *
 * Its own module rather than more of `assetSymbols.ts` so that AD07, AD08's marquee and AD10's
 * arrange actions can be authored at the same time without three workers appending to one table
 * — the integration hazard AD01 §2 names. Spread into `en/editor.ts` beside `assetSymbolsEn`.
 */
export const assetEntryPathsEn = {} as const;
