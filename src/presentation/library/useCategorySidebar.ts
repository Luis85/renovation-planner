import { computed, onBeforeUnmount, onMounted, onUpdated, ref, type Ref } from 'vue';
import type { LibraryLayout } from './libraryBrowse';
import { isLaidOut } from './shelfFocus';

/**
 * Whether AD18-R18's category sidebar shows, and what the funnel says about it.
 *
 * **Two layers, and the breakpoint lives in only one of them.**
 * - The funnel's press is leaf-local and deliberately not view state. Until the first press,
 *   the sidebar is WANTED in Grid (board 01) and whenever a filter holds, and not over an
 *   unfiltered List, which keeps the List exactly as it was.
 * - While nothing has been pressed, the sidebar is AUTO, and `styles/asset-library-grid.css`
 *   withdraws an auto sidebar below §7's `rp-al (width < 35rem)` rung. There, 10rem is a third
 *   of a sidebar leaf, so the funnel is how a user reaches the sidebar. A press is an explicit
 *   answer, so it is never overruled by width.
 *
 * **What the funnel reports is asked of the DOM, never of a breakpoint**, which is §6.2's own
 * rule for the narrow swap: the width that decides is a CONTAINER query, and repeating it in
 * script would be a second spelling of one number. `shown` is `isLaidOut` over the rendered
 * sidebar, re-asked after every render of the root and whenever the pane is resized, so
 * `aria-expanded` stays truthful through a width change nobody pressed anything for, and
 * through §7's selection swap, which hides the sidebar with the shelves.
 *
 * A press toggles what is SHOWN, not what was wanted: a narrow pane that withdrew a wanted
 * sidebar opens it on the first press rather than appearing to do nothing.
 */
export function useCategorySidebar(shell: Ref<HTMLElement | null>, layout: Ref<LibraryLayout>, category: Ref<string>) {
	const pressed = ref<boolean | null>(null);
	const wanted = computed(() => pressed.value ?? (layout.value === 'grid' || category.value !== ''));
	const auto = computed(() => pressed.value === null);
	const shown = ref(false);

	function measure(): void {
		const sidebar = shell.value?.querySelector<HTMLElement>('.rp-al-categories') ?? null;
		shown.value = sidebar !== null && isLaidOut(sidebar, shell.value);
	}

	// jsdom has no `ResizeObserver`, and a pane that is not resized needs none: every state
	// change re-renders the root and `onUpdated` re-asks. Obsidian always has one.
	let observer: ResizeObserver | null = null;
	onMounted(() => {
		measure();
		if (typeof ResizeObserver !== 'function') return;
		observer = new ResizeObserver(measure);
		// Mounted: the root's own element is always drawn, so the ref is set.
		observer.observe(shell.value as HTMLElement);
	});
	onUpdated(measure);
	onBeforeUnmount(() => observer?.disconnect());

	function toggle(): void {
		pressed.value = !shown.value;
	}

	return { wanted, auto, shown, toggle };
}
