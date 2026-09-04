import type { Logger } from '../application/ports/Logger';
import { notifyFault } from '../presentation/notices/notify';

/**
 * Run a promise NOBODY is awaiting, and make sure a fault in it still reaches both surfaces.
 *
 * Obsidian's `addRibbonIcon`, `addCommand` and `FuzzySuggestModal` all take handlers that
 * return nothing, so every activation this plugin starts from a click is detached by
 * construction. Four such doors spelled that as a bare `void`, under a comment at two of them
 * calling the missing rejection handler deliberate — "the explicit void is what says the
 * rejection is unhandled on purpose here rather than by omission". Measured against what the
 * rest of the plugin does with the same class of failure, that does not hold: the composition
 * root gives the sibling workspace operation (`openProjectNote`) exactly this treatment
 * through the fault door it hands it,
 * and slice 11's whole argument is that a failure owes a terse user sentence AND a log line
 * carrying the cause. A `void`ed rejection owes neither, so a ribbon click that faulted opened
 * nothing, said nothing and recorded nothing — the failure mode CLAUDE.md already records
 * `recoverInterruptedSequences` paying for, at the four entry points no guard wraps.
 *
 * **The handling belongs to this function rather than to the call sites**, which is the
 * same rule that put the coalescing inside `revealCandidate`: a further door would otherwise
 * have to remember a `.catch` that nothing checks.
 *
 * **PRE-EXISTING CORRECTION — this said "It is down to ONE caller", and it was already false
 * on `main`.** Re-derived rather than adjusted: `grep -rn "runDetached(" src/` outside this
 * module's own file prints **six** lines, of which **five** are call expressions and one is a
 * comment in `DiagnosticsReportModal.ts` quoting the call it does NOT make. The five are
 * `RenovationPlannerPlugin`'s `new-project` and its diagnostics report, `sampleProject`'s seed,
 * `SettingsTab`'s library move, and `DiagnosticsReportModal`'s clipboard write — four files.
 * The same grep on `origin/main` prints four call expressions, so this branch added the fifth
 * (`new-project`) and inherited a sentence that had been wrong since the round that wrote it.
 *
 * **What the sentence was reaching for is still true and is the part worth keeping**: the two
 * ACTIVATION doors moved their answering INTO `revealCandidate`, because catching at the call
 * site is catching per CLICK and a coalesced activation has more clicks than failures — two
 * notices and two identical log lines for one failed double click, which is the defect a review
 * round found. Every caller that remains wraps a whole OPERATION rather than a coalesced one,
 * so per-call is per-operation and this is still the right door for each. A bare `void` beside
 * a promise that CAN reject is still the thing this exists to refuse; what changed is that
 * `revealView` and `revealPlanEditor` no longer can.
 *
 * A count is a fact about the tree at the moment of the grep, so re-run it rather than trusting
 * this number — what does not go stale is the rule under it.
 *
 * `notifyFault` maps ONCE for both halves (SDD §66), so the sentence the user reads and the
 * line the log carries cannot drift. The `event` is the caller's, for the reason
 * `guardCommand` takes one: it says which door faulted.
 *
 * It returns `void` deliberately — the caller has nothing to do with the result, and handing
 * one back would invite a caller to await a promise whose failure has already been answered.
 */
export function runDetached(operation: Promise<unknown>, logger: Logger, event: string): void {
	void operation.catch((cause: unknown) => {
		notifyFault(cause, logger, event);
	});
}
