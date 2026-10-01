/**
 * Where a roving tabindex lands when a key is pressed (WAI-ARIA's list pattern): the index Home,
 * End and the arrows move to, or `-1` for a key this list does not take.
 *
 * **One function because there were two, identical but for one clause.** The Parts panel and the
 * preset gallery each grew their own copy — the second by being told to follow the first — and
 * `npm run analyze` reported the pair as a nineteen-line clone. The only real difference is whether
 * the horizontal arrows step, which is a fact about the CALLER's layout rather than about the
 * pattern: a vertical list of rows takes Up and Down, and a gallery that wraps takes all four.
 *
 * **`horizontal` is what the caller knows and this cannot.** A wrapping grid's column count comes
 * from `repeat(auto-fill, …)` resolved against a width nothing here measures, so neither caller can
 * step a column honestly; both walk their reading order as the single list they are authored as, and
 * this function is that one order. A caller wanting true two-dimensional movement needs a measured
 * column count, which is its own increment with a capture behind it.
 *
 * The ends CLAMP rather than wrap, which is the list pattern's own rule.
 *
 * **A `from` of `-1` is clamped to 0 and then STEPPED**, so a forward key from nothing-focused lands
 * on index 1 rather than index 0. That is inherited behaviour and it is stated here rather than
 * fixed, because neither caller can produce it: both resolve their tabbable item to a member of the
 * list before asking — the Parts panel falls back to the first row, the gallery to the first choice
 * — so `findIndex` answers `-1` only for a list with nothing in it, which both draw a `v-else` for.
 * Written down because the first version of this sentence claimed the opposite and a case caught it;
 * a caller that ever CAN pass `-1` should decide what it wants rather than inherit this.
 */
export function rovingIndex(key: string, from: number, length: number, horizontal: boolean): number {
	if (key === 'Home') return 0;
	if (key === 'End') return length - 1;
	const forward = key === 'ArrowDown' || (horizontal && key === 'ArrowRight');
	const back = key === 'ArrowUp' || (horizontal && key === 'ArrowLeft');
	if (!forward && !back) return -1;
	return Math.min(length - 1, Math.max(0, Math.max(from, 0) + (forward ? 1 : -1)));
}
