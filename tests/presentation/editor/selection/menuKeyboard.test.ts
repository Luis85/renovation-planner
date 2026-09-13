// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { menuNavigation } from '../../../../src/presentation/editor/selection/menuKeyboard';

afterEach(() => { document.body.replaceChildren(); });

function menu(): HTMLElement {
	const root = document.body.appendChild(document.createElement('div'));
	for (const name of ['first', 'second']) { const item = root.appendChild(document.createElement('button')); item.setAttribute('role', 'menuitem'); item.textContent = name; }
	return root;
}
function press(root: HTMLElement, key: string, close: () => void): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
	root.addEventListener('keydown', listener => menuNavigation(listener, '[role="menuitem"]', close), { once: true });
	root.dispatchEvent(event);
	return event;
}

it('leaves a key that is not a menu key to the browser and moves nothing', () => {
	const root = menu(), close = vi.fn<() => void>(), first = root.querySelector('button');
	first?.focus();
	const event = press(root, 'a', close);
	expect(event.defaultPrevented).toBe(false);
	expect(close).not.toHaveBeenCalled();
	expect(document.activeElement).toBe(first);
});

it('closes on Escape and steps focus on ArrowDown', () => {
	const root = menu(), close = vi.fn<() => void>();
	expect(press(root, 'ArrowDown', close).defaultPrevented).toBe(true);
	expect(document.activeElement?.textContent).toBe('first');
	expect(press(root, 'Escape', close).defaultPrevented).toBe(true);
	expect(close).toHaveBeenCalledOnce();
});
