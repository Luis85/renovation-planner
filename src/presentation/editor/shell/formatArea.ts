/**
 * World millimetres² as a human-readable area. ONE module beside `formatLength`, so the per-plan
 * units PBI replaces both in one edit.
 */

/**
 * ONE formatter rather than one per call: `toLocaleString(locale, options)` is specified as
 * `new Intl.NumberFormat(locale, options).format(this)`, so it built a whole formatter and
 * resolved the locale on every call. Measured on the machine that wrote this (Node 24.15.0,
 * Windows, 2026-09-05, 200,000 iterations after a warm-up): **41.1 µs/call** against **0.67 µs**
 * cached, ~61x. `formatMetres`'s own docblock carries why that matters — this is one of the five
 * format calls a single pointer move makes during a room drag.
 *
 * Built at IMPORT time, which is safe because both inputs are literals: the locale is the
 * hard-coded `'en-US'` the function below argues for rather than `getLanguage()`, so there is no
 * later-installed value an early construction could miss. `formatLength.ts`'s own constant says
 * the same at more length, including what has to change when the per-plan units PBI makes this
 * locale a variable.
 *
 * **No `useGrouping: false` here, unlike `formatMetres`, and the asymmetry is deliberate.** That
 * option exists there because the field it feeds is handed back to `parseMetres`, which reads a
 * comma as a decimal separator; nothing reparses an area, so an area keeps `en-US` grouping and a
 * hall reads `1,234 m²`. Two formatters rather than one shared constant for exactly that, and
 * `formatArea.test.ts` pins both halves — the grouping and the two decimals — because a second
 * constant written by copying the first one's options is how the asymmetry gets lost.
 */
const AREA_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/**
 * Shared by both Inspector bodies since Task 15 split the routing frame (`EntityInspector.vue`)
 * from the room state (`RoomInspector.vue`, `InspectorPanel.vue` through Task 15) and gave the
 * frame a floor state (`FloorInspector.vue`) that needs the identical formatting for its own
 * "Total area" stat. A single function is what keeps both bodies rendering the same figure the
 * same way rather than each rounding it its own way.
 *
 * `'en-US'`, deliberately, not the host locale: a decimal comma on a de-DE machine and a decimal
 * point everywhere else would make the same area render two ways for the same vault. One stable
 * format until the string table grows a formatting rule of its own (slice 9's quantity engine is
 * where units and locales get decided properly).
 */
export function formatArea(areaMm2: number): string {
	return `${AREA_FORMAT.format(areaMm2 / 1_000_000)} m²`;
}
