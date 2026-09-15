import { wallLength, type Opening, type Wall } from '../../../domain/spatial/Structure';

/** Fractions of the reference line with a solid wall face, excluding hosted opening spans. */
export function wallSolidRanges(wall: Wall, openings: readonly Opening[]): readonly (readonly [number, number])[] {
	const length = wallLength(wall), ranges: [number, number][] = []; let cursor = 0;
	for (const opening of openings.filter(item => item.hostId === wall.id).toSorted((a, b) => a.offset - b.offset)) {
		if (opening.offset > cursor) ranges.push([cursor / length, opening.offset / length]);
		cursor = Math.max(cursor, opening.offset + opening.width);
	}
	if (cursor < length) ranges.push([cursor / length, 1]);
	return ranges;
}
