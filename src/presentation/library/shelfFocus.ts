/**
 * §6.2's keyboard over the Asset library's shelves region, and the one question that section
 * asks twice — once of a focus STOP (`↑`/`↓` must not land on the rows of a collapsed shelf)
 * and once of a REGION (below 35rem, selecting a row hides the shelves outright, so focus has
 * to be handed to the inspector's back control).
 *
 * **ONE focus manager over the region, never a handler per shelf.** Headers and rows already
 * alternate in DOM order, so *the next focusable thing in this region* IS *the next row, or the
 * next shelf's header when the rows run out* — the wrap falls out rather than being written,
 * and an empty shelf is skipped for free because §3.2 gives it a non-interactive `<h3>` with no
 * button in it at all. A per-shelf handler would have to be told about its siblings, which is a
 * list, and a list goes stale where a rule does not.
 *
 * **`isLaidOut` is a WALK, not a property read, and it reads the COMPUTED display rather than
 * the inline one.** Two mechanisms hide things on this surface and the walk has to see both:
 * - `v-show` sets an INLINE `display: none`, and it sets it on `AssetShelf.vue`'s `<ul>`, never
 *   on the `<button>`s inside its `<li>`s — so each stop's own `style.display` is the empty
 *   string whether its shelf is open or shut, and a filter reading the stop itself keeps every
 *   collapsed row in the arrow-key list.
 * - §7's narrow composition hides `.rp-al-body` from a STYLESHEET (a container query in
 *   `styles/asset-library.css`), which no inline read can see at all.
 *
 * §6.2 spells the filter as an inline-`display` walk, which is true of the mechanism it was
 * written against (`v-show`) and cannot answer the second question in the same section — so
 * this is ONE predicate over `getComputedStyle` rather than two spellings of "is this laid
 * out", per this repository's own rule that a question worth asking at one door is a function.
 * Measured rather than assumed, against the jsdom this suite runs on (30.0.1): a stylesheet
 * rule and an inline style BOTH resolve through `getComputedStyle`, and a descendant of a
 * `display: none` ancestor still reports its OWN display — which is what makes the walk
 * necessary and the narrowing to a single element the mutation that catches it.
 *
 * **What this costs, and what it does not exclude.** `focusStops` resolves a computed style per
 * stop per keypress, walking that stop's ancestors — so an expanded shelf of several hundred
 * rows pays for all of them on every `↑`/`↓` in a real browser, where each call can force style
 * resolution. §5.3 is the section that cares about that order of cost; nothing here measures it,
 * and it is written down so the next author meets it as a known price rather than as a stutter.
 * The selector is `button`, which is a RULE rather than a list of the two components that ship
 * one — and it does not exclude a `disabled` button, of which this region has none: `focus()`
 * on one silently does nothing, which reads as a dead arrow key, so a control added here that
 * can be disabled owes this filter a second condition.
 *
 * **What no walk here can report is genuine LAYOUT.** `offsetParent` answers `null` for every
 * element in jsdom, so a manager built on it would filter out every row and the arrow keys
 * would do nothing with the whole suite green; `getBoundingClientRect` and `checkVisibility`
 * are equally absent (the latter is not implemented by this jsdom at all). And
 * `getComputedStyle` here does not evaluate CONTAINER QUERIES, so the production rule that
 * actually performs §7's swap is invisible to the suite — a test drives its selector without
 * the `@container` wrapper, and an eye in a vault is what settles the real one.
 */

/**
 * True when nothing between `el` and `root` — `el` itself included, `root` itself excluded —
 * is taken off the layout by a `display: none`, from any source the browser resolves.
 *
 * `root` is EXCLUSIVE because both callers hand in a container they have already decided is
 * the frame of reference: the shelves region for a focus stop, the view's own shell for the
 * shelves region. A walk that included it would answer a different question at each door.
 */
export function isLaidOut(el: HTMLElement, root: HTMLElement | null): boolean {
	// The GLOBAL rather than `el.ownerDocument.defaultView`, whose `null` arm no test can reach:
	// one isolated Vue app per `ItemView` (SDD §12) means every element this walks belongs to the
	// document this module was evaluated in. An unreachable guard is not free at this
	// repository's coverage margin, and the honest answer to a branch nothing can drive is not
	// to write it.
	for (let node: HTMLElement | null = el; node !== null && node !== root; node = node.parentElement) {
		if (getComputedStyle(node).display === 'none') return false;
	}
	return true;
}

/**
 * Every arrow-key stop inside one shelves region, in DOM order: a shelf header, then that
 * shelf's rows, then the next header. The rows of a collapsed shelf are in the DOM (`v-show`,
 * never `v-if`, so §6.1's expansion state survives) and are filtered out here rather than
 * walked around.
 */
export function focusStops(region: HTMLElement): readonly HTMLElement[] {
	return [...region.querySelectorAll<HTMLElement>('button')].filter((el) => isLaidOut(el, region));
}

/**
 * `↑`/`↓` within the region, bound ONCE on the region itself — `event.currentTarget` is
 * therefore the region, and there is nothing per shelf to keep in step.
 *
 * Does nothing when focus is not on one of the region's own stops (so a key pressed while the
 * region merely CONTAINS the focus, or with nothing focused at all, falls through to whatever
 * Obsidian binds it to), and nothing at either end — §6.2's wrap is into the NEXT header, which
 * is already the next stop, never around to the first.
 */
export function moveFocus(event: KeyboardEvent, step: 1 | -1): void {
	// `currentTarget` is non-null for the whole of a dispatch, and this handler is bound in a
	// template on the region itself — so there is no null arm here for a test to drive.
	const region = event.currentTarget as HTMLElement;
	const stops = focusStops(region);
	const here = stops.indexOf(region.ownerDocument.activeElement as HTMLElement);
	if (here === -1) return;
	const next = stops[here + step];
	if (next === undefined) return;
	event.preventDefault();
	next.focus();
}

/** The class §7's narrow composition takes off the layout, and the element this asks about. */
const SHELVES = '.rp-al-shelves';

/**
 * Has the pane been given to the inspector — §6.2's *whether the swap happened is asked of the
 * DOM, never of a breakpoint*.
 *
 * `matchMedia` is the wrong instrument and not merely a weaker one: §7's ladder is a CONTAINER
 * query, so it answers about the pane's width, and a split leaf is exactly the case where the
 * viewport's differs. The honest test is whether the shelves region is actually laid out, which
 * is what the browser already knows.
 *
 * `false` when there is no shelves region at all — §4's empty and no-matches states replace it,
 * and "the shelves are not there" is not "the pane swapped".
 */
export function shelvesWithdrawn(shell: HTMLElement | null): boolean {
	const shelves = shell?.querySelector<HTMLElement>(SHELVES) ?? null;
	return shelves !== null && !isLaidOut(shelves, shell);
}

/**
 * Focus the first laid-out thing `selector` names inside `shell`, or `fallback` when it names
 * nothing that is.
 *
 * The fallback matters at both ends of the handoff: `Back to library` returns focus to the row
 * it came from, and that row can be inside a shelf the user has since collapsed — `focus()` on
 * an element that is not laid out silently does nothing, stranding the caret on `<body>` with
 * the inspector already gone.
 */
export function focusWithin(
	shell: HTMLElement | null,
	selector: string,
	fallback: HTMLElement | null,
): void {
	const target = shell?.querySelector<HTMLElement>(selector) ?? null;
	if (target !== null && isLaidOut(target, shell)) target.focus();
	else fallback?.focus();
}

/**
 * Where a row sat, captured BEFORE the deletion that removes it — §3.5's post-deletion focus
 * rule needs an index, and by the time the rule runs the row is gone and so is the index.
 *
 * The `list` is held as a live ELEMENT rather than as a selector or a category, because the
 * two lists this rule serves cannot be named the same way: §6.1 replaces every shelf with one
 * flat *Results* list while a search runs, and that list has no category to key on. Holding
 * the element makes the two cases one rule — the deleted row's own `<ul class="rp-al-rows">`,
 * whichever list that is — and it makes ONE of the two ways this can go stale REPRESENTABLE
 * rather than silent: a shelf that empties out of existence (an undeclared category exists only
 * because an asset sits in it) leaves a disconnected element, which `focusRowAt` tests for.
 *
 * **The SECOND way is not closed and is named rather than surveyed**, because a residue written
 * down without its bound is what this repository calls reading as surveyed ground. This value is
 * captured before the dispatch and CONSUMED after the user has answered a modal, and
 * `onLibraryChanged`'s fire-and-forget `applyChange` can apply a listing in that window — a row
 * inserted ABOVE the captured index leaves the caret on a different neighbour than §3.5 names.
 * Capturing the surviving neighbour's ID instead would close it and would answer a DIFFERENT
 * rule: §3.5 says *"the row that now occupies the deleted row's index"*, which is index-shaped
 * on purpose, so this is a decision to keep the spec's rule rather than an oversight. What no
 * instrument here reaches: nothing in the suite drives a concurrent listing across an open
 * dialog, and the misplacement is one row rather than a lost caret.
 */
export interface RowPosition {
	readonly list: HTMLElement;
	readonly index: number;
}

/** The class §3.3's rows are drawn into, by both the shelves and §6.1's flat Results list. */
const ROWS = '.rp-al-rows';

/**
 * The row control itself — ONE selector, asked by both halves of this pair.
 *
 * The first version counted the position over `list.children` (the `<li>`s) and read it back
 * over `.rp-al-row` (the `<button>`s), which agree only while every `<li>` in a `.rp-al-rows`
 * holds exactly one row — true of `AssetRow.vue` today, stated nowhere and pinned by nothing.
 * A non-row `<li>` in that list (a "load more", a §6.1 grouping element) would then desync the
 * caret silently, in the direction of focusing the WRONG asset. Two expressions of one question,
 * three lines apart, drift immediately; this is the one expression.
 */
const ROW = '.rp-al-row';

/** The rows of one list, in DOM order — the one instrument both halves of this pair count on. */
function rowsIn(list: HTMLElement): readonly HTMLElement[] {
	return [...list.querySelectorAll<HTMLElement>(ROW)];
}

/**
 * The position of the row naming `assetId`, or `null` when this surface is not drawing one.
 *
 * `CSS.escape` for `AssetRow`'s own reason: an asset id is `z.string().min(1)` in the
 * frontmatter schema, so a hand-authored one holding a quote or a backslash builds an invalid
 * selector and `querySelector` THROWS rather than missing.
 *
 * `null` covers three real states rather than a defensive arm — the row is inside a shelf this
 * search has filtered out, the catalogue read has not answered, or `shell` is not mounted —
 * and every one of them means the same thing to the caller: there is no neighbour to go to.
 */
export function rowPositionOf(shell: HTMLElement | null, assetId: string): RowPosition | null {
	const row = shell?.querySelector<HTMLElement>(`[data-asset-id="${CSS.escape(assetId)}"]`) ?? null;
	const list = row?.closest<HTMLElement>(ROWS) ?? null;
	if (list === null || row === null) return null;
	return { list, index: rowsIn(list).indexOf(row) };
}


/**
 * §3.5's post-deletion destination: the row that now occupies the deleted row's index, then
 * the previous surviving row, then `fallback` — which is the search field, and which the spec
 * calls "every remaining case rather than a rare one".
 *
 * **The shelf's own heading is deliberately NOT a step in this chain**, and §3.5 removed it
 * for a reason worth keeping where the code is: the heading is only reached once the deleted
 * asset was the shelf's LAST row, and precisely then the shelf is empty — §3.2 renders a
 * zero-count declared shelf as a non-interactive `<h3>` and drops an undeclared one
 * altogether, so the step landed nowhere in the one case that reaches it.
 *
 * `index` then `index - 1` is one expression rather than a length test: `rows[index]` is
 * `undefined` exactly when the deleted row was last, and `rows[index - 1]` is `undefined`
 * exactly when the list is now empty, so the two `??` arms ARE the two clauses §3.5 states.
 *
 * `isLaidOut` guards the destination for `focusWithin`'s reason: a neighbour inside a shelf
 * the user has since collapsed is in the DOM and not on screen, and `focus()` on it silently
 * does nothing, stranding the caret on `<body>` with the panel already withdrawn.
 */
export function focusRowAt(position: RowPosition | null, fallback: HTMLElement | null): void {
	// A disconnected list is a shelf that emptied out of existence — see `RowPosition`.
	if (position === null || !position.list.isConnected) {
		fallback?.focus();
		return;
	}
	const rows = rowsIn(position.list);
	const target = rows[position.index] ?? rows[position.index - 1] ?? null;
	if (target !== null && isLaidOut(target, null)) target.focus();
	else fallback?.focus();
}
