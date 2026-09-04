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
