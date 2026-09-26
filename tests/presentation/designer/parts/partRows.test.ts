import { describe, expect, it } from 'vitest';
import { partRows, type PartRow } from '../../../../src/presentation/designer/parts/partRows';
import { validateAssetShape, type AssetShape } from '../../../../src/domain/asset/AssetShape';
import { editableShape, shapeWithOpenGraphic } from '../../../helpers/assetShapes';
import { expectOk } from '../../../helpers/domain';

/**
 * AD09's row model: the Parts panel's list, derived from one validated shape and nothing else.
 *
 * Pure on purpose — the ORDER is the part of this panel that can go wrong invisibly, and a rule
 * about order asked of a mounted component is a rule checked through markup. `editableShape`
 * carries `detail-1` ("top") and `detail-2` ("bowl"), a clearance, an anchor and a facing.
 */
const kinds = (rows: readonly PartRow[]): string[] => rows.map((row) => row.kind);
const keys = (rows: readonly PartRow[]): string[] => rows.map((row) => row.key);

const grouped = (shape: AssetShape, ...members: string[][]): AssetShape =>
	expectOk(validateAssetShape({ ...shape, groups: members.map((ids, index) => ({ id: `group-${String(index + 1)}`, members: ids })) }));

describe('partRows', () => {
	it('has no rows at all for an asset with no shape, which is the panel’s empty state', () => {
		expect(partRows(null, { hasReference: false })).toEqual([]);
	});

	/**
	 * **Graphics TOPMOST first, then the object's own parts.** `details` is a bottom-up draw order —
	 * `reorderDetail`'s `forward` moves a graphic one LATER in the array, where it draws over its
	 * neighbour — and `hitDesign` picks the last match for the same reason. Listing the array as
	 * stored would put the graphic a user sees on top at the bottom of the panel, and Bring forward
	 * would move its row down. The array is untouched; only the reading direction is chosen.
	 */
	it('lists the topmost graphic first, then the footprint, clearance, placement and reference', () => {
		const rows = partRows(editableShape(), { hasReference: true });

		expect(keys(rows)).toEqual(['detail:detail-2', 'detail:detail-1', 'footprint', 'clearance', 'anchor', 'facing', 'reference']);
		expect(kinds(rows)).toEqual(['detail', 'detail', 'footprint', 'clearance', 'anchor', 'facing', 'reference']);
	});

	it('omits the clearance row when there is none and the reference row when none is picked', () => {
		expect(keys(partRows(editableShape({ clearance: null, clearancePending: false }), { hasReference: false }))).toEqual([
			'detail:detail-2',
			'detail:detail-1',
			'footprint',
			'anchor',
			'facing',
		]);
	});

	it('gives every row but a group header and the reference the part it selects', () => {
		const rows = partRows(editableShape(), { hasReference: true });

		expect(rows.map((row) => row.selection)).toEqual([
			{ kind: 'detail', id: 'detail-2' },
			{ kind: 'detail', id: 'detail-1' },
			{ kind: 'footprint' },
			{ kind: 'clearance' },
			{ kind: 'anchor' },
			{ kind: 'facing' },
			null,
		]);
	});

	it('hands a graphic row the graphic itself, so a name, a label and a kind are read off one object', () => {
		const rows = partRows(shapeWithOpenGraphic(), { hasReference: false });

		expect(rows[0].detail?.id).toBe('detail-3');
		expect(rows[0].detail?.kind).toBe('open');
		expect(rows[1].detail?.name).toBe('bowl');
		expect(rows.slice(3).every((row) => row.detail === null)).toBe(true);
	});

	/**
	 * C06: a group is editing metadata, never a second ordering authority. Its header sits at its
	 * TOPMOST member and the members keep their own places, so a group holding the first and third
	 * graphics stays interleaved with the second — the contract's own words — rather than being
	 * gathered into a block the array does not have.
	 */
	it('heads a group at its topmost member and leaves interleaved members interleaved', () => {
		const base = editableShape();
		const three = expectOk(validateAssetShape({ ...base, details: [...base.details, { ...base.details[0], id: 'detail-3', name: 'lid' }] }));
		const rows = partRows(grouped(three, ['detail-1', 'detail-3']), { hasReference: false });

		expect(keys(rows).slice(0, 4)).toEqual(['group:group-1', 'detail:detail-3', 'detail:detail-2', 'detail:detail-1']);
		expect(rows.map((row) => row.groupId).slice(0, 4)).toEqual(['group-1', 'group-1', null, 'group-1']);
	});

	/**
	 * `AssetShape.groups` is OPTIONAL in the type — every construction site written before AD04 leaves
	 * it out and reads as no groups — so a shape without it is a shape this function is handed, not a
	 * hypothetical. `validateAssetShape` always fills it in, which is exactly why the case has to build
	 * the shape by hand to reach the arm at all.
	 */
	it('reads a shape with no groups property at all as a shape with no groups', () => {
		const { groups: _groups, ...ungrouped } = editableShape();

		expect(partRows(ungrouped, { hasReference: false }).every((row) => row.kind !== 'group')).toBe(true);
	});

	it('carries a group’s own label on its header row', () => {
		const shape = expectOk(validateAssetShape({ ...editableShape(), groups: [{ id: 'group-1', label: 'Cistern', members: ['detail-1'] }] }));

		expect(partRows(shape, { hasReference: false }).find((row) => row.kind === 'group')?.label).toBe('Cistern');
	});
});
