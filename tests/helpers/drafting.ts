import type { NamedSpatialElement } from '../../src/domain/spatial/SpatialElement';

/** One drafting mark of each kind, apart from one another and from the editor rig's walls' own ids. */
export const DIMENSION_A: NamedSpatialElement = { id: 'element-dimension-a', kind: 'dimension', name: 'Front', offset: -600, points: [{ x: 0, y: 0 }, { x: 1190, y: 0 }, { x: 1940, y: 0 }, { x: 4560, y: 0 }] };
export const SECTION_A: NamedSpatialElement = { id: 'element-section-a', kind: 'section', name: 'S-01', flipped: false, points: [{ x: -1000, y: 2000 }, { x: 6000, y: 2000 }] };
export const VIEW_A: NamedSpatialElement = { id: 'element-view-a', kind: 'view', name: 'A-01', points: [{ x: -1500, y: 1000 }, { x: -800, y: 1000 }] };
export const HATCH_A: NamedSpatialElement = { id: 'element-hatch-a', kind: 'hatch', name: 'Existing', points: [{ x: 0, y: 5000 }, { x: 3000, y: 5000 }, { x: 3000, y: 7000 }, { x: 0, y: 7000 }] };
export const TEXT_A: NamedSpatialElement = { id: 'element-text-a', kind: 'text', name: 'Wintergarten', points: [{ x: 1500, y: 1500 }] };
export const BOUNDARY_A: NamedSpatialElement = { id: 'element-boundary-a', kind: 'boundary', name: 'Plot line', points: [{ x: -2000, y: -1000 }, { x: 6000, y: -1500 }] };
export const GRID_A: NamedSpatialElement = { id: 'element-grid-a', kind: 'grid', name: '1', points: [{ x: 7000, y: 0 }] };
export const DRAFTING_MARKS: readonly NamedSpatialElement[] = [DIMENSION_A, SECTION_A, VIEW_A, HATCH_A, TEXT_A, BOUNDARY_A, GRID_A];
