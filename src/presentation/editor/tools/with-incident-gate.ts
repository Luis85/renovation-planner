import { err } from '../../../core/result/Result';
import { activeWriteIncidentRegistry } from '../../../application/incidents/WriteIncidentRegistry';
import { writesPausedRefusal } from '../../../application/errors/guardAgainstThrowing';
import type { RefreshedHistory } from './with-state-refresh';

/** The live read. Module scope because it closes over nothing — the registry is a module global. */
function paused(): boolean {
	return activeWriteIncidentRegistry()?.anyOpen() ?? false;
}

/**
 * The vault-pause gate on UNDO and REDO, asking the registry LIVE at every dispatch
 * (BP-02, tracker limitation L-16).
 *
 * **Why this cannot be done with the save-state store, which is what the first attempt did.**
 * `saveState.unrecoveredWrite` is `leafOwn || vaultPaused`, and `vaultPaused` is seeded from
 * `activeWriteIncidentRegistry()?.anyOpen()` ONCE, while the store is being created. It is set
 * afterwards only by `withSaveStateTracking`, on this leaf's own next refusal. Measured rather
 * than reasoned, with a probe asserting a sentinel so the values print: a store built while an
 * incident is open reads `unrecoveredWrite: true`, and a store built clean reads `false` both
 * before AND after an incident is opened behind it. So a gate whose predicate reads the store
 * refuses only a leaf that MOUNTED into a paused vault, or one that has since tried a write of
 * its own and been refused — and the sequence L-16 actually names is neither: a gesture lands,
 * a peer leaf half-writes the vault, the user reaches straight for Undo. That undo has no
 * intervening write to catch up on, and the store is still answering `false`.
 *
 * This decorator asks the registry itself, at the moment of the dispatch, which is the same
 * read `guardCommand` performs per command. It is the only predicate in the chain that can be
 * right about an incident that opened after the leaf was built.
 *
 * **Why the gate has to be HERE and cannot be underneath.** An inverse dispatches no command:
 * `ReversibleAssetDesignCommands` and the zone adapters write their captured snapshot back
 * through the RAW `assets.save` / `sidecar.write` / zone ports, none of which passes
 * `guardCommand`. `tests/presentation/designer/designerIncidentRefusal.test.ts` measures that
 * at the adapter level and still does — an inverse called DIRECTLY still reaches the ports, and
 * what this decorator gates is the dispatcher every production caller goes through.
 *
 * **`run` is deliberately untouched.** A forward write is already refused at every guarded
 * door beneath, with the same code, so gating it twice would put a second authority on a
 * question `guardCommand` already answers. The stale gate beside this one owns the separate
 * question of a failed read-back.
 *
 * **The AFFORDANCE is not this decorator's, and that split is deliberate rather than an
 * oversight.** `canUndo`/`canRedo` stay gated on the store, because they are `computed` and a
 * bare registry call inside one would be read once and cached until some reactive dependency
 * happened to change — a button that lies in whichever direction the last invalidation left it.
 * So the buttons catch up the way everything else in L-14 catches up, and the DISPATCHER is
 * what refuses regardless. A user can therefore still press an enabled Undo into a paused
 * vault; what they cannot do is have it land.
 */
export function withIncidentGate(dispatcher: RefreshedHistory): RefreshedHistory {
	return {
		run: (command) => dispatcher.run(command),
		undo: () => (paused() ? Promise.resolve(err(writesPausedRefusal())) : dispatcher.undo()),
		redo: () => (paused() ? Promise.resolve(err(writesPausedRefusal())) : dispatcher.redo()),
	};
}
