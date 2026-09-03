/**
 * World millimetres² as a human-readable area, shared by both Inspector bodies since Task
 * 15 split the routing frame (`EntityInspector.vue`) from the room state (`RoomInspector.vue`,
 * `InspectorPanel.vue` through Task 15) and gave the frame a floor state (`FloorInspector.vue`)
 * that needs the identical formatting for its own "Total area" stat. A single function is what
 * keeps both bodies rendering the same figure the same way rather than each rounding it its
 * own way.
 *
 * `'en-US'`, deliberately, not the host locale: a decimal comma on a de-DE machine and a
 * decimal point everywhere else would make the same area render two ways for the same
 * vault. One stable format until the string table grows a formatting rule of its own
 * (slice 9's quantity engine is where units and locales get decided properly).
 */
export function formatArea(areaMm2: number): string {
	return `${(areaMm2 / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })} m²`;
}
