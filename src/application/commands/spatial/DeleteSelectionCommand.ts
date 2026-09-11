import { err, ok } from '../../../core/result/Result';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { WriteLedger } from '../../editor/WriteLedger';
import { checkExpectedVersion } from '../../ports/versioning';
import type { DispatchResult } from '../DispatchOutcome';
import type { RenovationBaseline, RenovationServices } from '../renovation/RenovationCommand';
import { restoreSteps, walkSteps, type ComposedStep } from './composedSteps';
import { spatialRemovalInput } from './spatialRemovalInput';

export interface DeleteSelectionDeps {
	deleteRoom(zoneId: ZoneId): ComposedStep;
	readonly renovation: RenovationServices;
	readonly ledger: WriteLedger;
}
/** What the user confirmed: the floor as it was read before the confirmation opened, and what to delete from it. */
export interface DeleteSelectionInput { readonly baseline: RenovationBaseline; readonly roomIds: readonly ZoneId[]; readonly structureIds: readonly string[] }

/**
 * A multi-item Delete as ONE undo step, composed like `PasteCommand` of the commands that already
 * own each write: a `ReversibleDeleteZoneCommand` per Room or Area — each pruning its own boundary
 * and group membership — then one `RenovationCommand` removing the walls, their hosted openings and
 * the elements. That second step reads the floor AFTER the rooms are gone, so its baseline no longer
 * names them; undo walks back newest first, so the walls exist again before a room's boundary is
 * restored onto them.
 */
export class DeleteSelectionCommand {
	/** Set once the first `execute` has written everything; later ones are redos of these. */
	private steps: readonly ComposedStep[] | null = null;
	constructor(private readonly deps: DeleteSelectionDeps, private readonly input: DeleteSelectionInput) {}

	execute(): Promise<DispatchResult> { return this.steps ? walkSteps(this.steps, true) : this.first(); }
	undo(): Promise<DispatchResult> { return walkSteps((this.steps ?? []).toReversed(), false); }

	private async first(): Promise<DispatchResult> {
		const refused = await this.refusal();
		if (refused) return refused;
		const done: ComposedStep[] = [];
		for (const zoneId of this.input.roomIds) {
			const step = this.deps.deleteRoom(zoneId), result = await step.execute();
			if (!result.ok) return restoreSteps(done, false, result.error);
			done.push(step);
		}
		if (this.input.structureIds.length) {
			const baseline = await this.deps.renovation.read(this.input.baseline.plan.entity.id);
			if (!baseline.ok) return restoreSteps(done, false, baseline.error);
			const step = this.deps.renovation.command(baseline.value, spatialRemovalInput(baseline.value, this.input.structureIds).input, this.deps.ledger);
			const result = await step.execute();
			if (!result.ok) return restoreSteps(done, false, result.error);
			done.push(step);
		}
		this.steps = done;
		return ok('wrote');
	}

	/**
	 * Refuses a floor that changed since the confirmed read, before a single room is deleted. The
	 * structure step re-reads the floor once the rooms are gone, so without this an edit another leaf
	 * saved while the confirmation was open would be deleted under consent given for the floor before it.
	 */
	private async refusal(): Promise<DispatchResult | null> {
		const { plan, geometry } = this.input.baseline, current = await this.deps.renovation.read(plan.entity.id);
		if (!current.ok) return err(current.error);
		const conflict = checkExpectedVersion('plan', plan.entity.id, current.value.plan.version, plan.version)
			?? checkExpectedVersion('plan-geometry', plan.entity.id, current.value.geometry.version, geometry.version);
		return conflict ? err(conflict) : null;
	}
}
