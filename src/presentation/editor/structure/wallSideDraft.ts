import { computed, ref, type Ref } from 'vue';
import type { Wall, WallSide, WallSideExtents } from '../../../domain/spatial/Structure';
import { MAX_WALL_TOTAL, MIN_WALL_TOTAL, validWallSides, wallSideExtents, wallTotal } from '../../../domain/spatial/wallSides';
import { WALL_THICKNESS_STEP } from '../../../domain/spatial/wallThickness';
import { parseExtentMetres } from '../shell/formatLength';
import { formatWallExtent } from './wallExtentInput';
import { Decimal } from 'decimal.js';

/** Numeric draft only: admission, preview and persistence remain the action controller's responsibility. */
export function createWallSideDraft(original: Readonly<Ref<Wall | undefined>>) {
	const text = ref<Record<WallSide, string>>({ a: '', b: '' }), precise = ref<Record<WallSide, number | null>>({ a: null, b: null });
	function value(side: WallSide): number | null {
		const wall = original.value; if (!wall) return null;
		const exact = precise.value[side]; if (exact !== null) return exact;
		const initial = wallSideExtents(wall)[side];
		if (text.value[side] === formatWallExtent(initial)) return initial;
		const parsed = parseExtentMetres(text.value[side]); return parsed.ok ? parsed.mm : null;
	}
	const values = computed<WallSideExtents | null>(() => { const a = value('a'), b = value('b'); return a === null || b === null ? null : { a, b }; });
	const total = computed(() => values.value ? wallTotal(values.value) : null);
	const valid = computed(() => values.value !== null && total.value !== null && validWallSides({ thickness: total.value, sideExtents: values.value }));
	function reset(wall?: Wall): void {
		const sides = wall && wallSideExtents(wall);
		text.value = { a: sides ? formatWallExtent(sides.a) : '', b: sides ? formatWallExtent(sides.b) : '' }; precise.value = { a: null, b: null };
	}
	function edit(side: WallSide, next: string): void { text.value[side] = next; precise.value[side] = null; }
	function range(side: WallSide) {
		const current = values.value; if (!current || !valid.value) return null;
		const other = current[side === 'a' ? 'b' : 'a'];
		return { value: current[side], min: Math.max(0, MIN_WALL_TOTAL - other), max: MAX_WALL_TOTAL - other };
	}
	function canStep(side: WallSide, direction: -1 | 1): boolean {
		const bounds = range(side); return bounds !== null && (direction < 0 ? bounds.value > bounds.min : bounds.value < bounds.max);
	}
	function step(side: WallSide, direction: -1 | 1): boolean {
		const bounds = range(side); if (!bounds) return false;
		const next = Math.max(bounds.min, Math.min(bounds.max, new Decimal(bounds.value).plus(direction * WALL_THICKNESS_STEP).toNumber()));
		if (next === bounds.value) return false;
		precise.value[side] = next; text.value[side] = formatWallExtent(next); return true;
	}
	return { text, values, total, valid, reset, edit, step, canStep };
}
