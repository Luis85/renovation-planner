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

	it('the numeric route places a rect centred on placeAt() once both sides are known', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.commitDimension('width', '4.2', centre);
		expect(draft.rect).toBeNull();
		draft.commitDimension('depth', '3.8', centre);
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

	it('geometry and area are null before any rect exists', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		expect(draft.geometry).toBeNull();
		expect(draft.areaMm2).toBeNull();
	});

	it('geometry is null when the rect refuses to become a polygon', () => {
		const draft = useRoomDraftStore();
		draft.beginTask('Room 1');
		draft.setRect({ x: 0, y: 0, width: NaN, depth: 100 });
		expect(draft.geometry).toBeNull();
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
