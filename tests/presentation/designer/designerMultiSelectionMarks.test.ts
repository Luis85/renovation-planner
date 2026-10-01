/**
 * @vitest-environment jsdom
 *
 * AD18 UI critique, Task 2, on the mounted canvas: with several parts selected the canvas drew only the
 * primary (last-pressed) one as selected, while the Parts panel said "2 parts selected". Now every drawn
 * member gets the accent restroke, the handles stay on the primary alone (the gesture model is
 * unchanged), and two or more drawn members get one dashed frame round their combined box. A member that
 * is not drawn (AD18-R20, `drawnSelection`) draws nothing, per member.
 *
 * Driven through `designerRig`, the real wiring: selection by Parts row with Shift, as a user builds a set.
 * Marks are counted with `isVisible()`, as `designerHiddenSelection.test.ts` counts them.
 */
import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { detailBox } from '../../../src/domain/asset/detailEdits';
import { groupDetails } from '../../../src/domain/asset/groupEdits';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { editableShape, shapeWithOpenGraphic } from '../../helpers/assetShapes';
import { pressRow, selecting, showClearance, toggleHidden, type DesignerRig } from '../../helpers/designerRig';
import { expectOk } from '../../helpers/domain';

const drawn = (rig: DesignerRig, name: string): Konva.Line[] => rig.stage.find<Konva.Line>(name).filter((node) => node.isVisible());
const counts = (rig: DesignerRig) => ({
	outlines: drawn(rig, '.asset-selection-outline').length,
	bounds: drawn(rig, '.asset-selection-bounds').length,
	handles: drawn(rig, '.asset-selection-handle').length,
});
const handleCentres = (rig: DesignerRig) => drawn(rig, '.asset-selection-handle').map((node) => ({ x: node.x(), y: node.y() }));

/** Every row pressed in order, the first plainly and the rest with Shift — the set a user builds by hand. */
async function selectAll(rig: DesignerRig, rows: readonly string[]): Promise<void> {
	for (const [index, row] of rows.entries()) await pressRow(rig, row, { shiftKey: index > 0 });
}

/** The combined `detailBox` of the named graphics, as the frame's four corners. */
function unionCorners(shape: AssetShape, ids: readonly string[]): number[] {
	const boxes = shape.details.filter((detail) => ids.includes(detail.id)).map((detail) => expectOk(detailBox(detail)));
	const [minX, minY] = [Math.min(...boxes.map((box) => box.min.x)), Math.min(...boxes.map((box) => box.min.y))];
	const [maxX, maxY] = [Math.max(...boxes.map((box) => box.max.x)), Math.max(...boxes.map((box) => box.max.y))];
	return [minX, minY, maxX, minY, maxX, maxY, minX, maxY];
}

const frameGap = (rig: DesignerRig, expected: readonly number[]): number => {
	const points = drawn(rig, '.asset-selection-bounds')[0]?.points() ?? [];
	return points.length === 8 ? Math.max(...points.map((value, index) => Math.abs(value - expected[index]))) : Infinity;
};

const rowsOf = (shape: AssetShape): string[] => shape.details.map((detail) => `detail:${detail.id}`);

describe('a multi-selection on the mounted designer canvas', () => {
	it('restrokes both members, keeps the handles on the primary alone, and frames the pair', async () => {
		const shape = editableShape();
		const rig = await selecting(shape);
		try {
			await pressRow(rig, 'detail:detail-2');
			const primaryAlone = { handles: counts(rig).handles, centres: handleCentres(rig) };
			expect(counts(rig)).toEqual({ outlines: 1, bounds: 0, handles: primaryAlone.handles });

			await selectAll(rig, ['detail:detail-1', 'detail:detail-2']);
			expect(useAssetDesignStore(rig.pinia).selected).toHaveLength(2);
			expect(counts(rig)).toEqual({ outlines: 2, bounds: 1, handles: primaryAlone.handles });
			expect(handleCentres(rig)).toEqual(primaryAlone.centres);
			expect(frameGap(rig, unionCorners(shape, ['detail-1', 'detail-2']))).toBeLessThan(1e-6);

			// Taking a member back out leaves one: no frame round it.
			await pressRow(rig, 'detail:detail-1', { shiftKey: true });
			expect(counts(rig)).toEqual({ outlines: 1, bounds: 0, handles: primaryAlone.handles });
		} finally {
			rig.unmount();
		}
	});

	it('draws nothing of a member hidden in Parts, per member, and brings it back on show', async () => {
		const shape = editableShape();
		const rig = await selecting(shape);
		try {
			await selectAll(rig, ['detail:detail-1', 'detail:detail-2']);
			const both = counts(rig);

			// The OTHER member hidden: the primary keeps its restroke and handles, and one drawn member has no frame.
			await toggleHidden(rig, 'detail:detail-1');
			expect(counts(rig)).toEqual({ outlines: 1, bounds: 0, handles: both.handles });
			await toggleHidden(rig, 'detail:detail-1');
			expect(counts(rig)).toEqual(both);

			// The PRIMARY hidden: no handles (AD18-R20), while the other member still shows it is selected.
			await toggleHidden(rig, 'detail:detail-2');
			expect(counts(rig)).toEqual({ outlines: 1, bounds: 0, handles: 0 });
			await toggleHidden(rig, 'detail:detail-2');
			expect(counts(rig)).toEqual(both);
		} finally {
			rig.unmount();
		}
	});

	/** The footprint and the clearance never join a set (C05), so each alone draws one restroke and no frame, `Show clearance` either way. */
	it('draws no frame for the footprint or the clearance selected', async () => {
		const rig = await selecting(editableShape());
		try {
			await selectAll(rig, ['detail:detail-1', 'footprint']);
			expect(counts(rig)).toMatchObject({ outlines: 1, bounds: 0 });
			await selectAll(rig, ['detail:detail-1', 'clearance']);
			expect(counts(rig)).toMatchObject({ outlines: 1, bounds: 0 });
			await showClearance(rig, false);
			expect(counts(rig)).toEqual({ outlines: 0, bounds: 0, handles: 0 });
		} finally {
			rig.unmount();
		}
	});

	it('frames a set holding an open graphic and a grouped pair by their reach', async () => {
		for (const shape of [shapeWithOpenGraphic(), expectOk(groupDetails(editableShape(), ['detail-1', 'detail-2']))]) {
			const rig = await selecting(shape);
			try {
				await selectAll(rig, rowsOf(shape));
				expect(counts(rig)).toMatchObject({ outlines: shape.details.length, bounds: 1 });
				expect(frameGap(rig, unionCorners(shape, shape.details.map((detail) => detail.id)))).toBeLessThan(1e-6);
			} finally {
				rig.unmount();
			}
		}
	});
});

const PRESETS = ASSET_PRESETS.map((preset) => [preset.id, expectOk(preset.build(defaultValues(preset)))] as const).filter(([, shape]) => shape.details.length >= 2);

it.each(PRESETS)('restrokes and frames every graphic of the %s preset selected together', async (_id, shape) => {
	const rig = await selecting(shape);
	try {
		await selectAll(rig, rowsOf(shape));
		expect(counts(rig)).toMatchObject({ outlines: shape.details.length, bounds: 1 });
		expect(frameGap(rig, unionCorners(shape, shape.details.map((detail) => detail.id)))).toBeLessThan(1e-6);
	} finally {
		rig.unmount();
	}
});
