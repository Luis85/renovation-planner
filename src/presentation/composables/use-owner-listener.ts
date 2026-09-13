/**
 * Adds `listener` to the DOCUMENT or WINDOW that owns `element`, and answers the function that
 * removes it. `document` and `window` are the main window's in an Obsidian pop-out leaf, where
 * the element lives in another document entirely — so a listener added there never hears the
 * pop-out. `CanvasContextMenu.vue` and `useDimensionObstacles.ts` already resolve through the
 * element; this is that rule as one function. Nothing enforces it: a caller that registers on
 * the global `document`/`window` instead is caught by no lint rule and no test, only by a
 * pop-out case written against that caller.
 */
export function ownerWindowOf(element: Element): Window {
	// `defaultView` is `null` only for a document no window shows; every caller asks from
	// `onMounted` on a rendered element, so the arm is unreachable and is not written.
	return element.ownerDocument.defaultView as Window;
}

export function listenOnOwner(element: Element, target: 'document' | 'window', type: string, listener: EventListener, options?: AddEventListenerOptions): () => void {
	const host: EventTarget = target === 'document' ? element.ownerDocument : ownerWindowOf(element);
	host.addEventListener(type, listener, options);
	return () => host.removeEventListener(type, listener, options);
}
