/**
 * World millimetres ⇄ metres for the room draft's labels and fields (design spec §2.6). ONE
 * module beside `formatArea`, `en-US` for the reason that file gives, so the per-plan units PBI
 * replaces both in one edit. A decimal COMMA is accepted on input because this plugin ships a
 * German locale and a German keyboard's numeric pad types one.
 */
export type LengthRefusal = 'not-a-number' | 'not-positive' | 'too-large';

/** A Floor has no extent (ADR-0017), so "out of bounds" is numeric sanity: a kilometre. */
export const MAX_ROOM_SIDE_MM = 1_000_000;

/**
 * **This is the ENCODE half of a round trip, not a display helper, and both of its options are
 * load-bearing because of that.** `RoomDraftStore.setRect` writes the result into the editable
 * width/depth fields, whose blur handler hands the same text back to `parseMetres` — so a user
 * who focuses an untouched field and leaves it re-parses whatever this produced.
 *
 * `maximumFractionDigits: 3` because `parseMetres` rounds to the whole millimetre, so a
 * millimetre expressed in metres needs exactly three decimals and no more. At `2` a valid 1–4 mm
 * side printed `0` and came back `not-positive`, invalidating a good draft on a blur that
 * changed nothing, and 5 mm printed `0.01` and came back as 10 mm.
 *
 * `useGrouping: false` because `parseMetres` reads a comma as a DECIMAL separator on purpose (a
 * German numeric keypad types one) while `en-US` groups thousands with it. Those two together
 * turned 999,999 mm into `1,000` and then into 1000 mm — a silent 1000× shrink, from 999,500 mm
 * upward rather than only at `MAX_ROOM_SIDE_MM`.
 *
 * The cost is paid by the canvas edge labels and the settled announcement, which share this
 * function: a 1000 m side reads `1000` rather than `1,000`. That is the whole loss, it applies
 * only above 999 m against a `MAX_ROOM_SIDE_MM` of exactly 1000 m, and a separate display
 * formatter was refused for the reason this repository states elsewhere — one rule with two
 * doors is two rules unless one function holds it, and the door that would drift is the one
 * feeding the control. `parseMetres(formatMetres(mm)).mm === mm` holds for all 1,000,000 valid
 * values and `formatLength.test.ts` is where that is asserted.
 */
export function formatMetres(mm: number): string {
	return (mm / 1000).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 3 });
}

export function parseMetres(text: string): { ok: true; mm: number } | { ok: false; reason: LengthRefusal } {
	const normalised = text.trim().replace(',', '.');
	if (normalised === '' || !/^-?\d*\.?\d+$|^Infinity$/.test(normalised)) {
		return { ok: false, reason: 'not-a-number' };
	}
	const metres = Number(normalised);
	if (metres <= 0) return { ok: false, reason: 'not-positive' };
	const mm = Math.round(metres * 1000);
	if (mm > MAX_ROOM_SIDE_MM) return { ok: false, reason: 'too-large' };
	// The positivity rule is about the MILLIMETRE this returns, not the metre that was typed:
	// anything under half a millimetre is positive as written and rounds to 0, and a zero side
	// is no rectangle. Refused HERE as well as at `RoomDraftStore.rect`'s own `> 0` guard,
	// because the two doors answer different questions — `rect` decides whether a rectangle
	// exists and cannot say why not, while this is the only place a `LengthRefusal` is minted
	// and therefore the only path to a per-field message. Without it the field cleared its
	// error and Create stayed blocked with nothing naming the side.
	if (mm <= 0) return { ok: false, reason: 'not-positive' };
	return { ok: true, mm };
}
