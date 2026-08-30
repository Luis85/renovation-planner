import type { AppError, PersistenceError } from '../../core/errors/AppError';
import { markTechnicalFault, type TechnicalFault } from '../../core/errors/technical-fault';

/**
 * The Error Boundary's mapping function (SDD §66): turn a thrown Infrastructure
 * exception into one of slice 2's typed errors, which is the ONLY way an exception
 * crosses into the `Result` world. Application commands and queries are the mapping
 * point; past them nothing throws.
 *
 * Mappers are ONE PER Infrastructure adapter, each narrowing to the smallest correct
 * `AppError` variant — not a single catch-all switch. Each adapter's mapper is typed by
 * ITS narrowest return (`VaultExceptionMapper` below), which is what lets the guards'
 * signatures demand a mapper whose output their guarded contracts can actually carry;
 * `ExceptionMapper` stays as the general vocabulary. A future import or geometry
 * adapter adds its own beside these rather than growing this file into a dispatcher.
 *
 * **The `& TechnicalFault` in the return type is load-bearing and is a category check
 * rather than a convention.** By the time an `AppError` reaches Presentation, a mapped
 * fault and a refusal a command RETURNED are the same shape, and design slice 17 routes
 * them to different surfaces — so the difference has to be recorded here, at the last step
 * that still knows which one it is holding. Declaring it on the mapper TYPE means a future
 * geometry or import mapper that forgets fails `vue-tsc` at its own `return`; a rule kept
 * by remembering to call `markTechnicalFault` was kept at one of its two sites and missed
 * the one every guarded command goes through. `core/errors/technical-fault.ts` has that
 * account in full.
 */
export type ExceptionMapper = (cause: unknown) => AppError & TechnicalFault;

/**
 * The vault adapter's mapper shape. Extends the general vocabulary with its narrowest
 * true return, which is what lets the guards' signatures demand a mapper whose output
 * their guarded contracts can actually carry.
 */
export interface VaultExceptionMapper extends ExceptionMapper {
	(cause: unknown): PersistenceError & TechnicalFault;
}

/**
 * The vault adapter's mapper. Everything the Obsidian Vault surface can throw that its
 * repositories have not already caught as an expected, coded failure is, by
 * elimination, an unexpected I/O fault: it maps to `PersistenceError`, the narrowest
 * category that is still true. The original exception rides on `cause` for the log
 * line the mapping step writes (SDD §67); the user-facing copy comes from the locale
 * tables keyed by `code` and never from `message`, which here is whatever the engine
 * chose to say.
 *
 * The `markTechnicalFault` is what discharges the type obligation above — this function is
 * only ever reached from a `catch`, so everything it returns is by construction a fault.
 */
export function createVaultExceptionMapper(scope: string): VaultExceptionMapper {
	return (cause) =>
		markTechnicalFault({
			category: 'Persistence',
			code: `${scope}.unexpected-failure`,
			message: cause instanceof Error ? cause.message : String(cause),
			cause,
		});
}
