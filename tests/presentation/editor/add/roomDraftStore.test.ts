import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
	useRoomDraftStore,
	type DimensionAxis,
	type RoomDraftPort,
	type RoomRect,
} from '../../../../src/presentation/editor/add/room-draft-store';

const centre = () => ({ x: 10_000, y: 6_000 });
const AXES: readonly DimensionAxis[] = ['width', 'depth'];

describe('RoomDraftStore', () => {
	beforeEach(() => setActivePinia(createPinia()));

	it('derives four points, clockwise from the min corner, and the area', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.setRect({ x: 1000, y: 2000, width: 4200, depth: 3800 });
		expect(draft.origin).toEqual({ x: 1000, y: 2000 });
		expect(draft.widthMm).toBe(4200);
		expect(draft.depthMm).toBe(3800);
		expect(draft.geometry?.points).toEqual([
			{ x: 1000, y: 2000 }, { x: 5200, y: 2000 }, { x: 5200, y: 5800 }, { x: 1000, y: 5800 },
		]);
		expect(draft.areaMm2).toBe(15_960_000);
		expect(draft.widthText).toBe('4.2');
		expect(draft.depthText).toBe('3.8');
	});

	it('is valid only with a rect, a non-blank name, no field error and no submit in flight', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		expect(draft.valid).toBe(false);
		draft.setRect({ x: 0, y: 0, width: 100, depth: 100 });
		expect(draft.valid).toBe(true);
		draft.setName('   ');
		expect(draft.valid).toBe(false);
		draft.setName('Kitchen');
		draft.commitDimension('width', 'x', centre);
		expect(draft.widthError).toBe('not-a-number');
		expect(draft.valid).toBe(false);
		draft.commitDimension('width', '4.2', centre);
		expect(draft.widthError).toBeNull();
		expect(draft.valid).toBe(true);
		expect(draft.submitting).toBe(false);
		draft.setSubmitting(true);
		expect(draft.submitting).toBe(true);
		expect(draft.valid).toBe(false);
	});

	it('a refused dimension keeps the typed text and names the reason; a correction clears it', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.commitDimension('depth', '-2', centre);
		expect(draft.depthText).toBe('-2');
		expect(draft.depthError).toBe('not-positive');
		expect(draft.rect).toBeNull();
		draft.commitDimension('depth', '2', centre);
		expect(draft.depthError).toBeNull();
	});

	/**
	 * **The consequence the round trip exists to prevent, driven the way a user meets it.**
	 * `setRect` fills the two editable fields from `formatMetres`, and their blur handler hands
	 * that text straight back through `parseMetres` — so focusing an untouched field and
	 * leaving it is a full encode/decode of a rectangle nobody edited. Two shapes broke it and
	 * each is a case below, because they fail differently and a single case would let the other
	 * through:
	 *
	 * - a 2 mm side printed `0` under `maximumFractionDigits: 2`, so an untouched blur refused
	 *   it as `not-positive` and a valid draft became uncreatable.
	 * - a 999,999 mm side printed `1,000` because `en-US` groups thousands while `parseMetres`
	 *   reads a comma as a decimal separator, so it came back as 1000 mm — the room silently
	 *   shrank by a factor of 1000, with no error anywhere.
	 *
	 * Asserted at the STORE rather than on the formatter (which has its own property case)
	 * because this is the reachable gesture: the numbers are only wrong once they have been
	 * through a control.
	 */
	it('a blur on an untouched field leaves a millimetre-scale side exactly as it was', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.setRect({ x: 0, y: 0, width: 2, depth: 5000 });

		draft.commitDimension('width', draft.widthText, centre);

		expect(draft.widthError).toBeNull();
		expect(draft.widthMm).toBe(2);
		expect(draft.rect).toEqual({ x: 0, y: 0, width: 2, depth: 5000 });
		expect(draft.valid).toBe(true);
	});

	it('a blur on an untouched field does not shrink a near-maximum side by a thousand', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.setRect({ x: 0, y: 0, width: 999_999, depth: 4000 });

		draft.commitDimension('width', draft.widthText, centre);

		expect(draft.widthError).toBeNull();
		expect(draft.widthMm).toBe(999_999);
	});

	it('the numeric route places a rect centred on placeAt() once both sides are known', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.commitDimension('width', '4.2', centre);
		expect(draft.rect).toBeNull();
		draft.commitDimension('depth', '3.8', centre);
		expect(draft.rect).toEqual({ x: 10_000 - 2100, y: 6_000 - 1900, width: 4200, depth: 3800 });
	});

	it('the numeric route centres the same way when depth is known before width', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.commitDimension('depth', '3.8', centre);
		expect(draft.rect).toBeNull();
		draft.commitDimension('width', '4.2', centre);
		expect(draft.rect).toEqual({ x: 10_000 - 2100, y: 6_000 - 1900, width: 4200, depth: 3800 });
	});

	it('a numeric commit over an existing rect keeps the min corner and changes one side', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.setRect({ x: 500, y: 700, width: 4200, depth: 3800 });
		draft.commitDimension('width', '5', centre);
		expect(draft.rect).toEqual({ x: 500, y: 700, width: 5000, depth: 3800 });
	});

	it('beginTask resets keepAdding and the name; clearRect keeps both; reset drops the name', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.setKeepAdding(true);
		draft.setName('Kitchen');
		draft.setRect({ x: 0, y: 0, width: 100, depth: 100 });
		draft.clearRect();
		expect(draft.rect).toBeNull();
		expect(draft.name).toBe('Kitchen');
		expect(draft.keepAdding).toBe(true);
		draft.beginTask('Room 2');
		expect(draft.name).toBe('Room 2');
		expect(draft.nameTouched).toBe(false);
		expect(draft.keepAdding).toBe(false);
		draft.reset();
		expect(draft.name).toBe('');
	});

	it('settle writes the sentence from the rect, and null without one', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.settle();
		expect(draft.settledSize).toBeNull();
		draft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
		draft.settle();
		expect(draft.settledSize).toContain('4.2');
		expect(draft.settledSize).toContain('3.8');
		expect(draft.settledSize).toContain('15.96 m²');
	});

	it('clearRect and reset drop a previously announced sentence along with the rect it described', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
		draft.settle();
		expect(draft.settledSize).not.toBeNull();
		draft.clearRect();
		expect(draft.settledSize).toBeNull();

		draft.setRect({ x: 0, y: 0, width: 4200, depth: 3800 });
		draft.settle();
		expect(draft.settledSize).not.toBeNull();
		draft.reset();
		expect(draft.settledSize).toBeNull();
	});

	it('geometry and area are null before any rect exists', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		expect(draft.geometry).toBeNull();
		expect(draft.areaMm2).toBeNull();
	});

	/**
	 * `Infinity` rather than the `NaN` this case used to drive, and the swap is what keeps the
	 * polygon refusal REACHABLE: `rect` refuses a side that is not `> 0`, which `NaN` fails, so
	 * a NaN side now stops at `rect` and never reaches `createPolygon` at all. `Infinity > 0`
	 * is true, so an infinite side is the one remaining way a rect exists whose polygon does
	 * not — the same fixture `roomCreation.test.ts` drives for the same arm.
	 */
	it('geometry is null when the rect refuses to become a polygon', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.setRect({ x: 0, y: 0, width: Infinity, depth: 100 });
		expect(draft.rect).not.toBeNull();
		expect(draft.geometry).toBeNull();
	});

	/**
	 * A zero side is refused at `rect` rather than at `valid` (design spec §2.7's rule, which
	 * the numeric route already kept and the drag route did not). An axis-aligned drag —
	 * straight left to right, no vertical displacement at all — clears the click epsilon and
	 * settles, so before this the store answered a rectangle of area zero that `createPolygon`
	 * accepts and `Zone.create` defers to it about. Refusing at `rect` is what makes every
	 * reader agree at once: no sketch, no area, no settled sentence, no Create.
	 *
	 * `> 0` rather than `!== 0`, so a negative side (which `setRect` can be handed, even though
	 * `normalised` takes absolutes) and a `NaN` one are refused by the same test.
	 */
	it('a rectangle with a zero side is no rectangle at all, on either axis', () => {
		for (const flat of AXES) {
			const draft = useRoomDraftStore();
			draft.beginTask('Room 1');
			draft.setName('Kitchen');
			draft.setRect({ x: 0, y: 0, width: flat === 'width' ? 0 : 4200, depth: flat === 'depth' ? 0 : 3800 });
			expect(draft.rect).toBeNull();
			expect(draft.valid).toBe(false);
			expect(draft.geometry).toBeNull();
			expect(draft.areaMm2).toBeNull();
			draft.settle();
			expect(draft.settledSize).toBeNull();
		}
	});

	it('a negative or NaN side is refused by the same test as a zero one', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.setRect({ x: 0, y: 0, width: -4200, depth: 3800 });
		expect(draft.rect).toBeNull();
		draft.setRect({ x: 0, y: 0, width: 4200, depth: NaN });
		expect(draft.rect).toBeNull();
	});

	it('a field error on either axis invalidates the same way, and a correction clears it', () => {
		for (const axis of AXES) {
			const draft = useRoomDraftStore();
			draft.beginTask('Room 1');
			draft.setRect({ x: 0, y: 0, width: 100, depth: 100 });
			draft.setName('Kitchen');
			expect(draft.valid).toBe(true);
			draft.commitDimension(axis, 'x', centre);
			expect(draft.valid).toBe(false);
			draft.commitDimension(axis, '4.2', centre);
			expect(draft.valid).toBe(true);
		}
	});

	it('suggestName sets the name as an explicit gesture, like setName', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.suggestName('Kitchen');
		expect(draft.name).toBe('Kitchen');
		expect(draft.nameTouched).toBe(true);
	});

	it('satisfies the RoomDraftPort a drawing tool will consume', () => {
		const draft = useRoomDraftStore();
		const port: RoomDraftPort = draft;
		port.beginTask('Room 1');
		const rect: RoomRect = { x: 500, y: 700, width: 4200, depth: 3800 };
		port.setRect(rect);
		expect(port.rect).toEqual(rect);
		port.settle();
		expect(draft.settledSize).toContain('4.2');
		port.clearRect();
		expect(port.rect).toBeNull();
		port.reset();
		expect(draft.name).toBe('');
	});
});
