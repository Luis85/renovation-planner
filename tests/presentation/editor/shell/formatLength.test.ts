import { describe, expect, it } from 'vitest';
import { formatMetres, MAX_ROOM_SIDE_MM, parseMetres } from '../../../../src/presentation/editor/shell/formatLength';

describe('formatMetres', () => {
	it('prints world millimetres as metres with at most two decimals, en-US', () => {
		expect(formatMetres(4200)).toBe('4.2');
		expect(formatMetres(3800)).toBe('3.8');
		expect(formatMetres(4255)).toBe('4.26');
		expect(formatMetres(1_234_560)).toBe('1,234.56');
	});
});

describe('parseMetres', () => {
	it('reads a decimal point and a decimal comma alike, into millimetres', () => {
		expect(parseMetres('4.2')).toEqual({ ok: true, mm: 4200 });
		expect(parseMetres('4,2')).toEqual({ ok: true, mm: 4200 });
		expect(parseMetres(' 3.80 ')).toEqual({ ok: true, mm: 3800 });
	});
	it('refuses text and empties as not-a-number', () => {
		expect(parseMetres('')).toEqual({ ok: false, reason: 'not-a-number' });
		expect(parseMetres('four')).toEqual({ ok: false, reason: 'not-a-number' });
		expect(parseMetres('4.2.1')).toEqual({ ok: false, reason: 'not-a-number' });
	});
	it('refuses zero and negatives as not-positive', () => {
		expect(parseMetres('0')).toEqual({ ok: false, reason: 'not-positive' });
		expect(parseMetres('-3')).toEqual({ ok: false, reason: 'not-positive' });
	});
	/**
	 * **The positivity rule is about the MILLIMETRE, and this checked the metre.** A value
	 * under half a millimetre is positive as typed and rounds to `mm: 0`, so the old order
	 * answered `{ ok: true, mm: 0 }`: `commitDimension` then cleared the field's error while
	 * `rect`'s own `> 0` guard refused the rectangle, leaving every field apparently accepted
	 * and Create blocked with nothing on screen saying which side was wrong — the
	 * live-control-that-does-nothing shape from the other end.
	 *
	 * The same defect as the drag route's zero side, one door along: the final review closed
	 * that one at `rect` because six readers share it, and `rect` cannot tell a caller WHY it
	 * refused. This door can, so the refusal belongs here as well rather than instead —
	 * `parseMetres` is the only place a `LengthRefusal` is minted, and a field error is the
	 * only surface that names a side.
	 *
	 * `0.0004` and `0.0005` are the two sides of `Math.round`'s own boundary: the first is the
	 * defect's original report, and the second is the smallest input that still rounds UP to a
	 * real millimetre and must therefore keep passing.
	 */
	it('refuses a positive side that rounds to zero millimetres, and keeps the one that rounds up', () => {
		expect(parseMetres('0.0001')).toEqual({ ok: false, reason: 'not-positive' });
		expect(parseMetres('0.0004')).toEqual({ ok: false, reason: 'not-positive' });
		expect(parseMetres('0.0005')).toEqual({ ok: true, mm: 1 });
	});
	it('refuses a side longer than a kilometre, and Infinity with it', () => {
		expect(parseMetres('1000.01')).toEqual({ ok: false, reason: 'too-large' });
		expect(parseMetres('Infinity')).toEqual({ ok: false, reason: 'too-large' });
		expect(parseMetres('1000')).toEqual({ ok: true, mm: MAX_ROOM_SIDE_MM });
	});
});
