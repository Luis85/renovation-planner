import { defineStore } from 'pinia';
import { computed, ref, type Ref } from 'vue';
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
 * what a rectangle IS: `geometry`, `areaMm2`, `complete`, `settle()` and `RoomDraftSketch`
 * all read `rect`, so one answer settles all five — where a guard on `valid` alone would draw a
 * flat outline, announce a 0 m² sentence and print an area, beside a Create button the user
 * cannot press and nothing saying why. (`DrawRoomTool.hasDraft()` was a sixth reader and is not
 * any more: Escape asks `hasInput`, which is about every surface rather than the rectangle.)
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

/**
 * The seven refs `setRect` writes, as ONE bundle.
 *
 * **A press on the canvas has exactly one writer, and this is its list** — which is what makes
 * a press reversible: `DrawRoomTool` takes a snapshot at `pointerdown` and restores it when the
 * gesture turns out to have been a click (or is taken away), so what it gives back is exactly
 * what the press could have clobbered and nothing else. It used to hand back a `RoomRect | null`
 * instead, which cannot express a half-typed draft at all — width known, depth not, so `rect` is
 * null while two fields and one text hold real input — and restoring from it therefore ran
 * `clearRect()` over a typed width, or `setRect()` over a value the store had refused and the
 * renovator had not yet corrected.
 *
 * `settledSize` is deliberately outside the bundle, because `setRect` never touches it: a press
 * cannot have moved it, so a restore has nothing to put back.
 */
interface RectFields {
	readonly origin: Ref<Point | null>;
	readonly widthMm: Ref<number | null>;
	readonly depthMm: Ref<number | null>;
	readonly widthText: Ref<string>;
	readonly depthText: Ref<string>;
	readonly widthError: Ref<LengthRefusal | null>;
	readonly depthError: Ref<LengthRefusal | null>;
}

/** `RectFields`'s seven values, detached from their refs — what a snapshot IS. */
export interface RoomRectSnapshot {
	readonly origin: Point | null;
	readonly widthMm: number | null;
	readonly depthMm: number | null;
	readonly widthText: string;
	readonly depthText: string;
	readonly widthError: LengthRefusal | null;
	readonly depthError: LengthRefusal | null;
}

/** The state a task starts in, and the one `clearRect` puts it back into. */
const NO_RECT: RoomRectSnapshot = {
	origin: null, widthMm: null, depthMm: null, widthText: '', depthText: '', widthError: null, depthError: null,
};

/** A drag's own values: both sides, both texts in canonical metres, and neither error. */
function fieldsForRect(r: RoomRect): RoomRectSnapshot {
	return {
		origin: { x: r.x, y: r.y },
		widthMm: r.width,
		depthMm: r.depth,
		widthText: formatMetres(r.width),
		depthText: formatMetres(r.depth),
		widthError: null,
		depthError: null,
	};
}

function snapshotOf(f: RectFields): RoomRectSnapshot {
	return {
		origin: f.origin.value,
		widthMm: f.widthMm.value,
		depthMm: f.depthMm.value,
		widthText: f.widthText.value,
		depthText: f.depthText.value,
		widthError: f.widthError.value,
		depthError: f.depthError.value,
	};
}

/**
 * The one writer that moves ALL SEVEN at once — `setRect`, `clearRect` and a restore each go
 * through it, so a field added to `RectFields` is written by every one of them or by none.
 * `commitDimension` deliberately does not: it writes one axis at a time and leaves the other
 * alone, which is what a numeric field means.
 */
function restoreInto(f: RectFields, s: RoomRectSnapshot): void {
	f.origin.value = s.origin;
	f.widthMm.value = s.widthMm;
	f.depthMm.value = s.depthMm;
	f.widthText.value = s.widthText;
	f.depthText.value = s.depthText;
	f.widthError.value = s.widthError;
	f.depthError.value = s.depthError;
}

/**
 * Whether this task holds anything Escape's own writer could take back — what
 * `DrawRoomTool.hasDraft()` answers `routeEscape` with. It used to read `rect !== null`, which
 * saw one of the surfaces a room is built from: choosing a name and typing ONE side leaves
 * `rect` null (`rectFrom` needs both), so Escape skipped its cancel-the-draft arm entirely, left
 * the task through `setTool('select')` and took the name, both texts and `keepAdding` with it —
 * while the same keypress over a DRAGGED rectangle only cleared the rectangle and stayed. One
 * gesture, two answers, decided by which surface the renovator had reached for.
 *
 * **The invariant is that this counts EXACTLY what `clearRect` clears, and both directions of
 * that are load-bearing.** Count LESS and Escape destroys the task where it should have cleared
 * the draft, which is the defect above. Count MORE — anything `clearRect` deliberately keeps —
 * and Escape goes INERT: `routeEscape` would answer `cancelled-draft` for ever and never reach
 * its return-to-Select arm, so a second press could not leave the task. So the two are stated
 * against each other rather than each on its own, and `roomDraftStore.test.ts` asserts the
 * round trip (anything that makes this true is false again after `clearRect`) rather than a
 * list.
 *
 * What that excludes, and why each exclusion is the right half of the invariant rather than an
 * oversight:
 *
 * - the NAME, which design spec §3 and §9 both keep across Escape ("origin/width/depth/texts/
 *   errors cleared; name and keepAdding kept"). It is not lost by excluding it: a renovator who
 *   chose "Kitchen" and typed a side is already counted through that side's text, so Escape
 *   clears the rectangle and the name survives — which is what `escapeRouting.ts` means by
 *   stepping back through the NEAREST interaction. With only a name and nothing drawn there is
 *   no draft to cancel, and Escape does what it does for any creation tool with nothing drawn:
 *   returns to Select. Counting the name instead would have forced `clearRect` to reset it to
 *   the counted default on every Escape, taking a choice the renovator made for a gesture
 *   aimed at the rectangle.
 * - `keepAdding`: a mode for the TASK ("after this one, start another"), which `clearRect`
 *   keeps and `createRoomFromDraft` re-applies across a creation.
 * - `rect` itself, because it is already covered: a rectangle exists only where `setRect` wrote
 *   both texts from `formatMetres`, which is never empty for a side `rectFrom` accepts.
 */
function holdsInput(f: RectFields): boolean {
	return (
		f.widthText.value !== '' ||
		f.depthText.value !== '' ||
		f.widthError.value !== null ||
		f.depthError.value !== null
	);
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
	 * RESERVED, and read by NOTHING in `src/`. Measured in the edit that wrote this:
	 * `grep -rn "nameTouched" src/` prints five lines and not one is a read — this docblock's own
	 * mention (self-matching, so it is named rather than counted silently), the declaration,
	 * `beginTask`'s reset, `setName`'s set, and the store's own return list. Its only reader
	 * anywhere is `roomDraftStore.test.ts`.
	 *
	 * **It briefly had one and gave it back, which is worth recording rather than quietly
	 * reverting.** The Escape fix above reached for this flag to tell a CHOSEN name from the
	 * counted default, so that `holdsInput` could count the name — and counting the name is what
	 * would have forced Escape to reset it, against design spec §3. Narrowing `holdsInput` to
	 * what `clearRect` clears removed the need, so the flag is reserved again.
	 *
	 * It is kept rather than deleted because the property it records is the one design spec
	 * §2.4 states: the counted default is applied by `beginTask` alone, so "a name the renovator
	 * edited is never overwritten" holds today because NOTHING RE-APPLIES A DEFAULT — a stronger
	 * fact than the flag, and the one the criterion is actually discharged by. The flag is what a
	 * re-apply would have to ask. Its first reader is the increment that gives one a producer: a
	 * room TYPE that suggests a name when the type changes, which is
	 * [[Suggest a localized Room name from its type]]'s own deferred half.
	 *
	 * If that increment is abandoned, delete the flag rather than leaving a field three writers
	 * keep current for nobody — this repository's own rule about an event minted with no
	 * subscriber, applied to a ref.
	 */
	const nameTouched = ref(false);
	const keepAdding = ref(false);
	const widthText = ref('');
	const depthText = ref('');
	const widthError = ref<LengthRefusal | null>(null);
	const depthError = ref<LengthRefusal | null>(null);
	const settledSize = ref<string | null>(null);
	const submitting = ref(false);

	const rectFields: RectFields = { origin, widthMm, depthMm, widthText, depthText, widthError, depthError };

	const rect = computed<RoomRect | null>(() => rectFrom(origin.value, widthMm.value, depthMm.value));
	const geometry = computed<Polygon | null>(() => (rect.value === null ? null : polygonForRect(rect.value)));
	const areaMm2 = computed<number | null>(() => (rect.value === null ? null : rect.value.width * rect.value.depth));
	/**
	 * **`complete` and `valid` are two questions, and one value used to answer both.** `valid`
	 * is "pressing Create right now would run", so it ends `&& !submitting`; `complete` is "the
	 * draft is missing something", which a write in flight says nothing about. The surfaces
	 * were reading `valid` for BOTH, so for the whole of a vault write the form told the
	 * renovator to "size the room and give it a name first" about the very room it was writing.
	 */
	const complete = computed<boolean>(
		() => rect.value !== null && name.value.trim() !== '' && widthError.value === null && depthError.value === null,
	);
	const valid = computed<boolean>(() => complete.value && !submitting.value);
	const hasInput = computed<boolean>(() => holdsInput(rectFields));

	/**
	 * Escape's writer (§3): origin/width/depth/texts/errors cleared; name and keepAdding
	 * kept. `settledSize` goes with the rect it described — the sentence names a rect that
	 * no longer exists once `origin` is null, and `settle()`'s own contract ("the sentence
	 * for rect, or null") says so, so this belongs to the function rather than to whichever
	 * caller remembers to re-invoke `settle()`.
	 */
	function clearRect(): void {
		restoreInto(rectFields, NO_RECT);
		settledSize.value = null;
	}

	/**
	 * Bumped by `beginTask` and by `reset`, so anything holding an older value is holding a
	 * task the user has since left — the generation counter `DrawPolygonTool` and
	 * `CalibrateTool` each carry, for a path that crosses an `await` rather than a gesture.
	 *
	 * It exists because `createRoomFromDraft` awaits a vault write while Cancel stays live
	 * (deliberately — `roomCreation.ts`'s header argues that disabling Cancel mid-write
	 * strands a user behind a fault they cannot escape). So the continuation can resume into a
	 * task that is not the one it submitted, and without this it read the NEW task's
	 * `keepAdding` and either cleared a rectangle the user had just drawn or ended a task they
	 * had just started.
	 *
	 * A COUNTER rather than a boolean or an id: two successive tasks must be distinguishable
	 * from each other, not merely from "no task", and `keepAdding` restarts a task on the
	 * creation path itself — so `created` and `superseded` differ by whether the token moved,
	 * which a flag somebody has to clear could not express. Never reset to zero: `reset()`
	 * bumps it too, since a task cleared and re-entered is not the task that was submitted.
	 */
	const taskToken = ref(0);

	function beginTask(defaultName: string): void {
		clearRect();
		submitting.value = false;
		name.value = defaultName;
		nameTouched.value = false;
		keepAdding.value = false;
		taskToken.value += 1;
	}

	/** The drag's writer: origin, width, depth; texts re-formatted into canonical metres. */
	const setRect = (next: RoomRect): void => restoreInto(rectFields, fieldsForRect(next));

	/** What a press could clobber, taken before it starts. See `RectFields`. */
	const snapshotRect = (): RoomRectSnapshot => snapshotOf(rectFields);

	/** …and put back, when the press turns out to have been a click or is taken away. */
	const restoreRect = (snapshot: RoomRectSnapshot): void => restoreInto(rectFields, snapshot);

	/**
	 * `submitting` is cleared here for the reason `clearRect`'s own docblock states about
	 * `settledSize` — it belongs to the function rather than to whichever caller remembers to
	 * re-invoke it. `beginTask` cleared it and this did not, so Cancel during a write (which
	 * reaches here through the tool's `deactivate()`) left the flag set: the bump below makes
	 * `createRoomFromDraft`'s `finally` correctly decline to clear a flag it no longer owns, and
	 * nothing else ever did. The store was left permanently invalid, self-healing only because
	 * every route back into the room tool happens to run `beginTask`.
	 */
	function reset(): void {
		clearRect();
		name.value = '';
		keepAdding.value = false;
		submitting.value = false;
		taskToken.value += 1;
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
	 * Parse; on refusal keep the typed text and name the reason, and leave the announced
	 * sentence exactly as it is — a refused value never reaches `widthMm`/`depthMm`, so the
	 * rect that sentence names has not moved, and clearing it would retract something still
	 * true. On success set the side, clear its error, and — once BOTH sides are known and no
	 * origin exists yet — place the rect centred on `placeAt()`, then re-announce.
	 *
	 * This is gesture-agnostic on purpose: whether a blur or an Enter is an explicit-enough
	 * gesture to commit an unchanged field is a fact about the CONTROL, so that guard lives at
	 * `NewRoomInspector.vue`'s own blur handler rather than here (design spec §2.2 names two
	 * SURFACES, not two keystrokes).
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
		widthError, depthError, settledSize, submitting, taskToken, rect, geometry, areaMm2,
		complete, valid, hasInput,
		beginTask, setRect, snapshotRect, restoreRect, clearRect, reset, setName,
		suggestName, commitDimension, settle, setKeepAdding, setSubmitting,
	};
});

export type RoomDraftStore = ReturnType<typeof useRoomDraftStore>;

/**
 * What the drawing tool needs, and only that (design spec §3, the free-form increment's plug
 * point) — a port listing members nothing on the other side calls is the same gap between a
 * claim and a check this file's other docblocks are written to close.
 *
 * `rect` came off it: the tool asks `hasInput` instead, which is Escape's question about every
 * dimension surface rather than about the rectangle alone. `clearRect` stayed, and the two are
 * a PAIR rather than two members that happen to be here — `hasInput` counts exactly what
 * `clearRect` clears (`holdsInput`'s own docblock argues both directions), so the tool's
 * `hasDraft()`/`cancel()` are the two ends of one invariant. A press is taken back through
 * `snapshotRect`/`restoreRect` instead, which restore only what that press overwrote, where
 * `clearRect` is the whole draft.
 */
export type RoomDraftPort = Pick<
	RoomDraftStore,
	'hasInput' | 'setRect' | 'snapshotRect' | 'restoreRect' | 'clearRect' | 'reset' | 'beginTask' | 'settle'
>;
