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

/**
 * A describe-level case budget for a block whose every case is a cold mount or transform,
 * one or more `settleUntil` waits (each keeping its own 4s `SETTLE_BUDGET_MS` deadline and
 * its own named failure text — see `tests/helpers/settle.ts`), and a full axe scan — three
 * costs that together can exceed vitest's 5000ms default under load even though no single
 * wait is slow.
 *
 * Originally local to `accessibility.test.ts`'s harness-index block (cold Vite transform +
 * settle + scan, worst entry 930ms quiet, timed out on `verify (windows-latest, 22)` at
 * `environment 296.94s` contention). `structureJourney.test.ts`'s mounted-editor journey
 * (14 settles + a full-editor axe scan, measured 8.9s under coverage + 22-way contention)
 * shares the exact shape, moved here per that file's own "a third file" rule alongside
 * `areaCreation.test.ts`, `roomNaming.test.ts` and `roomResize.test.ts` — every file with
 * this shape already imports `runOptions` from this module, so importing this constant too
 * costs nothing new.
 *
 * **Raising it blinds nothing**: each `settleUntil` still fails first, by name, at its own
 * 4s deadline — this only bounds the SUM, deliberately far above the worst sum measured so
 * far (8.9s + 4s ≈ 13s) so a contended runner cannot reach it. Applied to the BLOCK, not to
 * individual cases, so a case added later inherits it instead of rediscovering this.
 */
export const HARNESS_SCAN_MS = 30_000;
