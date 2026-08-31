import type { ExceptionMapper, VaultExceptionMapper } from '../../../src/application/errors/exceptionMapper';
import { createVaultExceptionMapper } from '../../../src/application/errors/exceptionMapper';
import { markTechnicalFault } from '../../../src/core/errors/technical-fault';

/**
 * The technical-fault stamp is an obligation on the mapper's TYPE, and this file is the proof.
 *
 * **Why it has to be a compile-time one.** The claim is "every `AppError` minted from a thrown
 * cause carries the stamp", and that is a claim about mappers not yet written — the exact shape
 * `CLAUDE.md` says cannot be checked by driving the paths somebody thought of. A runtime test
 * can only assert that today's one mapper stamps; a future geometry or import mapper that
 * forgot would sail past it, and its faults would reach Presentation looking like refusals a
 * command had chosen to return.
 *
 * That is not hypothetical. It is precisely what happened with the rule in its previous,
 * remembered form: the stamp was applied by hand in `faultError`, under a docblock calling that
 * "the single site where a thrown cause becomes an `AppError`", and `guardAgainstThrowing.ts`'s
 * catch — the site EVERY guarded command and query goes through — was the one it missed. A
 * repository exception under a dispatched editor command was therefore routed as an ordinary
 * save-affecting refusal: the save indicator raised its badge, the toast was suppressed as a
 * double-report, and the mapped sentence reached nobody.
 *
 * In `tsconfig.json`'s `include` for that reason — an unsatisfied `@ts-expect-error` is itself
 * a build error, so a widening of `ExceptionMapper` back to a bare `AppError` fails at the
 * directive that no longer has anything to suppress. Outside that list this file would be a
 * comment.
 */

// An unstamped mapper is refused, which is the whole guarantee.
// @ts-expect-error a mapper returning a bare `AppError` does not satisfy the fault obligation
const unstamped: ExceptionMapper = (cause) => ({
	category: 'Persistence',
	code: 'vault.unexpected-failure',
	message: String(cause),
});

// And so is one narrowed to the vault's own shape but still unstamped.
//
// **The obligation is held here TWICE, which was measured rather than assumed** — and the first
// draft of this comment asserted the opposite, that the two declarations were independent and
// that widening one would leave the other open. Both mutations were run. Widening
// `ExceptionMapper` back to a bare `AppError` unsatisfies the directive above and leaves this
// one biting, because `VaultExceptionMapper` restates the obligation in its own call signature.
// Widening only that call signature changes nothing at all, because the interface EXTENDS
// `ExceptionMapper` and inherits its stamped signature. So both would have to be widened
// together, and this directive is the one that says so.
// @ts-expect-error the vault mapper carries the same obligation as the general one
const unstampedVault: VaultExceptionMapper = (cause) => ({
	category: 'Persistence',
	code: 'vault.unexpected-failure',
	message: String(cause),
});

// A stamped one compiles. Asserted because a proof made only of refusals is equally satisfied
// by a type nothing at all can inhabit.
const stamped: ExceptionMapper = (cause) =>
	markTechnicalFault({
		category: 'Persistence',
		code: 'geometry.unexpected-failure',
		message: String(cause),
	});

// And the shipped mapper satisfies BOTH — the narrow contract the guards demand and the general
// vocabulary — so the widening above is proven not to have narrowed what already existed.
const shippedAsVault: VaultExceptionMapper = createVaultExceptionMapper('vault');
const shippedAsGeneral: ExceptionMapper = createVaultExceptionMapper('vault');

export type { ExceptionMapper };
export const declarations = [unstamped, unstampedVault, stamped, shippedAsVault, shippedAsGeneral];
