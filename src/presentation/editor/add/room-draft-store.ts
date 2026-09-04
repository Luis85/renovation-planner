import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createPolygon, type Polygon } from '../../../core/geometry/Polygon';
import type { Point } from '../../../core/geometry/Point';
import { isOk } from '../../../core/result/Result';
import { formatMetres, parseMetres, type LengthRefusal } from '../shell/formatLength';
import { formatArea } from '../shell/formatArea';
import { tr } from '../../i18n/strings';

/** World millimetres; `x, y` is the min corner (design spec §3). */
export interface RoomRect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly depth: number;
}

export type DimensionAxis = 'width' | 'depth';

/**
 * Four points, clockwise from the min corner. `createPolygon`'s refusal (a non-finite
 * coordinate) is unreachable from a `rect` built out of two `parseMetres` results or a
 * caller's own finite drag rectangle — but the store's `geometry` getter is what
 * `RoomDraftPort`'s consumer reads, so the refusal is represented rather than assumed away
 * with a cast, and `roomDraftStore.test.ts` drives it directly with a non-finite side.
 * A module-level pure function rather than an inline body, so the store's own setup
 * function — one action per gesture the drag and the two numeric fields can make — stays
 * under the 100-line function budget.
 */
function polygonForRect(r: RoomRect): Polygon | null {
	const result = createPolygon([
		{ x: r.x, y: r.y },
		{ x: r.x + r.width, y: r.y },
		{ x: r.x + r.width, y: r.y + r.depth },
		{ x: r.x, y: r.y + r.depth },
	]);
	return isOk(result) ? result.value : null;
}

/**
 * The three pieces of truth as one rectangle, or `null` while there is no rectangle to have.
 *
 * **A side that is not POSITIVE is refused HERE rather than at `valid`, and that is a
 * decision.** Design spec §2.7 states the rule as `parseMetres`'s three refusals, so the
 * numeric route never puts a zero into `widthMm`/`depthMm` at all (a typed `0` is
 * `not-positive` and the side keeps its previous value); the DRAG route has no such door — a
 * drag straight along one axis clears `DrawRoomTool`'s click epsilon and settles with a depth
 * of exactly 0 — and `createPolygon` validates only the count and the finiteness of the
 * coordinates, so a zero-area quadrilateral passed it, passed `Zone.create` behind it, and was
 * written. Refusing at `rect` rather than at `valid` is what makes the two routes agree about
 * what a rectangle IS: `geometry`, `areaMm2`, `valid`, `settle()`, `RoomDraftSketch` and
 * `DrawRoomTool.hasDraft()` all read `rect`, so one answer settles all six — where a guard on
 * `valid` alone would draw a flat outline, announce a 0 m² sentence and print an area, beside
 * a Create button the user cannot press and nothing saying why.
 *
 * `> 0` rather than `!== 0` on purpose: it refuses a negative side (`setRect` is a public port
 * method, even though `normalised` hands it absolutes) and a `NaN` one in the same test.
 * `Infinity` passes it and is refused one step later by `polygonForRect`, which is what keeps
 * that refusal reachable.
 *
 * A module-level pure function beside `polygonForRect` and for its reason: the setup function
 * below has a 100-line budget.
 *
 * The class this belongs to is the one `CLAUDE.md` already records as open — three COLLINEAR
 * vertices are a zero-area polygon that nothing refuses, and closing it is a change to
 * `createPolygon` (SDD §26 files degeneracy under "Future"). This closes the rectangular case
 * at the one door that can see it, and claims nothing wider.
 */
function rectFrom(corner: Point | null, width: number | null, depth: number | null): RoomRect | null {
	if (corner === null || width === null || depth === null) return null;
	return width > 0 && depth > 0 ? { x: corner.x, y: corner.y, width, depth } : null;
}

/** The sentence `settle()` writes to `settledSize` (§5.4); the copy key is this task's own. */
function settledSentenceFor(r: RoomRect): string {
	return tr('editor.room.settled', {
		width: formatMetres(r.width),
		depth: formatMetres(r.depth),
		area: formatArea(r.width * r.depth),
	});
}

/** The numeric route's min corner: `placeAt()` names the CENTRE, this the corner from it. */
function centeredOrigin(centre: Point, width: number, depth: number): Point {
	return { x: centre.x - width / 2, y: centre.y - depth / 2 };
}

/**
 * The one rectangle a user is drawing or typing, written from two surfaces (design spec
 * §2.2): the canvas drag calls `setRect`, the Inspector's two numeric fields call
 * `commitDimension`, and both read the same `rect`/`geometry`/`valid` so "dragging and
 * typing converge on the same creation command" is a fact about this store's shape rather
 * than a test's assertion. One instance per leaf, like every editor store.
 *
 * `origin`, `widthMm` and `depthMm` are the three pieces of truth; `rect` is null until all
 * three are known AND both sides are positive (`rectFrom` above carries that second half and
 * the reason it lives there). The numeric route can know one side before the other (a user tabs from
 * width to depth), so `origin` is deferred until BOTH sides exist — there is no reasonable
 * min corner for a rectangle whose depth is still unknown — and is then centred on
 * `placeAt()`, a thunk rather than a stored point because the store may not know the
 * viewport (§3, "a room typed with no pointer at all lands where the user is looking").
 *
 * `widthText`/`depthText` are what the field shows, independent of whether the last commit
 * was accepted: a refused value stays on screen verbatim, with its reason in
 * `widthError`/`depthError`, so the user's own typing is never silently replaced. `setRect`
 * is the one writer that reformats both texts into canonical metres, because a drag never
 * had a text to preserve.
 */
export const useRoomDraftStore = defineStore('editor-room-draft', () => {
	const origin = ref<Point | null>(null);
	const widthMm = ref<number | null>(null);
	const depthMm = ref<number | null>(null);
	const name = ref('');
	/**
	 * RESERVED, and read by NOTHING in `src/` today. Measured in the edit that wrote this:
	 * `grep -rn "nameTouched" src/` prints FIVE lines, and not one is a read — this docblock's
	 * own mention (self-matching, so it is named rather than counted silently), the
	 * declaration, `beginTask`'s reset, `setName`'s set, and the store's own return list. Its
	 * only reader anywhere is `roomDraftStore.test.ts`.
	 *
	 * It is kept rather than deleted because the property it records is the one design spec
	 * §2.4 states: the counted default is applied by `beginTask` alone, so "a name the
	 * renovator edited is never overwritten" holds today because NOTHING RE-APPLIES A
	 * DEFAULT — a stronger fact than the flag, and the one the criterion is actually
	 * discharged by. The flag is what a re-apply would have to ask. Its first reader is the
	 * increment that gives one a producer: a room TYPE that suggests a name when the type
	 * changes, which is [[Suggest a localized Room name from its type]]'s own deferred half.
	 *
	 * If that increment is abandoned, delete the flag rather than leaving a field three
	 * writers keep current for nobody — this repository's own rule about an event minted with
	 * no subscriber, applied to a ref.
	 */
	const nameTouched = ref(false);
	const keepAdding = ref(false);
	const widthText = ref('');
	const depthText = ref('');
	const widthError = ref<LengthRefusal | null>(null);
	const depthError = ref<LengthRefusal | null>(null);
	const settledSize = ref<string | null>(null);
	const submitting = ref(false);

	const rect = computed<RoomRect | null>(() => rectFrom(origin.value, widthMm.value, depthMm.value));
	const geometry = computed<Polygon | null>(() => (rect.value === null ? null : polygonForRect(rect.value)));
	const areaMm2 = computed<number | null>(() => (rect.value === null ? null : rect.value.width * rect.value.depth));
	const valid = computed<boolean>(
		() =>
			rect.value !== null && name.value.trim() !== '' && widthError.value === null && depthError.value === null && !submitting.value,
	);

	/**
	 * Escape's writer (§3): origin/width/depth/texts/errors cleared; name and keepAdding
	 * kept. `settledSize` goes with the rect it described — the sentence names a rect that
	 * no longer exists once `origin` is null, and `settle()`'s own contract ("the sentence
	 * for rect, or null") says so, so this belongs to the function rather than to whichever
	 * caller remembers to re-invoke `settle()`.
	 */
	function clearRect(): void {
		origin.value = null;
		widthMm.value = depthMm.value = null;
		widthText.value = depthText.value = '';
		widthError.value = depthError.value = null;
		settledSize.value = null;
	}

	function beginTask(defaultName: string): void {
		clearRect();
		submitting.value = false;
		name.value = defaultName;
		nameTouched.value = false;
		keepAdding.value = false;
	}

	/** The drag's writer: origin, width, depth; texts re-formatted into canonical metres. */
	function setRect(next: RoomRect): void {
		origin.value = { x: next.x, y: next.y };
		widthMm.value = next.width;
		depthMm.value = next.depth;
		widthText.value = formatMetres(next.width);
		depthText.value = formatMetres(next.depth);
		widthError.value = depthError.value = null;
	}

	function reset(): void {
		clearRect();
		name.value = '';
		keepAdding.value = false;
	}

	function setName(text: string): void {
		name.value = text;
		nameTouched.value = true;
	}

	/** An explicit gesture (a suggestion button), same effect as typing today. */
	const suggestName = setName;

	function settle(): void {
		settledSize.value = rect.value === null ? null : settledSentenceFor(rect.value);
	}

	/**
	 * Parse; on refusal keep the typed text and name the reason. On success set the side,
	 * clear its error, and — once BOTH sides are known and no origin exists yet — place the
	 * rect centred on `placeAt()`. Either way, re-announce the settled sentence.
	 */
	function commitDimension(axis: DimensionAxis, text: string, placeAt: () => Point): void {
		const parsed = parseMetres(text);
		if (axis === 'width') widthText.value = text;
		else depthText.value = text;

		if (!parsed.ok) {
			if (axis === 'width') widthError.value = parsed.reason;
			else depthError.value = parsed.reason;
			return;
		}

		if (axis === 'width') {
			widthMm.value = parsed.mm;
			widthError.value = null;
		} else {
			depthMm.value = parsed.mm;
			depthError.value = null;
		}
		if (origin.value === null && widthMm.value !== null && depthMm.value !== null) {
			origin.value = centeredOrigin(placeAt(), widthMm.value, depthMm.value);
		}
		settle();
	}

	function setKeepAdding(flag: boolean): void {
		keepAdding.value = flag;
	}

	function setSubmitting(flag: boolean): void {
		submitting.value = flag;
	}

	return {
		origin, widthMm, depthMm, name, nameTouched, keepAdding, widthText, depthText,
		widthError, depthError, settledSize, submitting, rect, geometry, areaMm2, valid,
		beginTask, setRect, clearRect, reset, setName, suggestName, commitDimension, settle,
		setKeepAdding, setSubmitting,
	};
});

export type RoomDraftStore = ReturnType<typeof useRoomDraftStore>;

/**
 * What the drawing tool needs — nothing about names or fields (design spec §3, the free-form
 * increment's plug point). Task 3's tool depends on exactly this shape.
 */
export type RoomDraftPort = Pick<RoomDraftStore, 'rect' | 'setRect' | 'clearRect' | 'reset' | 'beginTask' | 'settle'>;
