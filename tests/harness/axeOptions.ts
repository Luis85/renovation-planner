/**
 * The axe run options both accessibility files share, in one module rather than two copies.
 *
 * A second copy is not a style question here: `LAYOUT_DEPENDENT_RULES` names the three rules
 * this suite CANNOT honestly grade (jsdom has no rendering engine, so a contrast or hit-size
 * verdict from it would be a measurement of nothing), and a file that fell out of step with
 * that list would either grade a rule it cannot see or silently stop disabling one. The list
 * is the claim `accessibility.test.ts`'s own header makes about this suite's ceiling, and a
 * claim stated twice is one that disagrees with itself.
 */
import type axe from 'axe-core';

/**
 * The three axe rules that need a layout engine, which jsdom is not.
 *
 * Module-local rather than exported: `runOptions` is the only thing either file needs, and an
 * export with no consumer is what `npm run analyze` gates on — measured, as the finding that
 * failed the gate on the commit that first wrote this file. The header of
 * `accessibility.test.ts` still names this constant, which is prose pointing at a module and
 * costs nothing.
 */
const LAYOUT_DEPENDENT_RULES = ['color-contrast', 'color-contrast-enhanced', 'target-size'];

export const runOptions: Parameters<typeof axe.run>[1] = {
	rules: Object.fromEntries(LAYOUT_DEPENDENT_RULES.map((id) => [id, { enabled: false }])),
};
