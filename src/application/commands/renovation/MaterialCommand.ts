import { effectiveValue } from '../../../core/derived/DerivedValue';
import { requirementCreated, requirementDeleted, requirementRestored } from '../../../domain/requirement/Requirement.events';
import { publishIfEffectiveCostChanged } from '../requirement/SetRequirementQuantityOverride';
import { of } from '../../../core/money/Money';
import { err, ok } from '../../../core/result/Result';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import type { Loaded } from '../../ports/versioning';
import { sameVersion } from '../../ports/versioning';
import { undoSuperseded, type WriteLedger } from '../../editor/WriteLedger';
import type { DispatchResult } from '../DispatchOutcome';
import { persistenceError } from '../../errors';
import { validateMaterialLinks, validateDepthLinks, materialReferents } from './planningLinks';
import { prepareMaterial, readPlanning, type MaterialInput, type PlanningBaseline, type PlanningDeps } from './materialPlanning';

/** One Requirement write, conditional in both directions, through the shared editor history. */
export class MaterialCommand {
	private current: Loaded<Requirement> | null;
	private applied = false;
	private busy = false;
	private generation: number | null = null;
	private readonly id: RequirementId;
	private readonly before: Loaded<Requirement> | null;
	constructor(private readonly deps: PlanningDeps, private readonly baseline: PlanningBaseline, private readonly input: MaterialInput | { deleteId: string }, private readonly ledger: WriteLedger) {
		this.id = ('deleteId' in input ? input.deleteId : input.id) as RequirementId;
		this.before = baseline.materials.find(item => item.entity.id === this.id) ?? null;
		this.current = this.before;
	}
	execute(): Promise<DispatchResult> { return this.run(true); }
	undo(): Promise<DispatchResult> { return this.run(false); }
	private async run(forward: boolean): Promise<DispatchResult> {
		if (this.busy || this.applied === forward) return ok('no-write');
		this.busy = true;
		let release: (() => void) | undefined;
		try {
		release = await this.deps.locks.acquire([this.baseline.plan.entity.id, ...('deleteId' in this.input ? this.before ? [this.before.entity.origin.zoneId, this.before.entity.assetId] : [] : [this.input.roomId, this.input.assetId])], [this.id]);
		return await this.apply(forward); }
		catch (cause) { return err(persistenceError('material.write-failed', 'The material could not be saved.', cause)); }
		finally { release?.(); this.busy = false; }
	}
	private async apply(forward: boolean): Promise<DispatchResult> {
		const fresh = await readPlanning(this.deps, this.baseline.plan.entity.id);
		if (!fresh.ok) return fresh;
		const loaded = await this.deps.requirements.getById(this.id);
		if (!loaded.ok) return loaded;
		const live = loaded.value;
		if (!this.isCurrent(fresh.value, live)) return err(undoSuperseded(this.id));
		const candidate = forward ? ('deleteId' in this.input ? ok(null) : prepareMaterial(fresh.value, this.input)) : ok(this.before?.entity ?? null);
		if (!candidate.ok) return candidate;
		if (!candidate.value && !live) return ok('no-write');
		const written = await this.write(candidate.value, live, fresh.value);
		if (!written.ok) return written;
		this.applied = forward;
		const payload = { requirementId: this.id, projectId: fresh.value.plan.entity.projectId };
		await this.deps.events.publish(candidate.value ? (live ? requirementRestored(payload) : requirementCreated(payload)) : requirementDeleted(payload));
		if (candidate.value && live) await publishIfEffectiveCostChanged(this.deps.events, candidate.value, effectiveValue(live.entity.estimatedCost));
		await this.deps.events.publish({ type: 'PlanRenovationChanged', payload: { planId: fresh.value.plan.entity.id, projectId: fresh.value.plan.entity.projectId } });
		return ok('wrote');
	}

 private isCurrent(fresh: PlanningBaseline, live: Loaded<Requirement> | null): boolean {
		if (this.generation === null && live && this.before && !sameVersion(live.version, this.before.version)) return false;
		if (this.generation === null && (!sameVersion(fresh.plan.version, this.baseline.plan.version) || !sameVersion(fresh.geometry.version, this.baseline.geometry.version)
			|| JSON.stringify(fresh.catalogue) !== JSON.stringify(this.baseline.catalogue))) return false;
		if (!!live !== !!this.current) return false;
		if (live && this.current) {
			const generation = this.ledger.observe(this.id, live.version);
			if (this.generation !== null && generation !== this.generation) return false;
			if (fingerprint(live.entity) !== fingerprint(this.current.entity)) return false;
			this.generation = generation;
		}
 return true;
 }
 private async write(candidate: Requirement | null, live: Loaded<Requirement> | null, fresh: PlanningBaseline): Promise<DispatchResult> {
		if (candidate) {
			const links = validateMaterialLinks(candidate, fresh);
			if (!links.ok) return links;
			const references = validateDepthLinks(fresh.plan.entity.renovation ?? { subjects: [], work: [], decisions: [] }, { ...fresh, materials: [...fresh.materials.filter(item => item.entity.id !== candidate.id), { entity: candidate, version: live?.version ?? this.baseline.plan.version }] });
            if (!references.ok) return references;
			const result = await this.deps.requirements.save(candidate, live?.version ?? 'absent');
			if (!result.ok) return result;
			this.current = result.value;
			this.ledger.record(this.id, result.value.version);
			this.generation ??= this.ledger.observe(this.id, result.value.version);
		} else if (live) {
			if (materialReferents(fresh.plan.entity.renovation?.depth, this.id).length) return err(undoSuperseded(this.id));
			const deleted = await this.deps.requirements.delete(this.id, live.version);
			if (!deleted.ok) return deleted;
			this.current = null;
            this.ledger.forget(this.id);
		}
 return ok('wrote');
 }
}

const normalize = (money: { amount: string; currency: string }) => of(money.amount, money.currency);
function fingerprint(value: Requirement): string {
 return JSON.stringify({ ...value, estimatedCost: { calculated: normalize(value.estimatedCost.calculated), override: value.estimatedCost.override ? normalize(value.estimatedCost.override) : undefined },
 calculatedFrom: { ...value.calculatedFrom, unitCost: normalize(value.calculatedFrom.unitCost) } });
}
