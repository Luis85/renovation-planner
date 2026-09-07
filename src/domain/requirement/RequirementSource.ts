import { Decimal } from 'decimal.js';
import { area } from '../../core/geometry/operations';
import type { Point } from '../../core/geometry/Point';
import { err, ok } from '../../core/result/Result';
import type { MeasurementUnit } from '../../core/units/MeasurementUnit';
import { EMPTY_STRUCTURE, type Structure } from '../spatial/Structure';
import { elementLength, type SpatialElement } from '../spatial/SpatialElement';

export const QUANTITY_RULES = ['room-area', 'room-perimeter', 'wall-gross', 'wall-net', 'wall-length', 'opening-area', 'element-length', 'object-area', 'count', 'manual'] as const;
/** Geometry references stay on the Requirement; procurement and payment facts do not. */
export interface RequirementSource {
	readonly planId: string;
	readonly targetId: string;
	readonly workId: string;
	readonly outcomeId: string;
	readonly state: 'current' | 'intended';
	readonly rule: typeof QUANTITY_RULES[number];
	readonly manual: string;
	readonly coverage: string;
	readonly lot: string;
	readonly minimum: string;
}
export interface QuantityGeometry {
	readonly objects: readonly { id: string; points: readonly Point[] }[];
	readonly structure?: Structure;
	readonly intended?: Structure;
}
export function sourceError() {
	return { category: 'Calculation' as const, code: 'requirement.source-invalid', message: 'The quantity source or its unit is unavailable or invalid.' };
}
export function validDecimal(text: string, positive = false): boolean {
	if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(text)) return false;
	const value = new Decimal(text);
	return value.isFinite() && (positive ? value.gt(0) : value.gte(0));
}
export function validRequirementSource(source: RequirementSource): boolean {
	return !!source.planId && !!source.targetId && QUANTITY_RULES.includes(source.rule)
		&& ['current', 'intended'].includes(source.state) && validDecimal(source.manual)
		&& validDecimal(source.coverage, true) && (!source.lot || validDecimal(source.lot, true))
		&& (!source.minimum || (!!source.lot && validDecimal(source.minimum, true)));
}
function roomMeasurement(source: RequirementSource, roomId: string, geometry: QuantityGeometry): Measurement | null {
 const room = geometry.objects.find(item => item.id === roomId);
 if (!room || source.targetId !== roomId) return null;
 if (source.rule === 'count') return { raw: 1, unit: 'piece' };
 if (source.rule === 'room-area') { const measured = area({ points: [...room.points] }); return measured.ok ? { raw: measured.value, unit: 'm2' } : null; }
 if (source.rule !== 'room-perimeter') return null;
 return { raw: room.points.reduce((sum, point, index) => { const next = room.points[(index + 1) % room.points.length]; return sum + Math.hypot(next.x - point.x, next.y - point.y); }, 0), unit: 'm' };
}
type Measurement = { raw: number; unit: MeasurementUnit };
function wallMeasurement(source: RequirementSource, structure: Structure): Measurement | null {
 const wall = structure.walls.find(item => item.id === source.targetId);
 if (!wall) return null;
 const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
 if (source.rule === 'count') return { raw: 1, unit: 'piece' };
 if (source.rule === 'wall-length') return { raw: length, unit: 'm' };
 if (source.rule !== 'wall-gross' && source.rule !== 'wall-net') return null;
 const deducted = source.rule === 'wall-net' ? structure.openings.filter(item => item.hostId === wall.id).reduce((sum, item) => sum + item.width * item.height, 0) : 0;
 return { raw: length * wall.height - deducted, unit: 'm2' };
}
function elementMeasurement(source: RequirementSource, element: SpatialElement | undefined): Measurement | null {
 if (!element) return null;
 if (source.rule === 'count') return { raw: 1, unit: 'piece' };
 if (element.kind !== 'object' && source.rule === 'element-length') return { raw: elementLength(element), unit: 'm' };
 if (element.kind === 'object' && source.rule === 'object-area') { const measured = area({ points: element.points }); return measured.ok ? { raw: measured.value, unit: 'm2' } : null; }
 return null;
}
function measurement(source: RequirementSource, roomId: string, geometry: QuantityGeometry): Measurement | null {
 const structure = (source.state === 'intended' ? geometry.intended ?? geometry.structure : geometry.structure) ?? EMPTY_STRUCTURE;
 const opening = structure.openings.find(item => item.id === source.targetId);
 if (opening && source.rule === 'opening-area') return { raw: opening.width * opening.height, unit: 'm2' };
 if (opening && source.rule === 'count') return { raw: 1, unit: 'piece' };
 return elementMeasurement(source, structure.elements?.find(item => item.id === source.targetId)) ?? wallMeasurement(source, structure) ?? roomMeasurement(source, roomId, geometry);
}
/** Raw world measurement for the existing quantity engine; no synthetic room outline. */
export function sourceMeasurement(source: RequirementSource, roomId: string, geometry: QuantityGeometry, unit: MeasurementUnit) {
	if (!validRequirementSource(source)) return err(sourceError());
	if (source.rule === 'manual') {
		const factor = unit === 'm' ? 1000 : unit === 'm2' ? 1_000_000 : 1;
		if (!['m', 'm2', 'piece'].includes(unit) || !measurement({ ...source, rule: 'count' }, roomId, geometry)) return err(sourceError());
		return ok(new Decimal(source.manual).mul(factor));
	}
	const result = measurement(source, roomId, geometry);
	return result && result.unit === unit && Number.isFinite(result.raw) && result.raw >= 0 ? ok(new Decimal(result.raw)) : err(sourceError());
}
