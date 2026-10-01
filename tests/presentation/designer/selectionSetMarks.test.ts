/**
 * @vitest-environment jsdom
 *
 * AD18 UI critique, Task 2: a multi-selection draws EVERY member, as data. `selectionSetMarks` restrokes
 * each drawn member but the primary (whose restroke and handles `selectionMarks` already draws) and, for
 * two or more drawn members, one dashed frame round their combined box — the box `Align to: The selection
 * bounds` aligns to. The expected box here is the domain's own `detailBox`, never the module's arithmetic.
 * `designerMultiSelectionMarks.test.ts` holds the mounted canvas to the same answer.
 */
import { describe, expect, it } from 'vitest';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { detailBox } from '../../../src/domain/asset/detailEdits';
import { groupDetails } from '../../../src/domain/asset/groupEdits';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues } from '../../../src/domain/asset/presets/presetGeometry';
import type { OutlinePart } from '../../../src/domain/asset/shapeEdits';
import { selectionMarks, selectionSetMarks } from '../../../src/presentation/designer/layers/selectionLayer';
import { resolveThemeTokens } from '../../../src/presentation/editor/theme/themeTokens';
import { editableShape, shapeWithOpenGraphic } from '../../helpers/assetShapes';
import { expectDefined, expectOk } from '../../helpers/domain';

const TOKENS = resolveThemeTokens(document.documentElement);
const EMPTY = { outlines: [], bounds: null };

const membersOf = (shape: AssetShape): OutlinePart[] => shape.details.map((detail) => ({ kind: 'detail', id: detail.id }));
const marksOf = (shape: AssetShape, members: readonly OutlinePart[]) => selectionSetMarks(shape, members, members.at(-1) ?? null, TOKENS, 1);

/** The union of the members' `detailBox`es, as the frame's four corners, clockwise from the top-left. */
function unionCorners(shape: AssetShape, members: readonly OutlinePart[]): number[] {
	const boxes = members.map((member) => expectOk(detailBox(expectDefined(shape.details.find((detail) => member.kind === 'detail' && detail.id === member.id), 'a member'))));
	const [minX, minY] = [Math.min(...boxes.map((box) => box.min.x)), Math.min(...boxes.map((box) => box.min.y))];
	const [maxX, maxY] = [Math.max(...boxes.map((box) => box.max.x)), Math.max(...boxes.map((box) => box.max.y))];
	return [minX, minY, maxX, minY, maxX, maxY, minX, maxY];
}

/** The widest gap between the drawn frame's corners and `unionCorners`; `Infinity` for no frame or a frame of another arity. */
function frameGap(shape: AssetShape, members: readonly OutlinePart[]): number {
	const points = marksOf(shape, members).bounds?.points ?? [];
	const expected = unionCorners(shape, members);
	return points.length === 8 ? Math.max(...points.map((value, index) => Math.abs(value - expected[index]))) : Infinity;
}

/** What each member but the primary would be restroked as ALONE, which is what a set must draw for it. */
const restrokedAlone = (shape: AssetShape, members: readonly OutlinePart[]) =>
	members.slice(0, -1).map((member) => selectionMarks(shape, member, 'transform', TOKENS, 1).outline);

const PRESET_SHAPES = ASSET_PRESETS.map((preset) => [preset.id, expectOk(preset.build(defaultValues(preset)))] as const);
const SETS = PRESET_SHAPES.filter(([, shape]) => shape.details.length >= 2);
const SINGLES = PRESET_SHAPES.filter(([, shape]) => shape.details.length < 2);

describe.each(PRESET_SHAPES)('a selection on the %s preset', (_id, shape) => {
	it('restrokes every selected graphic but the primary, as each is restroked alone', () => {
		const members = membersOf(shape);
		expect(marksOf(shape, members).outlines).toEqual(restrokedAlone(shape, members));
	});

	it('draws no set mark for the footprint or the clearance selected alone — they never join a set (C05)', () => {
		for (const part of [{ kind: 'footprint' }, { kind: 'clearance' }] as const) {
			expect(selectionSetMarks(shape, [part], part, TOKENS, 1)).toEqual(EMPTY);
		}
	});
});

it.each(SETS)('frames every graphic of the %s preset selected together, and every pair of them', (_id, shape) => {
	const members = membersOf(shape);
	const pairs = members.flatMap((first, index) => members.slice(index + 1).map((second) => [first, second]));
	expect(frameGap(shape, members)).toBeLessThan(1e-6);
	expect(pairs.map((pair) => frameGap(shape, pair)).every((gap) => gap < 1e-6)).toBe(true);
});

it.each(SINGLES)('draws no frame round the %s preset’s only graphic', (_id, shape) => {
	expect(marksOf(shape, membersOf(shape)).bounds).toBeNull();
});

it('covers presets with two or more graphics, so the frame cases above are not vacuous', () => {
	expect(SETS.length).toBeGreaterThan(5);
});

describe('selectionSetMarks', () => {
	it('draws nothing with no shape, or with nothing drawn selected', () => {
		expect(selectionSetMarks(null, membersOf(editableShape()), null, TOKENS, 1)).toEqual(EMPTY);
		expect(selectionSetMarks(editableShape(), [], null, TOKENS, 1)).toEqual(EMPTY);
	});

	it('draws no frame round ONE member, at any zoom', () => {
		const one: OutlinePart[] = [{ kind: 'detail', id: 'detail-1' }];
		expect(selectionSetMarks(editableShape(), one, one[0], TOKENS, 1)).toEqual(EMPTY);
		expect(selectionSetMarks(editableShape(), one, one[0], TOKENS, 10)).toEqual(EMPTY);
	});

	/** The Plan Editor's transform-box outline: the accent, 1 px, dashed 4/3, closed, taking no press. */
	it('draws the frame thin, dashed and in the accent, and takes no press', () => {
		expect(marksOf(editableShape(), membersOf(editableShape())).bounds).toMatchObject({
			closed: true, stroke: TOKENS.accent, strokeWidth: 1, strokeScaleEnabled: false, listening: false, perfectDrawEnabled: false, dash: [4, 3],
		});
	});

	it('keeps each member’s own dash on its restroke, and a curved member’s reach in the frame', () => {
		const shape = editableShape();
		const members = membersOf(shape).toReversed(); // the dashed, curved bowl is the OTHER member
		expect(marksOf(shape, members).outlines[0]?.dash).toEqual([4, 3]);
		expect(frameGap(shape, members)).toBeLessThan(1e-6);
	});

	it('frames an OPEN graphic by the reach of its line, and restrokes it open', () => {
		const shape = shapeWithOpenGraphic();
		const members = membersOf(shape).toReversed();
		expect(marksOf(shape, members).outlines.map((outline) => outline.closed)).toEqual([false, true]);
		expect(marksOf(shape, members).outlines).toEqual(restrokedAlone(shape, members));
		expect(frameGap(shape, members)).toBeLessThan(1e-6);
	});

	it('draws a grouped set exactly as the same set ungrouped — grouping moves no geometry (C06)', () => {
		const loose = editableShape();
		const grouped = expectOk(groupDetails(loose, ['detail-1', 'detail-2']));
		const members = membersOf(loose);
		expect(grouped.groups).toHaveLength(1);
		expect(marksOf(grouped, members)).toEqual(marksOf(loose, members));
		expect(frameGap(grouped, members)).toBeLessThan(1e-6);
	});

	/**
	 * The primary not drawn (hidden in Parts): `drawnSelection` answers `null` for it, so the canvas hands
	 * `null` as the primary and every drawn member is restroked here, none left to `selectionMarks`.
	 */
	it('restrokes every member when the primary is not drawn', () => {
		const shape = editableShape();
		const members = membersOf(shape);
		expect(selectionSetMarks(shape, members, null, TOKENS, 1).outlines).toEqual(members.map((member) => selectionMarks(shape, member, 'transform', TOKENS, 1).outline));
	});

	/** A member the shape no longer carries (a refresh in flight): no restroke, and no frame round the one that is left. */
	it('skips a member the shape has not got, in the restroke and the frame', () => {
		const members: OutlinePart[] = [{ kind: 'detail', id: 'detail-9' }, { kind: 'detail', id: 'detail-1' }];
		expect(marksOf(editableShape(), members)).toEqual(EMPTY);
	});
});
