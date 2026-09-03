/**
 * The Renovation Project view's write side when the composition root could not compose.
 *
 * **A member forgotten HERE is a build failure, and an earlier draft of this header said the
 * opposite.** `unavailableRenovationProjectCommands` annotates its return type, so the object
 * literal is checked against `RenovationProjectCommandServices` like any other — measured, not
 * reasoned: deleting the `createAsset` member reports `TS2741: Property 'createAsset' is
 * missing in type … but required in type 'RenovationProjectCommandServices'`. The bundle's own
 * docblock names the real hazard and this file had widened it: a door that is PRESENT and
 * refuses WRONGLY — under a second spelling of `settings.unrecovered`, or with a code that
 * sends the user somewhere else. "Can refuse wrongly" is not "can be missing", and only the
 * first of those needs a test.
 *
 * So what this file protects is the REFUSAL, which no type can hold: `settings.unrecovered` on
 * every door, from ONE `persistenceFailure()`, so the shared code cannot drift into two
 * spellings of one state.
 *
 * **The exact key set is asserted for a different reason than the one previously claimed here.**
 * It is not what caught the asset designer's two new doors at the merge — nothing needed
 * catching, because the merge kept both sides' additions and the compiler was standing behind
 * it either way. It is asserted so that a door added to the interface is DRIVEN through the
 * refusal cases below on the day it is written, rather than compiling as a present member whose
 * refusal nobody has checked. `commandKeys` derives the list from the bundle by SHAPE, so that
 * happens without anyone maintaining a second list.
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
 * a command, and dropping it by shape rather than by name means the next command added to the
 * interface is driven here on the day it is written. `defaultCurrency` is dropped by the same
 * shape test, being a branded string rather than a door.
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
			'createAsset',
			'createPlan',
			'createProject',
			'setAssetFootprintFromDimensions',
			'setAssetPriceOverride',
		]);
	});

	it.each([
		'createProject',
		'createPlan',
		'setAssetPriceOverride',
		'clearAssetPriceOverride',
		'createAsset',
		'setAssetFootprintFromDimensions',
	] as const)(
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
