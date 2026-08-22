/**
 * @vitest-environment jsdom
 *
 * The check that keeps the harness alive. `npm run harness` is deliberately outside
 * `npm run check` — it draws and asserts nothing — so without this the page rots
 * silently: the bundle still builds, and the mount throws in a browser nobody opened.
 *
 * It asserts the FRAME and the plumbing, never appearance. Appearance is a live vault's
 * answer.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { mountHarness } from '../harness/mount';
import { drawSchemeToggle } from '../harness/theme';

/**
 * Pulled from the real file rather than retyped, so this test agrees with `chrome.css`
 * itself and not with a copy of it — a retyped selector only proves the test agrees with
 * itself. Comments are stripped first: the file's own header comment has no `{`, but
 * relying on that would make the extraction correct by accident.
 */
function chromeHeaderSelector(): string {
	const withoutComments = readFileSync('styles/chrome.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
	return withoutComments.slice(0, withoutComments.indexOf('{')).trim();
}

beforeEach(() => {
	document.body.innerHTML = '';
	document.body.className = '';
});

describe('the browser harness', () => {
	it('mounts the real view inside a leaf frame', () => {
		const { leafEl, view } = mountHarness(document.body);

		expect(leafEl.classList.contains('rp-harness-leaf')).toBe(true);
		expect(view.containerEl.parentElement).toBe(leafEl);
		// The view's own first draw ran: what a browser shows is the view, not the frame.
		expect(view.contentEl.querySelector('.renovation-planner-view')).not.toBeNull();
	});

	/**
	 * `styles/chrome.css` hides Obsidian's view header by matching
	 * `.workspace-leaf-content[data-type="…"] .view-header`. The harness's mounted DOM has
	 * to satisfy that selector itself for the rule to be lookable-at in the tool built for
	 * looking — matched against the selector read from the file, not a copy of it.
	 */
	it('gives the mounted DOM what styles/chrome.css selects', () => {
		const { view } = mountHarness(document.body);

		const header = view.containerEl.querySelector('.view-header');

		expect(header).not.toBeNull();
		expect(header?.matches(chromeHeaderSelector())).toBe(true);
	});

	it('empties the root, so a second mount does not stack', () => {
		mountHarness(document.body);
		mountHarness(document.body);

		expect(document.body.querySelectorAll('.rp-harness-leaf')).toHaveLength(1);
	});

	// The mount installs Obsidian's DOM extensions, which a browser has none of. If this
	// regressed, every render call would throw on the real page and nothing else here would
	// notice — the suite installs them in every other file itself.
	it('installs the Obsidian DOM extensions the render code calls', () => {
		mountHarness(document.body);

		expect(typeof document.body.createDiv).toBe('function');
		expect(typeof document.body.empty).toBe('function');
	});

	it('switches the scheme classes Obsidian defines its palette under', () => {
		mountHarness(document.body);
		drawSchemeToggle();

		expect(document.body.classList.contains('theme-dark')).toBe(true);

		const toggle = document.body.querySelector<HTMLElement>('.rp-harness-scheme');
		toggle?.click();

		expect(document.body.classList.contains('theme-light')).toBe(true);
		expect(document.body.classList.contains('theme-dark')).toBe(false);
	});

	// `applyPlatform` is deliberately NOT asserted here: the property that matters —
	// that it works BEFORE the extensions are installed — is not reachable from this
	// file, because a case above has already installed them on the shared prototype.
	// `platform.test.ts` holds the strictly stronger version of that check.
});
