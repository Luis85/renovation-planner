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
 * ONE formatter for the module rather than one per call, because `Number.prototype.
 * toLocaleString(locale, options)` is specified as `new Intl.NumberFormat(locale, options).
 * format(this)` — it constructs a whole formatter, resolves the locale and reads ICU data every
 * time it is called. Measured on the machine that wrote this (Node 24.15.0, Windows,
 * 2026-09-05, 200,000 iterations after a warm-up): **40.2 µs/call** built per call against
 * **0.67 µs** through this cached one, ~60x.
 *
 * It is not a micro-optimisation because of WHERE the calls are. One pointer move during a room
 * drag makes five of them — `RoomDraftStore.setRect` re-formats both field texts, `RoomDraftSketch`
 * draws both edge labels, and `NewRoomInspector`'s area row calls `formatArea` — so building a
 * formatter per call cost ~0.2 ms of EVERY move, in a gesture that is nothing but moves.
 *
 * For what that is worth beside a render: `InteractionLayer.vue`'s own docblock records the
 * nearest measured per-move costs on this canvas — 0.18 ms with no tool active, 0.76 ms on a
 * five-node segment, and 2.61 ms at the tick cap, which a user reported as the calibration tool
 * being unusable. **Those are a SIBLING layer's numbers, not this one's**: nobody has measured
 * `RoomDraftSketch`'s own per-move render, so read 0.2 ms as an absolute cost against that scale
 * rather than as a share of a total anybody here has taken.
 *
 * **Built at IMPORT time, which is safe HERE and would not be everywhere.** This repository
 * records a module-scope `setTimeout` alias escaping `vi.useFakeTimers()` for exactly this shape;
 * the difference is what is captured. Both inputs here are literals — the locale is the hard-coded
 * `'en-US'` the docblocks above and in `formatArea` argue for, never `getLanguage()` — so there is
 * no later-installed value for an early construction to miss. Where the locale IS mutable the
 * answer is `AssetLibraryStore`'s: cache keyed on the language and rebuilt when it moves. The day
 * the per-plan units PBI makes this locale a variable, this constant has to become that.
 */
const METRES_FORMAT = new Intl.NumberFormat('en-US', { useGrouping: false, maximumFractionDigits: 3 });

/**
 * **This is the ENCODE half of a round trip, not a display helper, and both of the formatter's
 * options are load-bearing because of that.** `RoomDraftStore.setRect` writes the result into the
 * editable width/depth fields, whose blur handler hands the same text back to `parseMetres` — so a
 * user who focuses an untouched field and leaves it re-parses whatever this produced.
 *
 * `maximumFractionDigits: 3` because `parseMetres` rounds to the whole millimetre, so a
 * millimetre expressed in metres needs exactly three decimals and no more. At `2` a valid 1–4 mm
 * side printed `0` and came back `not-positive`, invalidating a good draft on a blur that
 * changed nothing, and 5 mm printed `0.01` and came back as 10 mm.
 *
 * `useGrouping: false` because `parseMetres` reads a comma as a DECIMAL separator on purpose (a
 * German numeric keypad types one) while `en-US` groups thousands with it. Those two together
 * turned 999,999 mm into `1,000` and then into 1000 mm — a silent 1000× shrink, from 999,500 mm
 * upward rather than only at `MAX_ROOM_SIDE_MM`. `formatArea` deliberately does NOT pass that
 * option, since nothing reparses an area, which is why the two carry separate formatters rather
 * than sharing one.
 *
 * The cost is paid by the canvas edge labels and the settled announcement, which share this
 * function: a 1000 m side reads `1000` rather than `1,000`. That is the whole loss, it applies
 * only above 999 m against a `MAX_ROOM_SIDE_MM` of exactly 1000 m, and a separate display
 * formatter was refused for the reason this repository states elsewhere — one rule with two
 * doors is two rules unless one function holds it, and the door that would drift is the one
 * feeding the control. `parseMetres(formatMetres(mm)).mm === mm` holds for all 1,000,000 valid
 * values — re-verified exhaustively against the cached formatter above, zero mismatches,
 * 2026-09-05 — and `formatLength.test.ts` is where a strided sample of that is asserted.
 */
export function formatMetres(mm: number): string {
	return METRES_FORMAT.format(mm / 1000);
}

/**
 * **The alternation is UNAMBIGUOUS on purpose, and that is a correctness property rather than a
 * tuning one.** This ran as `/^-?\d*\.?\d+$|^Infinity$/`, in which `\d*\.?\d+` can split N digits
 * between `\d*` and `\d+` in N ways: on a string that ultimately fails, the engine gives back one
 * position at a time and rescans from each, so refusing it is quadratic in N. `parseMetres` is
 * called synchronously from the width/depth fields' `@blur` on Obsidian's single renderer thread,
 * so pasting a digit-heavy blob — an id, a CSV cell — and tabbing away froze the whole app.
 *
 * Measured on the machine that wrote this (Node 24.15.0, Windows, 2026-09-05, median of three,
 * whole function): 5,000 digits plus a letter took **14.3 ms** and takes **0.018 ms**; 20,000
 * took **220.5 ms** and takes **0.029 ms**; 50,000 took **1,395.9 ms** and takes **0.072 ms**.
 *
 * `\d+(?:\.\d+)?|\.\d+` spells the two shapes the old pattern reached by backtracking — digits
 * with an optional fraction, or a bare fraction — so each position has exactly one way to match
 * and there is nothing to give back. **The accepted set is unchanged**, which is a claim about a
 * SET and therefore measured rather than asserted: both patterns were run against every string up
 * to length 4 over the 15-character alphabet that can spell every construct either knows (54,241
 * strings, zero disagreements, 2026-09-05), and `formatLength.test.ts` pins the vocabulary as a
 * table besides. Two rows of it decide the shape of this pattern and are easy to lose:
 * `Infinity` is anchored on its OWN alternative, so `-Infinity` is refused as `not-a-number`
 * rather than reaching the `metres <= 0` arm as `not-positive`; and the sign binds to the numeric
 * alternative alone rather than to both.
 */
const NUMERIC = /^(?:-?(?:\d+(?:\.\d+)?|\.\d+)|Infinity)$/;

export function parseMetres(text: string): { ok: true; mm: number } | { ok: false; reason: LengthRefusal } {
	const normalised = text.trim().replace(',', '.');
	if (normalised === '' || !NUMERIC.test(normalised)) {
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
