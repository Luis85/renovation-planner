// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { listenOnOwner, ownerWindowOf } from '../../../src/presentation/composables/use-owner-listener';

/** A REAL second document, the way a pop-out leaf has one: an iframe's. */
function popOut(): { element: HTMLElement; doc: Document; win: Window } {
	const frame = document.createElement('iframe');
	document.body.append(frame);
	const doc = frame.contentDocument as Document, win = frame.contentWindow as Window;
	const element = doc.createElement('div');
	doc.body.append(element);
	return { element, doc, win };
}

describe('listenOnOwner', () => {
	it('hears a press in the document that owns the element, not in the main one', () => {
		const { element, doc } = popOut();
		let heard = 0;
		const stop = listenOnOwner(element, 'document', 'pointerdown', () => { heard += 1; }, { capture: true });
		document.dispatchEvent(new Event('pointerdown'));
		expect(heard).toBe(0);
		doc.dispatchEvent(new Event('pointerdown'));
		expect(heard).toBe(1);
		stop();
		doc.dispatchEvent(new Event('pointerdown'));
		expect(heard).toBe(1);
	});

	it('hears a blur on the window that owns the element', () => {
		const { element, win } = popOut();
		let heard = 0;
		listenOnOwner(element, 'window', 'blur', () => { heard += 1; });
		window.dispatchEvent(new Event('blur'));
		expect(heard).toBe(0);
		win.dispatchEvent(new Event('blur'));
		expect(heard).toBe(1);
		expect(ownerWindowOf(element)).toBe(win);
	});
});
