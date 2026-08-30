import { describe, expect, it } from 'vitest';

describe('the node default environment', () => {
	/**
	 * The discriminator, and it is the whole point of the case: "the import threw" is
	 * equally true of a mistyped fixture path, a transform error, or a module that fails
	 * for any other reason. A failure assertion is vacuous unless it discriminates the
	 * CAUSE — so this asserts the expected `ReferenceError` for the planted global, not
	 * merely that something went wrong.
	 */
	it('rejects an indirect DOM reach with the ReferenceError for the planted global', async () => {
		await expect(import('../build/fixtures/indirectDom.fixture')).rejects.toThrow(ReferenceError);
		await expect(import('../build/fixtures/indirectDom.fixture')).rejects.toThrow(/document/u);
	});
});
