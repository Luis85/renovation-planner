import type { SpatialKind, SpatialRecordDto } from '../../read-models/spatialRecords';

/** Derived from IDs and hydrated records; there is no second selection store. */
export type SpatialSelection =
	| { readonly kind: 'floor' }
	| { readonly kind: SpatialKind; readonly record: SpatialRecordDto }
	| {
		readonly kind: 'multiple';
		readonly ids: readonly string[];
		readonly records: readonly SpatialRecordDto[];
		readonly unavailable: number;
		readonly areaMm2: number | null;
		readonly lengthMm: number | null;
		readonly sharedType: string | null;
	};

export function spatialSelection(ids: readonly string[], records: readonly SpatialRecordDto[]): SpatialSelection {
	const byId = new Map(records.map((record) => [record.id, record]));
	const uniqueIds = [...new Set(ids)];
	const chosen = uniqueIds.flatMap((id) => {
		const record = byId.get(id);
		return record === undefined ? [] : [record];
	});
	if (uniqueIds.length < 2) {
		return chosen.length === 0 ? { kind: 'floor' } : { kind: chosen[0].kind, record: chosen[0] };
	}
	return {
		kind: 'multiple',
		ids: uniqueIds,
		records: chosen,
		unavailable: uniqueIds.length - chosen.length,
		// Sum of individual areas, explicitly not a union of overlapping geometry.
		areaMm2: chosen.some(record => record.kind === 'room' || record.kind === 'area') ? chosen.reduce((sum, record) => sum + record.areaMm2, 0) : null,
		lengthMm: chosen.some(record => record.kind === 'wall' || record.kind === 'opening') ? chosen.filter(record => record.kind === 'wall' || record.kind === 'opening').reduce((sum, record) => sum + (record.points.length === 2 ? Math.hypot(record.points[1].x - record.points[0].x, record.points[1].y - record.points[0].y) : 0), 0) : null,
		sharedType: chosen.length === uniqueIds.length && chosen.every((record) => record.zoneType === chosen[0].zoneType) ? chosen[0].zoneType : null,
	};
}
