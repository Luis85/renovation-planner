import { describe, expect, it } from 'vitest';
import { formatMetres, MAX_ROOM_SIDE_MM, parseMetres } from '../../../../src/presentation/editor/shell/formatLength';

/**
 * One line per vocabulary row, so the table case's failure NAMES the input whose answer moved
 * rather than printing two truncated arrays of objects and leaving the reader to diff
 * twenty-five of them. At module scope because it captures nothing.
 */
const line = (text: string, answer: ReturnType<typeof parseMetres>): string =>
	`${JSON.stringify(text)} -> ${answer.ok ? `ok ${answer.mm} mm` : `refused ${answer.reason}`}`;

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
	/**
	 * **The accepted SET, pinned as a table, because the pattern that decides it was rewritten
	 * for speed and a rewrite of a regex is a rewrite of a contract.** The old shape,
	 * `/^-?\d*\.?\d+$|^Infinity$/`, was replaced by an unambiguous one to stop it backtracking
	 * (the case below); every row here is an answer the OLD pattern gave, read off it before the
	 * change rather than reasoned about afterwards, so this table fails a replacement that is
	 * merely FASTER rather than equivalent.
	 *
	 * The rows that are easy to get wrong, each one a refusal somebody would lose by accident:
	 *
	 * - **`-Infinity` is refused by the PATTERN, not by the `metres <= 0` arm.** The old
	 *   alternation anchors `Infinity` on its own (`|^Infinity$`), so a sign never reaches it. A
	 *   replacement spelling the sign once in front of both alternatives accepts `-Infinity` and
	 *   answers `not-positive` instead — a different refusal for the same input, and a table is
	 *   the only thing that can see the difference.
	 * - **`Infinity` itself stays ACCEPTED here and is refused as `too-large`**, which is what
	 *   keeps `polygonForRect`'s own finiteness refusal reachable at all.
	 * - **`.5` and `-.5` are accepted** — a leading dot with no integer part, because the old
	 *   `\d*\.?\d+` let `\d*` match nothing. An unambiguous rewrite has to say that arm out loud
	 *   (`|\.\d+`) or it silently narrows the language.
	 * - **`1.` is refused** for the mirror reason: the old shape required at least one digit
	 *   AFTER the dot, so a trailing-dot number was never legal and must not become legal.
	 * - **`+1` and `1e3` are refused**, so this is not `Number()`'s grammar and must not drift
	 *   into it.
	 *
	 * Equivalence was measured as well as tabulated, because a table cannot be a proof about a
	 * SET: the two patterns were run against every string up to length 4 over the 15-character
	 * alphabet that can spell every construct either one knows (`- + . 0 9 I n f i t y`, space,
	 * `e`, LF, CR) — 54,241 strings, zero disagreements, 2026-09-05. What the table adds is the
	 * rows a reader would otherwise have to re-derive.
	 */
	it('accepts and refuses exactly the vocabulary it did before', () => {
		const vocabulary = [
			['Infinity', { ok: false, reason: 'too-large' }],
			['-Infinity', { ok: false, reason: 'not-a-number' }],
			['+Infinity', { ok: false, reason: 'not-a-number' }],
			['infinity', { ok: false, reason: 'not-a-number' }],
			['+1', { ok: false, reason: 'not-a-number' }],
			['1.', { ok: false, reason: 'not-a-number' }],
			['1e3', { ok: false, reason: 'not-a-number' }],
			['1_000', { ok: false, reason: 'not-a-number' }],
			['0x10', { ok: false, reason: 'not-a-number' }],
			['NaN', { ok: false, reason: 'not-a-number' }],
			['.', { ok: false, reason: 'not-a-number' }],
			['-', { ok: false, reason: 'not-a-number' }],
			['-.', { ok: false, reason: 'not-a-number' }],
			['', { ok: false, reason: 'not-a-number' }],
			['1 2', { ok: false, reason: 'not-a-number' }],
			['1,2,3', { ok: false, reason: 'not-a-number' }],
			['1..2', { ok: false, reason: 'not-a-number' }],
			['-0', { ok: false, reason: 'not-positive' }],
			['-0.0', { ok: false, reason: 'not-positive' }],
			['-.5', { ok: false, reason: 'not-positive' }],
			['.5', { ok: true, mm: 500 }],
			['00.5', { ok: true, mm: 500 }],
			['007', { ok: true, mm: 7000 }],
			['  4,2  ', { ok: true, mm: 4200 }],
			['\t4.2\n', { ok: true, mm: 4200 }],
		] as const;

		expect(vocabulary.map(([text]) => line(text, parseMetres(text)))).toEqual(
			vocabulary.map(([text, expected]) => line(text, expected)),
		);
	});

	/**
	 * **A blur is a synchronous call on Obsidian's single renderer thread, so this is a HANG
	 * rather than a slow function.** The old pattern's `\d*\.?\d+` was AMBIGUOUS: on N digits
	 * followed by a non-digit, `\d*` gives back one position at a time and `\d+` rescans from
	 * each, so refusing the string is quadratic in N. Paste an id or a CSV cell into the Width
	 * field and tab away, and the whole app stops answering for as long as that takes.
	 *
	 * Measured on the machine that wrote this (Node 24.15.0, Windows, 2026-09-05), median of
	 * three, through the whole of `parseMetres` rather than the pattern alone: 5,000 digits
	 * 14.3 ms old against 0.018 ms new, 20,000 → 220.5 ms / 0.029 ms, 50,000 → 1,395.9 ms /
	 * 0.072 ms.
	 *
	 * **An explicit DEADLINE rather than vitest's own timeout, and rather than a tick count.**
	 * The default case timeout is 5,000 ms, which is ABOVE the defect at every size a paste can
	 * plausibly reach — so this case would have passed straight over the thing it is for. 250 ms
	 * is ~3,400x what the fixed call costs here and ~5.6x under what the defect cost, so the
	 * window has room on a contended runner in both directions. What it cannot see is a
	 * regression to a pattern that is merely ambiguous without being quadratic; the table above
	 * is the instrument for the language, this one only for the cost.
	 */
	it('refuses a long digit run in bounded time rather than backtracking over it', () => {
		const pasted = `${'9'.repeat(50_000)}x`;

		const started = performance.now();
		const answer = parseMetres(pasted);
		const elapsed = performance.now() - started;

		expect(answer).toEqual({ ok: false, reason: 'not-a-number' });
		expect(elapsed).toBeLessThan(250);
	});
});
