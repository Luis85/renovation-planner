import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { scaleDesignToDimensions, type OutlinePart } from '../../../domain/asset/shapeEdits';
import { tr } from '../../i18n/strings';
import { notifyWarning } from '../../notices/notify';
import type { EditShape } from './editShape';
import { partMeasure, type PartBox } from './partExtent';

/**
 * A TYPED size that lands away from the number typed says so (AD18-R24). A size a part cannot reach lands
 * where `solveScale` leaves it, which is not the typed value, and before this nothing said so beyond the
 * figures reading back a different number. Each door that types a Width, a Depth or a whole-design size
 * dispatches through `landTyped`: the inspector's Width and Depth, the canvas's size labels, and Set
 * dimensions' scaling path. Set dimensions' other path writes a rectangle at the typed numbers, which has
 * nothing to miss. A box-handle drag does not come here, because the pointer is its feedback, so a drag and a
 * typed size still land the same numbers (AD18-R23) and the typed one alone warns.
 *
 * The warning OBSERVES what landed and changes nothing about it: the landed shape is measured the way the
 * door measured the part it resized (`partMeasure`, the curve-aware box), per typed axis, and only after the
 * write resolved ok. A refusal keeps its own message, and an edit that answered `null` (C03's no-op) wrote
 * nothing, so it has nothing to report.
 */

/** A typed size: the part it resizes, and the extent typed for each axis the door types. */
export interface TypedSize {
	readonly part: OutlinePart;
	readonly width?: number;
	readonly depth?: number;
}

/** How far a landed extent may sit from the typed one unremarked: the inspector shows whole millimetres. */
const MISS_MM = 0.5;

const AXES = ['width', 'depth'] as const;

/** `edit` dispatched through `editShape`, then a warning naming the size that landed when it misses `typed`. */
export async function landTyped(editShape: EditShape, typed: TypedSize, edit: Parameters<EditShape>[0]): Promise<DispatchResult> {
	// A holder rather than a `let`: a local assigned inside the callback narrows to `null` at every later read.
	const landed: { shape: AssetShape | null } = { shape: null };
	const result = await editShape((shape) => {
		const next = edit(shape);
		landed.shape = next?.ok === true ? next.value : null;
		return next;
	});
	if (!result.ok || landed.shape === null) return result;
	// The edit just resized this part on this very shape, so it is there to measure.
	const box = partMeasure(landed.shape, typed.part) as PartBox;
	if (AXES.some((axis) => typed[axis] !== undefined && Math.abs(box[axis] - typed[axis]) > MISS_MM)) {
		notifyWarning(tr('designer.typed-size.landed', { width: String(Math.round(box.width)), depth: String(Math.round(box.depth)) }));
	}
	return result;
}

/** Set dimensions' SCALING path: the whole design scaled until its footprint measures `width` x `depth`. */
export function landDimensions(editShape: EditShape, width: number, depth: number): Promise<DispatchResult> {
	return landTyped(editShape, { part: { kind: 'footprint' }, width, depth }, (shape) => scaleDesignToDimensions(shape, width, depth));
}
