import { describe, expect, it } from 'vitest';

describe('the node default environment', () => {
	/**
	 * The discriminator, and it is the whole point of the case: "the import threw" is
	 * equally true of a mistyped fixture path, a transform error, or a module that fails
	 * for any other reason. A failure assertion is vacuous unless it discriminates the
	 * CAUSE — so this asserts the expected `ReferenceError` for the planted global, not
	 * merely that something went wrong.
	 *
	 * The fixture itself names no DOM global — it imports `domGlobalReach.fixture.ts` and
	 * calls what that module exports, so the reach this test is proving the node default
	 * catches is genuinely TRANSITIVE: it is invisible to a per-file `no-restricted-imports`
	 * rule not because it is wrapped in a same-file helper (that would cross no module
	 * boundary and would be equally visible to such a rule as an inline reach), but because
	 * seeing it requires following an import into a different module and reading THAT
	 * module's body.
	 */
	it('rejects an indirect DOM reach with the ReferenceError for the planted global', async () => {
		await expect(import('../build/fixtures/indirectDom.fixture')).rejects.toThrow(ReferenceError);
		await expect(import('../build/fixtures/indirectDom.fixture')).rejects.toThrow(/document/u);
	});
});
