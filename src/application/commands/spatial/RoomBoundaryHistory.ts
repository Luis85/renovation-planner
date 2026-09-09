import { err, ok } from '../../../core/result/Result';
import type { Zone } from '../../../domain/zone/Zone';
import type { RoomBoundary, Structure } from '../../../domain/spatial/Structure';
import { validateStructure } from '../../../domain/spatial/structureGeometry';
import type { PlanGeometryDocument, PlanGeometrySidecar } from '../../ports/PlanGeometrySidecar';
import { persistenceError } from '../../errors';
import { restoreGroupMember } from '../../../domain/spatial/groupMembership';
import { validateSpatialGroups, type SpatialGroup } from '../../../domain/spatial/SpatialGroup';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';

/** Relationship snapshot for the existing reference-aware Zone deletion transaction. */
export class RoomBoundaryHistory {
	private boundary: RoomBoundary | undefined;
	private groups: readonly SpatialGroup[] = [];
	constructor(private readonly geometry: PlanGeometrySidecar) {}
	async capture(zone: Zone) {
		try {
			const read = await this.geometry.read(zone.planId);
			if (!read.ok) return read;
			this.boundary = read.value.document.structure?.boundaries.find(item => item.roomId === zone.id);
			this.groups = (read.value.document.groups ?? []).map(group => ({ ...group, memberIds: [...group.memberIds] }));
			return ok(undefined);
		} catch (cause) { return err(persistenceError('spatial.read-failed', 'Could not snapshot the Room boundary.', cause)); }
	}
	private restoredGroups(zone: Zone, document: PlanGeometryDocument, structure: Structure | undefined) {
		const restored = restoreGroupMember(this.groups, document.groups ?? [], zone.id);
		if (!restored.ok) return err(persistenceError('spatial.group-restore-conflict', 'The deleted Zone group cannot be restored safely.', restored.error));
		const valid = validateSpatialGroups(restored.value, { zoneIds: document.objects.map(item => item.id), structure: structure ?? EMPTY_STRUCTURE });
		return valid.ok ? restored : err(persistenceError('spatial.group-restore-conflict', 'The deleted Zone group cannot be restored safely.', valid.error));
	}
	async restore(zone: Zone) {
		const grouped = this.groups.some(group => group.memberIds.includes(zone.id));
		if (!this.boundary && !grouped) return ok(undefined);
		try {
			const read = await this.geometry.read(zone.planId);
			if (!read.ok) return read;
			const current = read.value.document.structure;
			if (this.boundary && !current) return err(persistenceError('spatial.boundary-missing', 'The Room boundary walls no longer exist.'));
			const structure = this.boundary && current ? { ...current, boundaries: [...current.boundaries, this.boundary] } : current;
			const ids = read.value.document.objects.map(item => item.id);
			const valid = structure ? validateStructure(structure, ids) : ok(undefined);
			if (!valid.ok) return err(persistenceError('spatial.boundary-invalid', 'The Room relationship cannot be restored safely.', valid.error));
			const restored = this.restoredGroups(zone, read.value.document, structure);
			if (!restored.ok) return restored;
			const written = await this.geometry.write(zone.planId, { ...read.value.document, structure, ...(grouped ? { groups: restored.value } : {}) }, read.value.version);
			return written.ok ? ok({ relatedWrite: { id: zone.planId, before: read.value.version, after: written.value } }) : written;
		} catch (cause) { return err(persistenceError('spatial.write-failed', 'Could not restore the Room boundary.', cause)); }
	}
}
