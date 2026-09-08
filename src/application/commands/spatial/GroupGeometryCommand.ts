import type { EventBus } from '../../../core/events/EventBus';
import type { AppError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import { createCurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { zoneGeometryChanged } from '../../../domain/zone/Zone.events';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';
import { validateStructure } from '../../../domain/spatial/structureGeometry';
import { validateSpatialGroups } from '../../../domain/spatial/SpatialGroup';
import type { PlanGeometryDocument, PlanGeometrySidecar, PlanGeometrySnapshot } from '../../ports/PlanGeometrySidecar';
import type { ZoneGeometryVersions, ZoneRepository } from '../../ports/ZoneRepository';
import { checkExpectedVersion, type EntityVersion } from '../../ports/versioning';
import { undoSuperseded, type WriteLedger } from '../../editor/WriteLedger';
import { markUncompensated, type DispatchResult } from '../DispatchOutcome';
import { persistenceError } from '../../errors';
import { sameGeometryDocument } from './sameGeometryDocument';

interface Dependencies { geometry: PlanGeometrySidecar; zones: ZoneRepository; events: EventBus }
export interface GroupGeometryInput { planId: PlanId; baseline: PlanGeometrySnapshot; document: PlanGeometryDocument; ledger: WriteLedger }
export interface GroupGeometryServices {
	read(id: PlanId): Promise<Result<PlanGeometrySnapshot, AppError>>;
	command(input: GroupGeometryInput): { execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult> };
}
interface ZoneReceipt { id: ZoneId; before: EntityVersion; after: EntityVersion; source: ZoneGeometryVersions }
function validate(document: PlanGeometryDocument): Result<void, AppError> {
	for (const object of document.objects) { const polygon = createCurvedPolygon(object); if (!polygon.ok) return polygon; }
	const ids = document.objects.map(object => object.id);
	for (const structure of [document.structure, document.intended]) { if (structure) { const checked = validateStructure(structure, ids); if (!checked.ok) return checked; } }
	return validateSpatialGroups(document.groups ?? [], { zoneIds: ids, structure: document.structure ?? EMPTY_STRUCTURE });
}
async function zoneReceipts(deps: Dependencies, planId: PlanId, before: PlanGeometryDocument, after: PlanGeometryDocument): Promise<Result<ZoneReceipt[], AppError>> {
	const receipts: ZoneReceipt[] = [];
	for (const object of before.objects) {
		const next = after.objects.find(item => item.id === object.id);
		if (!next || JSON.stringify({ points: object.points, bulges: object.bulges }) === JSON.stringify({ points: next.points, bulges: next.bulges })) continue;
		const source = await deps.zones.prepareGeometryVersions?.(object.id as ZoneId, object);
		if (!source?.ok) return source ?? err(undoSuperseded(planId));
		if (!source.value || source.value.zone.entity.planId !== planId) return err(undoSuperseded(planId));
		const version = source.value.versionFor(next);
		if (!version.ok) return version;
		receipts.push({ id: object.id as ZoneId, before: source.value.zone.version, after: version.value, source: source.value });
	}
	return ok(receipts);
}

/** Groups and heterogeneous rigid transforms replace one conditional sidecar document. */
class GroupGeometryCommand {
	private current: PlanGeometrySnapshot;
	private readonly baseline: PlanGeometrySnapshot;
	private readonly proposed: PlanGeometryDocument;
	private generation: number | null = null;
	private applied = false;
	private busy = false;
	private retired = false;
	constructor(private readonly deps: Dependencies, private readonly input: GroupGeometryInput) {
		this.baseline = structuredClone(input.baseline); this.current = this.baseline; this.proposed = structuredClone(input.document);
	}
	execute(): Promise<DispatchResult> { return this.run(true); }
	undo(): Promise<DispatchResult> { return this.run(false); }
	private async check(): Promise<DispatchResult> {
		const { planId, ledger } = this.input, read = await this.deps.geometry.read(planId);
		if (!read.ok) return read;
		if (this.generation === null) {
			const conflict = checkExpectedVersion('plan-geometry', planId, read.value.version, this.current.version);
			if (conflict) return err(conflict);
			this.generation = ledger.observe(planId, read.value.version);
		} else if (ledger.observe(planId, read.value.version) !== this.generation || !sameGeometryDocument(read.value.document, this.current.document)) return err(undoSuperseded(planId));
		this.current = read.value; return ok('no-write');
	}
	private async run(forward: boolean): Promise<DispatchResult> {
		if (this.retired) return err(markUncompensated(persistenceError('spatial-group.recovery-required', 'Reopen the floor before editing.')));
		if (this.busy || this.applied === forward) return ok('no-write');
		this.busy = true;
		try {
			const checked = await this.check(); if (!checked.ok) return checked;
			return await this.write(forward);
		} catch (cause) { return err(persistenceError('spatial-group.write-failed', 'The grouped operation failed.', cause)); }
		finally { this.busy = false; }
	}
	private async write(forward: boolean): Promise<DispatchResult> {
		const { planId, ledger } = this.input, document = forward ? this.proposed : this.baseline.document;
		if (sameGeometryDocument(document, this.current.document)) return ok('no-write');
		const valid = validate(document); if (!valid.ok) return valid;
		const receipts = await zoneReceipts(this.deps, planId, this.current.document, document); if (!receipts.ok) return receipts;
		const written = await this.deps.geometry.write(planId, document, this.current.version); if (!written.ok) return written;
		this.current = { document, version: written.value }; this.applied = forward; ledger.record(planId, written.value);
		for (const receipt of receipts.value) { ledger.observe(receipt.id, receipt.before); ledger.record(receipt.id, receipt.after); }
		try {
			for (const receipt of receipts.value) await this.deps.events.publish(zoneGeometryChanged({ zoneId: receipt.id, planId, projectId: receipt.source.zone.entity.projectId }));
			await this.deps.events.publish({ type: 'PlanStructureChanged', payload: { planId } });
		} catch (cause) { this.retired = true; return err(markUncompensated(persistenceError('spatial-group.publish-failed', 'The group was saved, but the editor must be reopened.', cause))); }
		return ok('wrote');
	}
}
export function groupGeometryServices(geometry: PlanGeometrySidecar, zones: ZoneRepository, events: EventBus): GroupGeometryServices {
	return { read: id => geometry.read(id), command: input => new GroupGeometryCommand({ geometry, zones, events }, input) };
}
