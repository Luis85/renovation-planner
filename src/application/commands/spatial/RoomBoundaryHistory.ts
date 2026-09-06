import { err, ok } from '../../../core/result/Result';
import type { Zone } from '../../../domain/zone/Zone';
import type { RoomBoundary } from '../../../domain/spatial/Structure';
import { validateStructure } from '../../../domain/spatial/structureGeometry';
import type { PlanGeometrySidecar } from '../../ports/PlanGeometrySidecar';
import { persistenceError } from '../../errors';

/** Relationship snapshot for the existing reference-aware Zone deletion transaction. */
export class RoomBoundaryHistory {
	private boundary: RoomBoundary | undefined;
	constructor(private readonly geometry: PlanGeometrySidecar) {}
	async capture(zone: Zone) {
		try {
			const read = await this.geometry.read(zone.planId);
			if (!read.ok) return read;
			this.boundary = read.value.document.structure?.boundaries.find(item => item.roomId === zone.id);
			return ok(undefined);
		} catch (cause) { return err(persistenceError('spatial.read-failed', 'Could not snapshot the Room boundary.', cause)); }
	}
	async restore(zone: Zone) {
		if (!this.boundary) return ok(undefined);
		try {
			const read = await this.geometry.read(zone.planId);
			if (!read.ok) return read;
			const current = read.value.document.structure;
			if (!current) return err(persistenceError('spatial.boundary-missing', 'The Room boundary walls no longer exist.'));
			const structure = { ...current, boundaries: [...current.boundaries, this.boundary] };
			const valid = validateStructure(structure, read.value.document.objects.map(item => item.id));
			if (!valid.ok) return err(persistenceError('spatial.boundary-invalid', 'The Room relationship cannot be restored safely.', valid.error));
			const written = await this.geometry.write(zone.planId, { ...read.value.document, structure }, read.value.version);
			return written.ok ? ok(undefined) : written;
		} catch (cause) { return err(persistenceError('spatial.write-failed', 'Could not restore the Room boundary.', cause)); }
	}
}
