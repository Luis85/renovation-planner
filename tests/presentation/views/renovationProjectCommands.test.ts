/**
 * The Renovation Project view's write side when the composition root could not compose.
 *
 * `unavailableRenovationProjectCommands()` is the ONE entry in this bundle's widening that
 * nothing makes a compile error: the interface being required turns the declaration and the
 * root's binding into build failures, so a member forgotten there cannot ship — while a member
 * forgotten HERE compiles, runs, and refuses under whatever the next reader happens to write.
 * That is why every door is asserted rather than the two this increment added.
 *
 * `settings.unrecovered` on all four, from ONE refusal function, so the shared code cannot drift
 * into two spellings of one state.
 */
import { describe, expect, it } from 'vitest';
import {
	unavailableRenovationProjectCommands,
	type RenovationProjectCommandServices,
} from '../../../src/presentation/views/renovationProjectCommands';
import { isErr, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';

/**
 * Every command member, by name. A hand-written list is exactly what this file's own header
 * warns about, so it is derived from the bundle instead: `logger` is the one member that is not
 * a command, and dropping it by shape rather than by name means a fifth command added to the
 * interface is driven here on the day it is written.
 */
function commandKeys(bundle: RenovationProjectCommandServices): string[] {
	return Object.entries(bundle)
		.filter(([, value]) => typeof (value as { execute?: unknown }).execute === 'function')
		.map(([key]) => key);
}

describe('unavailableRenovationProjectCommands', () => {
	it('offers a refusing door for every command the interface declares', () => {
		expect(commandKeys(unavailableRenovationProjectCommands()).toSorted()).toEqual([
			'clearAssetPriceOverride',
			'createPlan',
			'createProject',
			'setAssetPriceOverride',
		]);
	});

	it.each(['createProject', 'createPlan', 'setAssetPriceOverride', 'clearAssetPriceOverride'] as const)(
		'refuses %s with the unrecovered-settings code',
		async (member) => {
			const bundle = unavailableRenovationProjectCommands();
			// The input is never read on this path — every door refuses before looking — so an
			// empty object is the honest fixture rather than a hand-built one that would imply it
			// mattered.
			const result = await (
				bundle[member] as { execute(input: never): Promise<Result<never, AppError>> }
			).execute({} as never);

			expect(isErr(result) && result.error.code).toBe('settings.unrecovered');
		},
	);

	/**
	 * The logger records nothing, exactly as `unavailablePlanEditorCommands`'s does: this
	 * bundle's only failure is a resolved `Result` rather than a fault, so there is nothing here
	 * for a real logger to be told about. Driven so the four members are not an unreached shape.
	 */
	it('carries a logger that records nothing', () => {
		const { logger } = unavailableRenovationProjectCommands();

		expect(() => {
			logger.debug('d');
			logger.info('i');
			logger.warn('w');
			logger.error('e');
		}).not.toThrow();
	});
});
