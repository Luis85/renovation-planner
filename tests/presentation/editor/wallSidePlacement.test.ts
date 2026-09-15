import { expect, it } from 'vitest';
import { expectOk } from '../../helpers/domain';
import type { Wall } from '../../../src/domain/spatial/Structure';
import { shapeFromDimensions } from '../../../src/domain/asset/AssetShape';
import { placementAt } from '../../../src/presentation/editor/elements/assetPlacementDraft';
import { createStructureDraft, pickHost } from '../../../src/presentation/editor/structure/structureDraft';
import { resolveWallJoin } from '../../../src/domain/spatial/wallJoin';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 450, sideExtents: { a: 400, b: 50 } };

it('snaps an asset to the chosen physical face and leaves the opposite placement unchanged', () => {
	const shape = expectOk(shapeFromDimensions(800, 600));
	const a = placementAt({ x: 2000, y: -390 }, shape, [wall], 10), b = placementAt({ x: 2000, y: 40 }, shape, [wall], 10);
	expect(a[0]).toEqual({ x: 2000, y: -800 }); expect(b[0]).toEqual({ x: 2000, y: 450 });
	const deeper = { ...wall, thickness: 550, sideExtents: { a: 500, b: 50 } };
	expect(placementAt({ x: 2000, y: 40 }, shape, [deeper], 10)).toEqual(b);
	expect(placementAt({ x: 2000, y: -390 }, shape, [deeper], 10)[0].y).toBe(-900);
	expect(placementAt({ x: 2000, y: 70 }, shape, [wall], 10)[0].y).toBe(70);
});

it('uses the actual side depth for host picking and a new wall body join', () => {
	const draft = createStructureDraft(); draft.kind = 'door';
	pickHost(draft, { x: 2000, y: 200 }, [wall], 10); expect(draft.text.hostId).toBe('');
	pickHost(draft, { x: 2000, y: -350 }, [wall], 10); expect(draft.text.hostId).toBe(wall.id);
	expect(resolveWallJoin({ walls: [wall], point: { x: 2100, y: -350 }, tolerance: 10 })).toMatchObject({ wallId: wall.id, point: { x: 2100, y: 0 }, offset: 2100 });
	expect(resolveWallJoin({ walls: [wall], point: { x: 2100, y: 200 }, tolerance: 10 })).toBeNull();
});
