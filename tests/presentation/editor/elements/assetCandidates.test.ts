import { describe, expect, it } from 'vitest';
import { expectOk } from '../../../helpers/domain';
import { WALL_LOOP } from '../../../helpers/structure';
import { shapeFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { placementPoints } from '../../../../src/domain/spatial/assetPlacement';
import type { SpatialElement } from '../../../../src/domain/spatial/SpatialElement';
import { elementFootprint, NO_SHAPES } from '../../../../src/presentation/editor/elements/elementFootprint';
import { canvasCandidates } from '../../../../src/presentation/editor/selection/canvasCandidates';
import { resolveSelectionTarget } from '../../../../src/presentation/editor/selection/resolveSelectionTarget';
import { rotationPivot } from '../../../../src/presentation/editor/elements/objectRotation';
import { structureRecords } from '../../../../src/presentation/editor/structure/structureRecords';

const shape = expectOk(shapeFromDimensions(800, 600));
const radiator: SpatialElement = { id: 'element-radiator', kind: 'asset', assetId: 'asset-radiator', points: placementPoints({ x: 1000, y: 1000 }, 0) };
const shapeOf = (id: string) => id === 'asset-radiator' ? shape : null;
const structure = { ...WALL_LOOP, elements: [radiator] };
const room = { id: 'room', points: WALL_LOOP.walls.map(wall => wall.start) };

describe('asset placements as canvas candidates', () => {
	it('uses the derived footprint, or a 500 mm placeholder square when the shape is unknown', () => {
		expect(elementFootprint(radiator, shapeOf)).toEqual([{ x: 600, y: 700 }, { x: 1400, y: 700 }, { x: 1400, y: 1300 }, { x: 600, y: 1300 }]);
		expect(elementFootprint(radiator, NO_SHAPES)).toEqual([{ x: 750, y: 750 }, { x: 1250, y: 750 }, { x: 1250, y: 1250 }, { x: 750, y: 1250 }]);
	});
	it('admits assets through their own layer and walls through theirs', () => {
		const ids = (visible: { zone: boolean; architecture: boolean; asset: boolean }) => canvasCandidates([room], structure, visible, shapeOf).map(item => item.id);
		expect(ids({ zone: true, architecture: false, asset: true })).toEqual(['room', 'element-radiator']);
		expect(ids({ zone: true, architecture: true, asset: false })).toEqual(['room', 'wall-a', 'wall-b', 'wall-c', 'wall-d']);
	});
	it('selects a placement over the room it stands in by clicking inside its footprint', () => {
		const candidates = canvasCandidates([room], structure, { zone: true, architecture: true, asset: true }, shapeOf);
		expect(resolveSelectionTarget({ candidates, selectedIds: [], worldPoint: { x: 1350, y: 1250 }, handleToleranceWorld: 0 })?.id).toBe('element-radiator');
	});
	it('still admits a placement inside a locked room, and still resolves a click to it', () => {
		const lockedRoom = { ...room, locked: true };
		const ids = canvasCandidates([lockedRoom], structure, { zone: true, architecture: true, asset: true }, shapeOf).map(item => item.id);
		expect(ids).not.toContain('room');
		expect(ids).toContain('element-radiator');
		const candidates = canvasCandidates([lockedRoom], structure, { zone: true, architecture: true, asset: true }, shapeOf);
		expect(resolveSelectionTarget({ candidates, selectedIds: [], worldPoint: { x: 1350, y: 1250 }, handleToleranceWorld: 0 })?.id).toBe('element-radiator');
	});
	it('rotates a placement about its anchor', () => {
		expect(rotationPivot({ id: radiator.id, kind: 'asset', points: radiator.points })).toEqual({ x: 1000, y: 1000 });
	});
	it('measures a placement record by its footprint area', () => {
		expect(structureRecords(structure, 'plan', [], shapeOf).find(item => item.id === radiator.id)?.areaMm2).toBe(480000);
	});
});
