import { recordRelatedWrite } from '../../editor/recordRelatedWrite';
import { err, ok } from '../../../core/result/Result';
import { undoSuperseded, type WriteLedger } from '../../editor/WriteLedger';
import type { DispatchResult } from '../DispatchOutcome';
import type { RenameZoneCommand, RenameZoneInput } from './RenameZone';

/** One rename, conditional on its baseline first and the shared history tip thereafter. */
export class ReversibleRenameZoneCommand {
	private generation: number | null = null;
	constructor(
		private readonly command: RenameZoneCommand,
		private readonly ledger: WriteLedger,
		private readonly input: RenameZoneInput & { readonly inverse: string },
	) {}

	execute(): Promise<DispatchResult> { return this.dispatch(this.input.name); }
	undo(): Promise<DispatchResult> { return this.dispatch(this.input.inverse); }

	private async dispatch(name: string): Promise<DispatchResult> {
		const { zoneId } = this.input;
		if (this.generation !== null && this.ledger.generation(zoneId) !== this.generation) return err(undoSuperseded(zoneId));
		const expected = this.generation === null ? this.input.expected : this.ledger.lastWritten(zoneId);
		if (expected === null) return err(undoSuperseded(zoneId));
		const result = await this.command.execute({ zoneId, name, expected });
		if (!result.ok) return result;
		if (result.value.outcome === 'wrote') {
			this.generation = this.ledger.observe(zoneId, result.value.before);
			recordRelatedWrite(this.ledger, result.value.zone);
		this.ledger.record(zoneId, result.value.zone.version);
		}
		return ok(result.value.outcome);
	}
}
