import { err, ok } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import type { PlanId } from '../../../domain/plan/PlanId';
import { undoSuperseded, type WriteLedger } from '../../editor/WriteLedger';
import { leftWritesBehind, markUncompensated, type DispatchResult } from '../DispatchOutcome';
import { namedReferenceError, persistenceError } from '../../errors';
import { sameGeometryDocument } from '../spatial/sameGeometryDocument';
import { MaterialCommand } from './MaterialCommand';
import { materialReferents } from './planningLinks';
import { readPlanning, type PlanningDeps } from './materialPlanning';
import { constructionSteps, type ConstructionStep } from './constructionEntries';
import type { RenovationBaseline, RenovationInput, RenovationServices } from './RenovationCommand';

type Step = { execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult> };

/**
 * A renovation write and the construction entries it implies, as ONE history entry (ADR-0031, M1).
 * Each entry step is built from a fresh read, because every step's own write moves a version the next
 * step's compare-and-swap checks. Entry deletions run before the renovation write and new entries
 * after it, so no write ever names an outcome that is not saved. Any refusal after a step has moved —
 * a step's own, a read, a throw, or the rebase — puts back the steps already moved, newest first, so
 * the vault is left as it was and nothing remains to undo; a peer edit to either file answers a
 * refusal. Only a put-back that fails, or a step that already left writes behind, retires the command.
 */
class ConstructionMaterialCommand {
	private readonly done: Step[] = [];
	private retired = false;
	constructor(private readonly deps: PlanningDeps, private readonly base: RenovationServices, private readonly baseline: RenovationBaseline, private readonly input: RenovationInput, private readonly ledger: WriteLedger) {}

	private get planId(): PlanId { return this.baseline.plan.entity.id; }

	async execute(): Promise<DispatchResult> {
		if (this.retired) return this.refusal();
		if (this.done.length) return this.replay(this.done, true);
		let result: DispatchResult;
		try { result = await this.apply(); }
		catch (cause) { result = err(persistenceError('renovation.write-failed', 'The construction material could not be saved.', cause)); }
		return result.ok ? result : this.putBack(result.error, this.done, true);
	}

	undo(): Promise<DispatchResult> {
		return this.retired ? Promise.resolve(this.refusal()) : this.replay(this.done.toReversed(), false);
	}

	private refusal(): DispatchResult {
		return err(markUncompensated(persistenceError('renovation.recovery-required', 'Reopen the floor before editing.')));
	}

	private async apply(): Promise<DispatchResult> {
		const planning = await readPlanning(this.deps, this.planId);
		if (!planning.ok) return planning;
		const steps = constructionSteps(planning.value, this.input.renovation ?? EMPTY_RENOVATION);
		const names = new Map<string, string>(planning.value.catalogue.map(item => [item.asset.id, item.asset.name]));
		const referents = steps.flatMap(step => step.kind === 'delete' ? materialReferents(planning.value.plan.entity.renovation?.depth, step.id, names.get(step.assetId)) : []);
		if (referents.length) return err(namedReferenceError('renovation.construction-referenced', `Still used by ${referents.join(', ')}.`, referents));
		for (const step of steps.filter(item => item.kind === 'delete')) { const result = await this.material(step); if (!result.ok) return result; }
		const renovation = await this.renovation();
		if (!renovation.ok) return renovation;
		for (const step of steps.filter(item => item.kind === 'save')) { const result = await this.material(step); if (!result.ok) return result; }
		return ok('wrote');
	}

	private async replay(steps: readonly Step[], forward: boolean): Promise<DispatchResult> {
		const moved: Step[] = [];
		for (const step of steps) {
			const result = await (forward ? step.execute() : step.undo());
			if (!result.ok) return this.putBack(result.error, moved, forward);
			moved.push(step);
		}
		return ok('wrote');
	}

	/** Moves every step in `moved` back, newest first, and empties it; retires when one cannot be moved back or `error` already left writes behind. */
	private async putBack(error: AppError, moved: Step[], forward: boolean): Promise<DispatchResult> {
		for (const earlier of moved.toReversed()) {
			const back = await (forward ? earlier.undo() : earlier.execute());
			if (!back.ok) { this.retired = true; return err(markUncompensated(error)); }
		}
		moved.length = 0;
		if (leftWritesBehind(error)) this.retired = true;
		return err(error);
	}

	private async move(step: Step): Promise<DispatchResult> {
		const result = await step.execute();
		if (result.ok) this.done.push(step);
		return result;
	}

	private async material(step: ConstructionStep): Promise<DispatchResult> {
		const fresh = await readPlanning(this.deps, this.planId);
		if (!fresh.ok) return fresh;
		const command = new MaterialCommand(this.deps, fresh.value, step.kind === 'delete' ? { deleteId: step.id } : step.input, this.ledger);
		return this.move({ execute: () => command.run(true), undo: () => command.run(false) });
	}

	/**
	 * An entry step writes the requirement note and confirms the SIDECAR, never the plan note, so only
	 * the sidecar version is rebased — onto a fresh read whose document must match the baseline's. The
	 * plan note keeps the baseline's version, and `RenovationCommand`'s own check refuses a peer's edit.
	 */
	private async renovation(): Promise<DispatchResult> {
		let baseline = this.baseline;
		if (this.done.length) {
			const read = await this.base.read(this.planId);
			if (!read.ok) return read;
			if (!sameGeometryDocument(read.value.geometry.document, baseline.geometry.document)) return err(undoSuperseded(this.planId));
			baseline = { ...baseline, geometry: read.value.geometry };
		}
		return this.move(this.base.command(baseline, this.input, this.ledger));
	}
}

/** The renovation services every editor surface uses, with construction entries kept in step (spec §6.5). */
export function constructionAwareRenovation(base: RenovationServices, deps: PlanningDeps): RenovationServices {
	return {
		read: id => base.read(id),
		command: (baseline, input, ledger) => {
			const named = [...baseline.plan.entity.renovation?.subjects ?? [], ...input.renovation?.subjects ?? []].some(item => item.planned?.assetId);
			return named ? new ConstructionMaterialCommand(deps, base, baseline, input, ledger) : base.command(baseline, input, ledger);
		},
	};
}
