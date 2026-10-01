import { describe, expect, it } from 'vitest';
import {
	addDetail,
	deleteDetail,
	DUPLICATE_OFFSET_MM,
	duplicateDetail,
	fitFootprintToDetails,
	nextDetailId,
	reorderDetail,
	updateDetail,
} from '../../../src/domain/asset/detailEdits';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { rect } from '../../../src/domain/asset/presets/presetGeometry';
import { editableShape, QUARTER, shapeWithOpenGraphic } from '../../helpers/assetShapes';
import { expectErr, expectOk } from '../../helpers/domain';

/**
 * Spec 2026-09-13 Decision 9 and Amendment 1: the edits that change which details a shape has, their
 * order and their labels. `editableShape` carries a straight solid `detail-1` and a curved, dashed,
 * PENDING `detail-2`, so every copy and move below can be asked what it carried.
 */
const ids = (shape: AssetShape): string[] => shape.details.map((detail) => detail.id);
const OFFSET = { dx: DUPLICATE_OFFSET_MM, dy: DUPLICATE_OFFSET_MM };

/** `editableShape` with no detail awaiting a scale, which fitting to details needs. */
function scaledShape(overrides: Partial<AssetShape> = {}): AssetShape {
	return editableShape({ details: editableShape().details.map((detail) => ({ ...detail, pending: false })), ...overrides });
}

describe('nextDetailId', () => {
	it('starts at detail-1', () => {
		expect(nextDetailId(editableShape({ details: [] }))).toBe('detail-1');
	});

	it('goes one above the highest numbered id and ignores ids of another form', () => {
		const [top, bowl] = editableShape().details;
		expect(nextDetailId(editableShape({ details: [{ ...top, id: 'detail-3' }, { ...bowl, id: 'seat' }] }))).toBe('detail-4');
	});
});

describe('addDetail', () => {
	it('appends the detail on top under the next id', () => {
		const added = expectOk(addDetail(editableShape(), { name: 'seat', outline: rect(100, 100, 0, 200), line: 'solid', pending: false }));
		expect(ids(added)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		expect(added.details[2]).toEqual({
			id: 'detail-3',
			name: 'seat',
			// Stamped by the validator: a graphic proposed without a kind is the closed one (AD04 §3).
			kind: 'closed',
			line: 'solid',
			pending: false,
			outline: { points: [{ x: -50, y: 150 }, { x: 50, y: 150 }, { x: 50, y: 250 }, { x: -50, y: 250 }] },
		});
	});

	it('refuses an outline that encloses no area', () => {
		const flat = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }] };
		expect(expectErr(addDetail(editableShape(), { name: 'flat', outline: flat, line: 'solid', pending: false })).code).toBe('asset.degenerate-detail');
	});
});

describe('duplicateDetail', () => {
	it('inserts the copy directly above the original, offset, under the next id', () => {
		const duplicated = expectOk(duplicateDetail(editableShape(), 'detail-1', OFFSET));
		expect(ids(duplicated)).toEqual(['detail-1', 'detail-3', 'detail-2']);
		const copy = duplicated.details[1];
		expect([copy.name, copy.line, copy.pending]).toEqual(['top', 'solid', false]);
		expect(copy.outline.points).toEqual([{ x: -300, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }, { x: -300, y: 200 }]);
	});

	it('copies a curved, dashed, pending detail with its bulges', () => {
		const duplicated = expectOk(duplicateDetail(editableShape(), 'detail-2', OFFSET));
		expect(ids(duplicated)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		const copy = duplicated.details[2];
		expect([copy.name, copy.line, copy.pending]).toEqual(['bowl', 'dashed', true]);
		expect(copy.outline.points[1]).toEqual({ x: 450, y: 100 });
		expect(copy.outline.bulges).toEqual([QUARTER, QUARTER, QUARTER, QUARTER]);
	});

	/**
	 * AD09's rename. It writes `label` and NEVER `name`: `name` is the stable semantic key a preset,
	 * a test and `detailLabel`'s locale lookup resolve by (C02), so a Parts panel that renamed it
	 * would rename the key every one of those consumers addresses.
	 */
	it('writes a user label beside the semantic name rather than over it', () => {
		const updated = expectOk(updateDetail(editableShape(), 'detail-2', { label: '  Pan  ' }));
		expect([updated.details[1].name, updated.details[1].label]).toEqual(['bowl', 'Pan']);
	});

	/**
	 * A CLEARED label is a removal, which is the opposite of `name`'s blank rule two cases up — and
	 * deliberately so. A graphic must always have a name, so a blank one is an unfinished edit; a
	 * label is optional by construction, so clearing the field is the only way back to the semantic
	 * fallback the panel shows when there is none.
	 */
	it('removes the label when the field is cleared, rather than storing an empty string', () => {
		const labelled = expectOk(updateDetail(editableShape(), 'detail-2', { label: 'Pan' }));
		// Asserted before the clearing, or the case passes on a build that never stored one at all.
		expect(labelled.details[1].label).toBe('Pan');
		const cleared = expectOk(updateDetail(labelled, 'detail-2', { label: '   ' }));
		expect(cleared.details[1]).not.toHaveProperty('label');
		expect(cleared.details[1].name).toBe('bowl');
	});

	/**
	 * `relabelled` narrows on `kind` to put the geometry back with its brand intact, and the OPEN arm
	 * is the one a closed fixture can never reach. The path matters more than the branch: an open
	 * graphic's `outline` is a `CurvedPath`, so a relabel that dropped the narrowing would either stop
	 * compiling or hand the validator a polygon-shaped path.
	 */
	it('labels an open graphic without disturbing its path', () => {
		const before = shapeWithOpenGraphic();
		const updated = expectOk(updateDetail(before, 'detail-3', { label: 'Hinge swing' }));

		expect(updated.details[2]).toMatchObject({ id: 'detail-3', kind: 'open', label: 'Hinge swing' });
		expect(updated.details[2].outline.points).toEqual(before.details[2].outline.points);
	});

	it('leaves an existing label alone when only the line is given', () => {
		const labelled = expectOk(updateDetail(editableShape(), 'detail-1', { label: 'Lid' }));
		const relined = expectOk(updateDetail(labelled, 'detail-1', { line: 'dashed' }));
		expect([relined.details[0].label, relined.details[0].line]).toEqual(['Lid', 'dashed']);
	});

	it('refuses an unknown detail', () => {
		expect(expectErr(duplicateDetail(editableShape(), 'detail-9', OFFSET)).code).toBe('asset.part-not-found');
	});
});

describe('deleteDetail', () => {
	it('removes the detail and keeps the rest in order', () => {
		expect(ids(expectOk(deleteDetail(editableShape(), 'detail-1')))).toEqual(['detail-2']);
	});

	it('refuses an unknown detail', () => {
		expect(expectErr(deleteDetail(editableShape(), 'detail-9')).code).toBe('asset.part-not-found');
	});
});

describe('reorderDetail', () => {
	it('brings a detail forward, one later in the array', () => {
		expect(ids(expectOk(reorderDetail(editableShape(), 'detail-1', 'forward')))).toEqual(['detail-2', 'detail-1']);
	});

	it('sends a detail backward, one earlier in the array', () => {
		expect(ids(expectOk(reorderDetail(editableShape(), 'detail-2', 'backward')))).toEqual(['detail-2', 'detail-1']);
	});

	it.each([
		['detail-2', 'forward'],
		['detail-1', 'backward'],
	] as const)('refuses to move %s %s past the end of the drawing order', (id, direction) => {
		expect(expectErr(reorderDetail(editableShape(), id, direction)).code).toBe('asset.detail-at-limit');
	});

	it('refuses an unknown detail', () => {
		expect(expectErr(reorderDetail(editableShape(), 'detail-9', 'forward')).code).toBe('asset.part-not-found');
	});
});

describe('updateDetail', () => {
	it('renames with the name trimmed and changes the line, leaving other details alone', () => {
		const before = editableShape();
		const updated = expectOk(updateDetail(before, 'detail-1', { name: '  seat  ', line: 'dashed' }));
		expect([updated.details[0].name, updated.details[0].line]).toEqual(['seat', 'dashed']);
		expect(updated.details[1]).toEqual(before.details[1]);
	});

	it('keeps the existing name when the new one is blank', () => {
		const updated = expectOk(updateDetail(editableShape(), 'detail-2', { name: '   ' }));
		expect([updated.details[1].name, updated.details[1].line]).toEqual(['bowl', 'dashed']);
	});

	it('changes only the line when no name is given', () => {
		const updated = expectOk(updateDetail(editableShape(), 'detail-1', { line: 'dashed' }));
		expect([updated.details[0].name, updated.details[0].line]).toEqual(['top', 'dashed']);
	});

	it('refuses an unknown detail', () => {
		expect(expectErr(updateDetail(editableShape(), 'detail-9', { name: 'x' })).code).toBe('asset.part-not-found');
	});
});

describe('fitFootprintToDetails', () => {
	/** The top spans x -400..0 and the bowl's arcs reach x 150..350, both y -100..100. */
	it('writes the typed rectangle around every detail’s curve-aware extent, and changes nothing else', () => {
		const before = scaledShape({ footprintOrigin: 'traced', footprintPending: true });
		const fitted = expectOk(fitFootprintToDetails(before));
		expect(fitted.footprint.points).toEqual([
			{ x: expect.closeTo(-400, 9), y: expect.closeTo(-100, 9) },
			{ x: expect.closeTo(350, 9), y: expect.closeTo(-100, 9) },
			{ x: expect.closeTo(350, 9), y: expect.closeTo(100, 9) },
			{ x: expect.closeTo(-400, 9), y: expect.closeTo(100, 9) },
		]);
		expect([fitted.footprintOrigin, fitted.footprintPending]).toEqual(['typed', false]);
		expect([fitted.clearance, fitted.details, fitted.anchor]).toEqual([before.clearance, before.details, before.anchor]);
	});

	it('refuses a shape with no details', () => {
		expect(expectErr(fitFootprintToDetails(editableShape({ details: [] }))).code).toBe('asset.no-details');
	});

	it('refuses while any detail is still in background pixels', () => {
		expect(expectErr(fitFootprintToDetails(editableShape())).code).toBe('asset.details-await-scale');
	});

	it('refuses a detail whose outline cannot be measured', () => {
		const broken: AssetShape = {
			...scaledShape(),
			details: [{ id: 'detail-1', name: 'broken', line: 'solid', pending: false, outline: { points: [{ x: Number.NaN, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }] } }],
		};
		expect(expectErr(fitFootprintToDetails(broken)).code).toBe('asset.invalid-detail');
	});
});
