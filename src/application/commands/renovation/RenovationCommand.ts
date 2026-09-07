import { withPlanRenovation, withPlanSpatialElements } from '../../../domain/plan/Plan';
import { sameRenovation } from '../../../domain/renovation/sameRenovation';
import { sameElementMetadata, validElementMetadataLinks } from '../../../domain/spatial/SpatialElement';
import { planError } from '../../../domain/plan/Plan.errors';
import type { AppError } from '../../../core/errors/AppError';
import type { EventBus } from '../../../core/events/EventBus';
import type { EntityId } from '../../../core/identity/EntityId';
import { err, ok, type Result } from '../../../core/result/Result';
import type { Plan } from '../../../domain/plan/Plan';
import type { PlanId } from '../../../domain/plan/PlanId';
import { EMPTY_RENOVATION, validateRenovation, type Renovation } from '../../../domain/renovation/Renovation';
import { validateRenovationTargets } from '../../../domain/renovation/renovationTargets';
import { validateStructure } from '../../../domain/spatial/structureGeometry';
import type { PlanRepository } from '../../ports/PlanRepository';
import type { PlanGeometrySidecar, PlanGeometrySnapshot, PlanGeometryDocument } from '../../ports/PlanGeometrySidecar';
import { checkExpectedVersion, type Loaded } from '../../ports/versioning';
import { undoSuperseded, type WriteLedger } from '../../editor/WriteLedger';
import { markUncompensated, type DispatchResult } from '../DispatchOutcome';
import { loadPlan } from '../plan/loadPlan';
import { sameGeometryDocument } from '../spatial/sameGeometryDocument';
import { persistenceError } from '../../errors';

export interface RenovationBaseline {
	readonly plan: Loaded<Plan>;
	readonly geometry: PlanGeometrySnapshot;
}
export interface RenovationInput {
	readonly spatial?: { readonly structure: PlanGeometryDocument['structure']; readonly metadata: Plan['spatialElements'] };
	readonly renovation: Renovation;
	readonly intended: PlanGeometryDocument['intended'];
}
export interface RenovationServices {
	read(id: PlanId): Promise<Result<RenovationBaseline, AppError>>;
	command(baseline: RenovationBaseline, input: RenovationInput, ledger: WriteLedger): { execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult> };
}
type CheckLinks = (plan: Plan, document: PlanGeometryDocument) => Promise<Result<void, AppError>>;
interface Dependencies { plans: PlanRepository; geometry: PlanGeometrySidecar; events: EventBus; checkLinks?: CheckLinks }

export function validateRenovationInput(renovation: Renovation, document: PlanGeometryDocument): Result<void, AppError> {
	const valid = validateRenovation(renovation);
	if (!valid.ok) return valid;
	const roomIds = document.objects.map(item => item.id);
	const targets = validateRenovationTargets(renovation, { ...document, roomIds });
	if (!targets.ok) return targets;
	for (const candidate of [document.structure, document.intended]) {
		if (!candidate) continue;
		const structure = validateStructure(candidate, roomIds);
		if (!structure.ok) return structure;
	}
	return ok(undefined);
}

async function readBaseline(deps: Pick<Dependencies, 'plans' | 'geometry'>, id: PlanId): Promise<Result<RenovationBaseline, AppError>> {
 const plan = await loadPlan(deps.plans, id);
 if (!plan.ok) return plan;
 const snapshot = await deps.geometry.read(id);
 return snapshot.ok ? ok({ plan: plan.value, geometry: snapshot.value }) : snapshot;
}
class RenovationCommand {
	private current: RenovationBaseline;
	private applied = false;
	private busy = false;
	private retired = false;
	private generation: number | null = null;
	private readonly key: EntityId<string>;
	constructor(private readonly deps: Dependencies, private readonly baseline: RenovationBaseline, private readonly input: RenovationInput, private readonly ledger: WriteLedger) {
		this.current = baseline;
		this.key = `renovation:${baseline.plan.entity.id}` as EntityId<string>;
	}
	execute(): Promise<DispatchResult> { return this.run(true); }
	undo(): Promise<DispatchResult> { return this.run(false); }
	private async run(forward: boolean): Promise<DispatchResult> {
		const refusal = this.refusal(forward);
		if (refusal) return refusal;
		this.busy = true;
		try {
			return await this.checkedApply(forward);
		} catch (cause) { return err(persistenceError('renovation.write-failed', 'The renovation operation failed.', cause)); }
		finally { this.busy = false; }
	}
	private refusal(forward: boolean): DispatchResult | null {
		if (this.retired) return err(markUncompensated(persistenceError('renovation.recovery-required', 'Reopen the floor before editing.')));
		if (this.applied === forward) return ok('no-write');
		if (this.busy) return ok('no-write');
		return null;
	}

	private async checkedApply(forward: boolean): Promise<DispatchResult> {
		const checked = await this.check();
		return checked.ok ? this.apply(forward) : checked;
	}

	private async apply(forward: boolean): Promise<DispatchResult> {
			const renovation = forward ? this.input.renovation : this.baseline.plan.entity.renovation;
			const owner: Plan = this.current.plan.entity;
			const changed = withPlanRenovation(owner, renovation);
			if (!changed.ok) return changed;
			const plan = this.input.spatial ? withPlanSpatialElements(changed.value, forward ? this.input.spatial.metadata : this.baseline.plan.entity.spatialElements) : changed;
			if (!plan.ok) return plan;
			const document = this.proposedGeometry(forward);
			if (!validElementMetadataLinks(plan.value.spatialElements, [document.structure?.elements, document.intended?.elements])) return err(planError('invalid-spatial-elements', 'Element metadata and geometry must identify the same elements.'));
			const valid = validateRenovationInput(renovation ?? EMPTY_RENOVATION, document);
			if (!valid.ok) return valid;
			const links = await this.deps.checkLinks?.(plan.value, document);
			if (links && !links.ok) return links;
			const result = await this.write(plan.value, document);
			if (!result.ok) return result;
			this.applied = forward;
			await this.deps.events.publish({ type: 'PlanRenovationChanged', payload: { planId: plan.value.id, projectId: plan.value.projectId } });
			return result;
	}

	private proposedGeometry(forward: boolean): PlanGeometryDocument {
		return { ...this.current.geometry.document, intended: forward ? this.input.intended : this.baseline.geometry.document.intended,
			...(this.input.spatial ? { structure: forward ? this.input.spatial.structure : this.baseline.geometry.document.structure } : {}) };
	}

	private async check(): Promise<DispatchResult> {
		const id = this.baseline.plan.entity.id;
		const read = await readBaseline(this.deps, id);
		if (!read.ok) return read;
		const { plan, geometry } = read.value;
		if (this.generation === null) {
			const conflict = checkExpectedVersion('plan', id, plan.version, this.current.plan.version) ?? checkExpectedVersion('plan-geometry', id, geometry.version, this.current.geometry.version);
			if (conflict) return err(conflict);
			this.generation = this.ledger.observe(this.key, plan.version);
		} else {
			const generation = this.ledger.observe(this.key, plan.version);
			if (generation !== this.generation || !sameRenovation(plan.entity.renovation, this.current.plan.entity.renovation) || !sameElementMetadata(plan.entity.spatialElements, this.current.plan.entity.spatialElements) || !sameGeometryDocument(geometry.document, this.current.geometry.document)) return err(undoSuperseded(id));
		}
		this.current = { plan: plan, geometry: geometry };
		return ok('no-write');
	}
	private remember(plan: Loaded<Plan>, geometry: PlanGeometrySnapshot): void {
		this.current = { plan, geometry };
		this.ledger.record(this.key, plan.version);
	}

	private async writeGeometry(id: PlanId, document: PlanGeometryDocument) {
		try { return await this.deps.geometry.write(id, document, this.current.geometry.version); }
		catch (cause) { return err(persistenceError('renovation.write-failed', 'Intended geometry could not be saved.', cause)); }
	}

	private async write(plan: Plan, document: PlanGeometryDocument): Promise<DispatchResult> {
		const saved = await this.deps.plans.save(plan, this.current.plan.version);
		if (!saved.ok) return saved;
		// The sidecar is written even when `document` is byte-identical to what check() read.
		// That write is a compare-and-swap against the version check() observed, under the
		// store's plan lock, and it is the only thing that orders this save against a peer's
		// Room deletion: the store's deletion guard reads the Plan note, so a deletion that
		// slipped in after check() read a Plan with no renovation and went through — and a
		// metadata-only save that skipped the sidecar left the record pointing at deleted
		// geometry (PR #87). Now that deletion moves the version, the CAS refuses, and the
		// restore below takes the metadata back; a deletion queued after it reads the saved
		// renovation and is refused by the guard instead.
		const written = await this.writeGeometry(plan.id, document);
		if (!written.ok) {
			let restored;
			try { restored = await this.deps.plans.save(this.current.plan.entity, saved.value.version); }
			catch (cause) { restored = err(persistenceError('renovation.restore-failed', 'Metadata could not be restored.', cause)); }
			if (!restored.ok) {
				this.retired = true;
				return err(markUncompensated(persistenceError('renovation.compensation-failed', 'Renovation recovery failed.', restored.error)));
			}
			this.remember(restored.value, this.current.geometry);
			return written;
		}
		this.ledger.observe(plan.id, this.current.geometry.version);
		this.remember(saved.value, { document, version: written.value });
		this.ledger.record(plan.id, written.value);
		return ok('wrote');
	}
}


export function renovationServices(plans: PlanRepository, geometry: PlanGeometrySidecar, events: EventBus, checkLinks?: (plan: Plan, document: PlanGeometryDocument) => Promise<Result<void, AppError>>): RenovationServices {
 return {
  read: id => readBaseline({ plans, geometry }, id),
  command: (baseline, input, ledger) => new RenovationCommand({ plans, geometry, events, checkLinks }, baseline, input, ledger),
 };
}
