/**
 * World millimetres ⇄ metres for the room draft's labels and fields (design spec §2.6). ONE
 * module beside `formatArea`, `en-US` for the reason that file gives, so the per-plan units PBI
 * replaces both in one edit. A decimal COMMA is accepted on input because this plugin ships a
 * German locale and a German keyboard's numeric pad types one.
 */
export type LengthRefusal = 'not-a-number' | 'not-positive' | 'too-large';

/** A Floor has no extent (ADR-0017), so "out of bounds" is numeric sanity: a kilometre. */
export const MAX_ROOM_SIDE_MM = 1_000_000;

export function formatMetres(mm: number): string {
	return (mm / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 });
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
	return { ok: true, mm };
}
