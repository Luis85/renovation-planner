/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { Notice } from './obsidian-mock';

describe('the Notice fake', () => {
	it('nests a notice inside a notice container, the way Obsidian does', () => {
		const notice = new Notice('hello');
		expect(notice.containerEl.classList.contains('notice')).toBe(true);
		expect(notice.containerEl.parentElement?.classList.contains('notice-container')).toBe(true);
		expect(notice.messageEl.textContent).toBe('hello');
		expect(notice.containerEl.isConnected).toBe(true);
	});

	it('records the duration it was constructed with', () => {
		expect(new Notice('a', 0).duration).toBe(0);
	});

	it('keeps every instance, so a test can assert what a caller passed', () => {
		Notice.constructed.length = 0;
		const notice = new Notice('a', 0);
		expect(Notice.constructed.at(-1)).toBe(notice);
		expect(Notice.constructed.at(-1)?.duration).toBe(0);
	});

	it('disconnects the element on hide, which is what frees a slot', () => {
		const notice = new Notice('a', 0);
		notice.hide();
		expect(notice.containerEl.isConnected).toBe(false);
	});

	it('still records every message for the call sites that assert on that', () => {
		Notice.shown.length = 0;
		const notice = new Notice('recorded');
		expect(notice.message).toBe('recorded');
		expect(Notice.shown).toEqual(['recorded']);
	});
});
