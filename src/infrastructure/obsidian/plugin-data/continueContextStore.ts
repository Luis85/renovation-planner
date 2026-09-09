import type { Logger } from '../../../application/ports/Logger';
import { parseContinueContext, type ContinueContext } from '../../../application/continueContext';

const CONTINUE_CONTEXT_SCHEMA_VERSION = 1;

/**
 * The surface this store persists through — Obsidian's own `App.loadLocalStorage`/
 * `saveLocalStorage` (`@since 1.8.7`, below this plugin's `minAppVersion` 1.13.0 floor),
 * narrowed to a structural interface so a test can hand a few lines of fake rather than the
 * whole `App` — `TextFileAdapter`'s own reason, one directory over
 * (`SequenceMarkerFileStore.ts`), applied to a second host surface.
 */
export interface LocalStorageAdapter {
	loadLocalStorage(key: string): unknown;
	saveLocalStorage(key: string, data: unknown): void;
}

/**
 * Where the Home surface's Continue context lives — Obsidian's own per-device local storage,
 * and the reasons are §13's Constraint 1 rather than a preference.
 *
 * **Not a project note.** Writing a visit into a note makes merely OPENING a project dirty the
 * vault, and produces a sync conflict between the desk and the site — two devices disagreeing
 * about a fact neither of them was editing.
 *
 * **Not `data.json`'s settings object.** `settingsFrom` is a trust boundary that drops a key
 * this version does not declare, so an outstanding context would be silently discarded by the
 * next settings save.
 *
 * **Not a plugin-local FILE either, which is where the plan this task was cut from put it,
 * reusing `SequenceMarkerFileStore`'s `TextFileAdapter`.** That file sits under the plugin's own
 * manifest directory — inside `.obsidian/`, the vault's configuration tree — and Obsidian Sync
 * can be configured to carry community-plugin settings, so a file there MAY follow the vault to
 * another device and two devices would overwrite each other's last-visit context. The plan's own
 * step 0 asked this question and gave the answer that decides it: "if the typings expose a
 * per-device door … use it and keep the strong guarantee." They do —
 * `App.loadLocalStorage`/`saveLocalStorage` are promised at `minAppVersion` — so this store uses
 * them, restoring the guarantee the plan's fallback code would have narrowed away.
 *
 * **This is why there is no `KeyedQueues` here, where `SequenceMarkerFileStore` one directory
 * over has one.** That store's writes go through Obsidian's async `DataAdapter`, so two writes
 * genuinely interleave and the queue is what keeps the second from landing before the first.
 * `loadLocalStorage`/`saveLocalStorage` are SYNCHRONOUS — the whole call, including the actual
 * mutation, completes before either `read`/`write` here returns control to its caller — so two
 * calls made without awaiting between them (`rememberContinue` opening a project and then a plan
 * inside it, in the same click-to-click sequence) can never interleave: JavaScript runs the first
 * call's synchronous body to completion, INCLUDING its `saveLocalStorage`, before the second call
 * is even reached. A queue serializing calls that cannot race would have nothing to guard and no
 * way to be tested — the two race-condition tests the file-backed design would have needed
 * (a read answered while a write is "in flight", two overlapping writes landing out of order)
 * describe a state this backend cannot enter, since it never yields between "called" and
 * "written".
 *
 * **No door ever rejects.** `read` is awaited by a mount that draws a list either way, and
 * `write` is fire-and-forget from a click handler that discards its promise — so a rejection
 * would be an unhandled rejection reaching nobody, which is the one shape `runDetached` exists
 * to prevent. A context that failed to persist costs a Continue row; it must not cost an error.
 * `loadLocalStorage`/`saveLocalStorage` are not documented to throw, but nothing here assumes
 * that of a host API this plugin does not implement — every door is wrapped, matching
 * `SequenceMarkerFileStore`'s own caution around its adapter.
 */
export class ContinueContextStore {
	constructor(
		private readonly adapter: LocalStorageAdapter,
		private readonly key: string,
		private readonly logger: Logger,
	) {}

	/**
	 * The load-and-parse both `read` and `clear` run, SYNCHRONOUS on purpose: `clear` has to
	 * compare what is stored against what its caller validated and then write, and an `await`
	 * between those two — which `await this.read()` would introduce, since it answers a resolved
	 * promise rather than a value — is a microtask in which a peer `write` lands and is then
	 * deleted. That is the very race the compare exists to close, so the shared body is a value
	 * rather than a promise.
	 */
	private load(): ContinueContext | null {
		const raw = this.adapter.loadLocalStorage(this.key);
		if (
			typeof raw !== 'object' ||
			raw === null ||
			(raw as { schemaVersion?: unknown }).schemaVersion !== CONTINUE_CONTEXT_SCHEMA_VERSION
		) {
			// A version this build does not read is DISCARDED rather than migrated, exactly as a
			// sequence marker is: there is nothing here worth a migration path, and the next
			// write replaces it.
			return null;
		}
		return parseContinueContext((raw as { context?: unknown }).context);
	}

	read(): Promise<ContinueContext | null> {
		// No `await` in any of the three doors: `loadLocalStorage`/`saveLocalStorage` are
		// synchronous, and the whole mutation or read happens before the method returns — the
		// fact this class's own docblock rests its "no queue needed" claim on. Wrapped in
		// `Promise.resolve(...)` rather than declared `async` so that fact stays true of the
		// SOURCE, not only of the signature: `async` would still return before its own body ran
		// past the first `await` it does not have, which is the same guarantee, but oxlint's
		// `require-await` is right that the keyword itself would be decoration here.
		try {
			return Promise.resolve(this.load());
		} catch (cause) {
			this.logger.warn('continue-context.read-failed', { cause });
			return Promise.resolve(null);
		}
	}

	write(context: ContinueContext): Promise<void> {
		try {
			this.adapter.saveLocalStorage(this.key, {
				// An ENVELOPE rather than the bare context, so a future shape has something to
				// branch on instead of having to guess from the fields present.
				schemaVersion: CONTINUE_CONTEXT_SCHEMA_VERSION,
				context,
			});
		} catch (cause) {
			this.logger.warn('continue-context.write-failed', { cause });
		}
		return Promise.resolve();
	}

	/**
	 * Forgets the stored target — a reliably missing project's own remedy (`ViewRoot`'s
	 * `resolveStored`, on `ok(null)` once the index scan has completed), not a general "reset"
	 * door. Same swallow-and-warn shape as `write`, through the same adapter: `saveLocalStorage`
	 * is not documented to throw and this class assumes nothing of a host API it does not
	 * implement, matching `write`'s own caution. ("Not documented" rather than the one-word
	 * spelling, deliberately: `reversibleWritePathDiscovery.test.ts` walks every class whose
	 * file contains the reversal verb as a substring, and the one-word spelling does.)
	 *
	 * **Takes the context the caller VALIDATED and clears only that one.** This store is
	 * process-wide while the resolver deciding a target is stale holds a ticket local to its own
	 * `ViewRoot` instance, so during the `getProject` await another writer — the palette's plan
	 * open, another leaf's detail state, another pane — can record a NEWER target, and an
	 * unconditional write would delete that instead of the stale one. Both fields are compared,
	 * because the same project in a different plan is a different target. A mismatch, or nothing
	 * stored at all, leaves the store untouched and is not a failure: the target this call was
	 * about is already gone.
	 */
	clear(validated: ContinueContext): Promise<void> {
		try {
			// Compare and write in ONE synchronous run. `await this.read()` here would yield a
			// microtask between the two in which a peer `write` lands and is then deleted — see
			// `load`'s own docblock, which is why that body is a value rather than a promise.
			const stored = this.load();
			if (stored !== null && stored.projectId === validated.projectId && stored.planId === validated.planId) {
				this.adapter.saveLocalStorage(this.key, null);
			}
		} catch (cause) {
			this.logger.warn('continue-context.clear-failed', { cause });
		}
		return Promise.resolve();
	}
}
