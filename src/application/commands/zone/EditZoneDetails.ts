import { err, ok } from '../../../core/result/Result';
import type { EventBus } from '../../../core/events/EventBus';
import type { Zone } from '../../../domain/zone/Zone';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { ZoneType } from '../../../domain/zone/ZoneType';
import { zoneDetailsChanged } from '../../../domain/zone/Zone.events';
import type { ZoneRepository } from '../../ports/ZoneRepository';
import { checkExpectedVersion, type EntityVersion } from '../../ports/versioning';
import { undoSuperseded, type WriteLedger } from '../../editor/WriteLedger';
import { recordRelatedWrite } from '../../editor/recordRelatedWrite';
import type { DispatchResult } from '../DispatchOutcome';
import { loadZone } from './loadZone';

/** `locked` absent leaves the lock untouched (ADR-0027); name and type are always restated. */
export interface ZoneDetails { readonly name: string; readonly zoneType: ZoneType; readonly locked?: boolean }
export interface EditZoneDetailsInput {
	readonly zoneId: ZoneId;
	readonly forward: ZoneDetails;
	readonly inverse: ZoneDetails;
	readonly expected: EntityVersion;
}

/** One guarded metadata transaction, preserving geometry, identity, note body and related planning. */
export class EditZoneDetailsCommand {
	private generation: number | null = null;
	constructor(private readonly zones: ZoneRepository, private readonly events: EventBus,
		private readonly ledger: WriteLedger, private readonly input: EditZoneDetailsInput) {}
	execute(): Promise<DispatchResult> { return this.dispatch(this.input.forward); }
	undo(): Promise<DispatchResult> { return this.dispatch(this.input.inverse); }
	private async dispatch(details: ZoneDetails): Promise<DispatchResult> {
		const { zoneId } = this.input;
		if (this.generation !== null && this.generation !== this.ledger.generation(zoneId)) return err(undoSuperseded(zoneId));
		const expected = this.generation === null ? this.input.expected : this.ledger.lastWritten(zoneId);
		if (expected === null) return err(undoSuperseded(zoneId));
		const loaded = await loadZone(this.zones, zoneId);
		if (!loaded.ok) return loaded;
		const conflict = checkExpectedVersion('zone', zoneId, loaded.value.version, expected);
		if (conflict) return err(conflict);
		const current = loaded.value.entity, renamed = current.withDetails(details.name, details.zoneType);
		if (!renamed.ok) return renamed;
		// Typed rather than inferred so fallow resolves `withLocked` through this explicit annotation (CLAUDE.md Gotchas). Do not inline.
		const base: Zone = renamed.value;
		const updated = details.locked === undefined ? base : base.withLocked(details.locked);
		if (updated.name === current.name && updated.zoneType === current.zoneType && updated.locked === current.locked) return ok('no-write');
		const saved = await this.zones.save(updated, expected);
		if (!saved.ok) return saved;
		this.generation = this.ledger.observe(zoneId, loaded.value.version);
		recordRelatedWrite(this.ledger, saved.value);
		this.ledger.record(zoneId, saved.value.version);
		await this.events.publish(zoneDetailsChanged({ zoneId, planId: current.planId, projectId: current.projectId }));
		return ok('wrote');
	}
}
