import { err, ok } from '../../../core/result/Result';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { sameRenovation } from '../../../domain/renovation/sameRenovation';
import type { PlanId } from '../../../domain/plan/PlanId';
import { undoSuperseded, type WriteLedger } from '../../editor/WriteLedger';
import { markUncompensated, type DispatchResult } from '../DispatchOutcome';
import { referenceError } from '../../errors';
import { sameGeometryDocument } from '../spatial/sameGeometryDocument';
import { MaterialCommand } from './MaterialCommand';
import { materialReferents } from './planningLinks';
import { readPlanning, type PlanningDeps } from './materialPlanning';
import { constructionSteps, type ConstructionStep } from './constructionEntries';
import type { RenovationBaseline, RenovationInput, RenovationServices } from './RenovationCommand';

type Step = { execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult> };

/**
 * A renovation write and the construction entries it implies, as ONE history entry (ADR-0031, M1).
 * Each step is built from a fresh read, because every step's own write moves a version the next
 * step's compare-and-swap checks. Entry deletions run before the renovation write and new entries
 * after it, so no write ever names an outcome that is not saved. Undo and redo run the same steps,
 * each conditional on its own version, and a refusal part-way puts back the steps that pass already
 * moved — so a peer edit to either file answers `undo.superseded` with the vault left as it was,
 * and only a put-back that fails leaves writes behind and retires the command.
 */
class ConstructionMaterialCommand {
	private readonly done: Step[] = [];
	private retired = false;
	constructor(private readonly deps: PlanningDeps, private readonly base: RenovationServices, private readonly baseline: RenovationBaseline, private readonly input: RenovationInput, private readonly ledger: WriteLedger) {}

	private get planId(): PlanId { return this.baseline.plan.entity.id; }

	async execute(): Promise<DispatchResult> {
		if (this.retired) return this.refusal();
		if (this.done.length) return this.replay(this.done, true);
		const planning = await readPlanning(this.deps, this.planId);
		if (!planning.ok) return planning;
		const steps = constructionSteps(planning.value, this.input.renovation ?? EMPTY_RENOVATION);
		const referents = steps.flatMap(step => step.kind === 'delete' ? materialReferents(planning.value.plan.entity.renovation?.depth, step.id) : []);
		if (referents.length) return err(referenceError('renovation.construction-referenced', `Still used by ${referents.join(', ')}.`));
		for (const step of steps.filter(item => item.kind === 'delete')) { const result = await this.material(step); if (!result.ok) return result; }
		const renovation = await this.renovation();
		if (!renovation.ok) return renovation;
		for (const step of steps.filter(item => item.kind === 'save')) { const result = await this.material(step); if (!result.ok) return result; }
		return ok('wrote');
	}

	undo(): Promise<DispatchResult> {
		return this.retired ? Promise.resolve(this.refusal()) : this.replay(this.done.toReversed(), false);
	}

	private refusal(): DispatchResult {
		return err(markUncompensated(undoSuperseded(this.planId)));
	}

	private async replay(steps: readonly Step[], forward: boolean): Promise<DispatchResult> {
		const moved: Step[] = [];
		for (const step of steps) { const result = await this.advance(step, forward, moved); if (!result.ok) return result; }
		return ok('wrote');
	}

	/** Moves one step; on failure moves every step in `moved` back, newest first, and retires when one cannot be. */
	private async advance(step: Step, forward: boolean, moved: Step[]): Promise<DispatchResult> {
		const result = await (forward ? step.execute() : step.undo());
		if (result.ok) { moved.push(step); return result; }
		for (const earlier of moved.toReversed()) {
			const back = await (forward ? earlier.undo() : earlier.execute());
			if (!back.ok) { this.retired = true; return err(markUncompensated(result.error)); }
		}
		moved.length = 0;
		return result;
	}

	private async material(step: ConstructionStep): Promise<DispatchResult> {
		const fresh = await readPlanning(this.deps, this.planId);
		if (!fresh.ok) return fresh;
		const command = new MaterialCommand(this.deps, fresh.value, step.kind === 'delete' ? { deleteId: step.id } : step.input, this.ledger);
		return this.advance({ execute: () => command.run(true), undo: () => command.run(false) }, true, this.done);
	}

	/** Rebased onto a fresh read when an earlier step moved the sidecar version, refusing if the content moved too. */
	private async renovation(): Promise<DispatchResult> {
		let baseline = this.baseline;
		if (this.done.length) {
			const read = await this.base.read(this.planId);
			if (!read.ok) return read;
			if (!sameRenovation(read.value.plan.entity.renovation, baseline.plan.entity.renovation) || !sameGeometryDocument(read.value.geometry.document, baseline.geometry.document)) return err(undoSuperseded(this.planId));
			baseline = read.value;
		}
		return this.advance(this.base.command(baseline, this.input, this.ledger), true, this.done);
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
