import type { SpatialRecordDto } from '../../read-models/spatialRecords';

/** Derived from IDs and hydrated records; there is no second selection store. */
export type SpatialSelection =
	| { readonly kind: 'floor' }
	| { readonly kind: 'room' | 'area'; readonly record: SpatialRecordDto }
	| {
		readonly kind: 'multiple';
		readonly ids: readonly string[];
		readonly records: readonly SpatialRecordDto[];
		readonly unavailable: number;
		readonly areaMm2: number | null;
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
		areaMm2: chosen.length === 0 ? null : chosen.reduce((sum, record) => sum + record.areaMm2, 0),
		sharedType: chosen.length === uniqueIds.length && chosen.every((record) => record.zoneType === chosen[0].zoneType) ? chosen[0].zoneType : null,
	};
}
