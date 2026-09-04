/**
 * jsdom lays nothing out: every element reports `clientWidth`/`clientHeight` of 0 and
 * there is no `ResizeObserver` at all. The Plan Editor sizes its Konva stage from both, so
 * without these two a mounted stage is 0×0 and every assertion about what it contains is
 * made against a scene that could not have drawn.
 *
 * Deliberately CONTROLLABLE rather than automatic. The stub does not invent a size on its
 * own — a test says when a resize happened and to what, the same way `FakeWorkspace` makes
 * a test fire `onLayoutReady` explicitly. A fake that resized by itself would make the
 * ORDER of measure-then-observe untestable, and that order is what a real pane exercises.
 */
const observers = new Set<{ callback: () => void; elements: Set<Element> }>();

export function installResizeObserver(): void {
	const globals = globalThis as unknown as Record<string, unknown>;
	if (globals.ResizeObserver !== undefined) return;

	globals.ResizeObserver = class {
		private readonly entry: { callback: () => void; elements: Set<Element> };

		constructor(callback: () => void) {
			this.entry = { callback, elements: new Set() };
			observers.add(this.entry);
		}

		observe(element: Element): void {
			this.entry.elements.add(element);
		}

		unobserve(element: Element): void {
			this.entry.elements.delete(element);
		}

		disconnect(): void {
			// Removed from the registry, not merely emptied: `resizeTo` below iterates live
			// observers, and a disconnected one that still received callbacks would hide
			// exactly the leak `onBeforeUnmount` exists to prevent.
			observers.delete(this.entry);
		}
	};
}

/** How many observers are currently connected — the leak check for a repeated mount. */
export function connectedObservers(): number {
	return observers.size;
}

/**
 * Give `element` a layout size and tell every observer watching it. Both halves matter:
 * the size is what the component reads, and the callback is what makes it read.
 */
export function resizeTo(element: HTMLElement, width: number, height: number): void {
	Object.defineProperty(element, 'clientWidth', { value: width, configurable: true });
	Object.defineProperty(element, 'clientHeight', { value: height, configurable: true });
	for (const observer of observers) {
		if (observer.elements.has(element)) observer.callback();
	}
}

/**
 * Make `clientWidth` answer `width(el)` for every element until `restore()` — the one way to
 * give a component's root a width BEFORE its `onMounted` reads it, since the element does not
 * exist for `resizeTo` to size until then. jsdom declares the getter on `Element.prototype`
 * (verified below with `Object.getOwnPropertyDescriptor` rather than assumed), which is what
 * lets one override answer for every element rather than needing one per node.
 *
 * [[The fake ResizeObserver hides removal of the mount-time measurement]]: the fake observer in
 * this module deliberately fires only through `resizeTo`, and every jsdom mount path calls
 * `resizeTo` AFTER mounting — so a case that only ever resizes post-mount cannot tell the
 * mount-time `measure()` call apart from the later observer callback supplying the same width.
 * This is the other way to give a root a size, ahead of either.
 */
export function clientWidthFor(width: (el: Element) => number): () => void {
	const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth') as PropertyDescriptor;
	Object.defineProperty(Element.prototype, 'clientWidth', {
		configurable: true,
		get(this: Element): number {
			return width(this);
		},
	});
	return () => Object.defineProperty(Element.prototype, 'clientWidth', descriptor);
}

/** `getBoundingClientRect` is what the camera measures a pointer against. */
export function placeAt(element: HTMLElement, left: number, top: number, width: number, height: number): void {
	element.getBoundingClientRect = () =>
		({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top }) as DOMRect;
}
