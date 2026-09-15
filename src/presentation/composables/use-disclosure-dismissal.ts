import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import { listenOnOwner } from './use-owner-listener';

/**
 * A `<details>` menu that closes on a press anywhere outside it and on a plain Escape, handing focus back to its
 * summary — the Plan Editor's View menu and the asset designer's. The press is heard in CAPTURE, so a canvas's own
 * `.stop` cannot hide it, on the document that OWNS the menu, which in a pop-out leaf is not the plugin's
 * `document`. Answers the keydown handler the template binds on the `<details>`.
 *
 * **Precondition: the `<details>` this ref names must be rendered for the whole life of the mounted
 * component** — never behind a `v-if`/`v-show` on it or a wrapper around it. `onMounted` and the
 * outside-press handler both cast `disclosure.value` to non-null, which is safe only under that.
 */
export function useDisclosureDismissal(disclosure: Readonly<Ref<HTMLDetailsElement | null>>): (event: KeyboardEvent) => void {
	function outside(event: Event): void {
		const menu = disclosure.value as HTMLDetailsElement;
		if (menu.open && !menu.contains(event.target as Node)) menu.open = false;
	}
	let stopOutside: (() => void) | null = null;
	onMounted(() => { stopOutside = listenOnOwner(disclosure.value as HTMLDetailsElement, 'document', 'pointerdown', outside, { capture: true }); });
	onBeforeUnmount(() => { stopOutside?.(); stopOutside = null; });
	return (event: KeyboardEvent): void => {
		if (event.key !== 'Escape') return;
		event.stopPropagation();
		if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !disclosure.value) return;
		event.preventDefault();
		disclosure.value.open = false;
		disclosure.value.querySelector('summary')?.focus();
	};
}
