import type { Loaded } from '../ports/versioning';
import type { WriteLedger } from './WriteLedger';

/** Observe the consumed version before recording the produced version: peer gaps stay visible. */
export function recordRelatedWrite(ledger: WriteLedger, loaded: Loaded<unknown>): void {
	const receipt = loaded.relatedWrite;
	if (!receipt) return;
	ledger.observe(receipt.id, receipt.before);
	ledger.record(receipt.id, receipt.after);
}
