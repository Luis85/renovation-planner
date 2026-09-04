import { describe, expect, it } from 'vitest';
import { formatMetres, MAX_ROOM_SIDE_MM, parseMetres } from '../../../../src/presentation/editor/shell/formatLength';

describe('formatMetres', () => {
	it('prints world millimetres as metres, ungrouped, to millimetre precision', () => {
		expect(formatMetres(4200)).toBe('4.2');
		expect(formatMetres(3800)).toBe('3.8');
		expect(formatMetres(4255)).toBe('4.255');
		expect(formatMetres(1_234_560)).toBe('1234.56');
	});

	/**
	 * **THE ROUND TRIP, and it is the reason this function's shape is what it is.**
	 * `RoomDraftStore.setRect` writes this output into the editable width/depth fields, and
	 * their blur handler hands that same text back to `parseMetres` — so these two are not
	 * merely a pair of formatters, they are an encode/decode across a control the user can
	 * focus. Nothing had asked them to agree, and they did not:
	 *
	 * - **`maximumFractionDigits: 2` cannot express a millimetre.** A valid 1–4 mm side
	 *   displayed as `0`, which `parseMetres` then refused as `not-positive` — so merely
	 *   focusing and leaving an untouched field invalidated a draft that was fine, and 5 mm
	 *   displayed as `0.01` and came back as 10 mm.
	 * - **`en-US` GROUPS thousands, and `parseMetres` reads a comma as a DECIMAL separator**
	 *   (deliberately — a German numeric keypad types one). So 999,999 mm formatted as
	 *   `1,000` and reparsed as 1000 mm: a 1000× shrink, on an untouched blur, silently. It
	 *   bites from 999,500 mm upward rather than only at the `MAX_ROOM_SIDE_MM` boundary,
	 *   which is why the case below reaches for 999,999 and not just the maximum.
	 *
	 * The property is `parseMetres(formatMetres(mm)).mm === mm` for every whole millimetre the
	 * draft can hold, which is exact because `parseMetres` rounds to the millimetre anyway —
	 * so millimetre precision in metres is three decimals, and grouping has to go.
	 *
	 * Verified over ALL 1,000,000 valid values offline (zero mismatches); asserted here over
	 * the sub-decimal range where rounding is dangerous, the top of the range where grouping
	 * was, and a prime-strided sweep of the middle, so the case stays fast without being a
	 * hand-picked set of the values that happen to work.
	 */
	it('round-trips every whole millimetre back through parseMetres', () => {
		const samples = [
			...Array.from({ length: 2000 }, (_, i) => i + 1),
			...Array.from({ length: 1001 }, (_, i) => 999_000 + i),
			...Array.from({ length: 100 }, (_, i) => 1 + i * 9973),
			MAX_ROOM_SIDE_MM,
		];

		const broken = samples.filter((mm) => {
			const parsed = parseMetres(formatMetres(mm));
			return !parsed.ok || parsed.mm !== mm;
		});

		expect(broken).toEqual([]);
	});

	// The two shapes that made the round trip fail, named so a regression says WHICH.
	it('emits no thousands separator and does not truncate a millimetre away', () => {
		expect(formatMetres(999_999)).toBe('999.999');
		expect(formatMetres(MAX_ROOM_SIDE_MM)).toBe('1000');
		expect(formatMetres(2)).toBe('0.002');
		expect(formatMetres(5)).toBe('0.005');
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
