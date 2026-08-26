/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installObsidianDom } from '../../helpers/dom';
import { RENOVATION_PROJECT_VIEW, type RenovationProjectView } from '../../../src/presentation/views/RenovationProjectView';
import { t } from '../../../src/presentation/i18n/strings';
import { makeView } from '../../helpers/makeRenovationProjectView';
// Regular type imports rather than an inline dynamic-import type annotation: oxlint's
// `consistent-type-imports` forbids that form, and `noInlineConfig` means there is no
// suppression for it. These are the module SHAPES the two wrappers below spread.
import type * as VueModule from 'vue';
import type * as PiniaModule from 'pinia';

/**
 * Both modules are wrapped rather than replaced: the real `createApp` and `createPinia`
 * run, and the wrapper records what they returned. That is what lets the two claims ADR-004
 * actually makes be checked — that the app created on open is the one unmounted on close,
 * and that each view gets its OWN Pinia rather than a shared singleton. Neither is visible
 * in the DOM: an app left mounted and an app unmounted leave the same empty pane behind.
 */
const { apps, pinias } = vi.hoisted(() => ({ apps: [] as { unmount: () => void }[], pinias: [] as unknown[] }));

vi.mock('vue', async (importOriginal) => {
	const vue = await importOriginal<typeof VueModule>();

	return {
		...vue,
		createApp: (...args: Parameters<typeof vue.createApp>) => {
			const app = vue.createApp(...args);
			apps.push(app);
			return app;
		},
	};
});

vi.mock('pinia', async (importOriginal) => {
	const pinia = await importOriginal<typeof PiniaModule>();

	return {
		...pinia,
		createPinia: () => {
			const store = pinia.createPinia();
			pinias.push(store);
			return store;
		},
	};
});

installObsidianDom();

describe('the renovation project view', () => {
	let subject: RenovationProjectView;

	beforeEach(() => {
		apps.length = 0;
		pinias.length = 0;
		subject = makeView();
	});

	/**
	 * The view TYPE is persisted in the workspace layout, so it is data: renaming it orphans
	 * every leaf a user already has open. Asserted as a literal rather than against the
	 * exported constant, which would only prove the file agrees with itself.
	 */
	it('answers the persisted view type', () => {
		expect(subject.getViewType()).toBe('renovation-project');
		expect(RENOVATION_PROJECT_VIEW).toBe('renovation-project');
	});

	// Display text through the string table — the subject is that the view is wired
	// through `tr()`; the copy itself is en.ts's to own and its lint's to case.
	it('has a display name and an icon', () => {
		expect(subject.getDisplayText()).toBe(t('en', 'view.project.name'));
		expect(subject.getIcon()).not.toBe('');
	});

	it('draws one mount point into the content pane', async () => {
		await subject.onOpen();

		expect(subject.contentEl.querySelectorAll('.renovation-planner-view')).toHaveLength(1);
	});

	/**
	 * Obsidian keeps the leaf and reuses the view, so a second open must not stack a second
	 * tree — which is what a mount that appends without emptying does, and what a Vue app
	 * mounted twice into the same pane would do more expensively.
	 */
	it('does not stack a second tree when reopened', async () => {
		await subject.onOpen();
		await subject.onOpen();

		expect(subject.contentEl.querySelectorAll('.renovation-planner-view')).toHaveLength(1);
	});

	it('empties the content pane on close', async () => {
		await subject.onOpen();
		await subject.onClose();

		expect(subject.contentEl.children).toHaveLength(0);
	});

	/**
	 * `contentEl`, not `containerEl`: the outer element carries Obsidian's own view chrome —
	 * the header and the tab actions — and emptying it takes those with it. The fake nests
	 * the two the way the app does, so a view that reached for the wrong one fails here.
	 * The header asserted below is the fake's OWN `.view-header`, real chrome rather than a
	 * manually appended stand-in — the same element `styles/chrome.css` hides.
	 */
	it('leaves the view chrome alone', async () => {
		const chrome = subject.containerEl.appendChild(document.createElement('div'));
		const header = subject.containerEl.querySelector('.view-header');
		expect(header).not.toBeNull();

		await subject.onOpen();
		await subject.onClose();

		expect(chrome.parentElement).toBe(subject.containerEl);
		expect(subject.containerEl.querySelector('.view-header')).toBe(header);
	});

	/**
	 * `styles/chrome.css` matches `.workspace-leaf-content[data-type="…"] .view-header`, and
	 * `styles/view.css` gives `contentEl`'s child its height through the chain that starts at
	 * `.view-content` — Obsidian's own class on `contentEl`. Neither can be looked at in the
	 * harness (or matched by a real selector here) unless the fake carries the same class,
	 * attribute and nesting Obsidian's own `ItemView` does.
	 */
	it('nests the header and content pane the way Obsidian does', () => {
		expect(subject.containerEl.classList.contains('workspace-leaf-content')).toBe(true);
		expect(subject.containerEl.dataset.type).toBe(RENOVATION_PROJECT_VIEW);
		expect(subject.contentEl.classList.contains('view-content')).toBe(true);

		const children = [...subject.containerEl.children];
		expect(children[0]?.classList.contains('view-header')).toBe(true);
		expect(children[1]).toBe(subject.contentEl);
	});

	/**
	 * The container class is what `styles/chrome.css` keys its `.view-content` padding
	 * reset on, so it must be present after an open. Obsidian reuses the view, so a
	 * second open must not have to depend on the class being added twice — `addClass`
	 * is set-membership, and that is what survives here.
	 */
	it('marks its container for the padding reset', async () => {
		await subject.onOpen();
		await subject.onOpen();

		expect(subject.containerEl.classList.contains('renovation-planner-container')).toBe(true);
	});

	/**
	 * `styles/chrome.css` hides Obsidian's view header and resets the content pane's
	 * padding for THIS view only — one selector keyed on the persisted type, one on the
	 * class `onOpen` adds to `containerEl`. Both are strings CSS cannot import. This is
	 * the check that pairs each selector to its constant, so renaming either cannot
	 * silently leave chrome visible (or, worse, restyle some other plugin's pane).
	 */
	it('keys the hidden view header on this view type', () => {
		const chrome = readFileSync('styles/chrome.css', 'utf8');

		expect(chrome).toContain(`[data-type="${RENOVATION_PROJECT_VIEW}"]`);
		expect(chrome).toContain('.renovation-planner-container .view-content');
	});
});

describe('the Vue lifecycle', () => {
	let subject: RenovationProjectView;

	beforeEach(() => {
		apps.length = 0;
		pinias.length = 0;
		subject = makeView();
	});

	it('mounts one app into the content pane on open', async () => {
		await subject.onOpen();

		expect(apps).toHaveLength(1);
		expect(subject.contentEl.querySelectorAll('.renovation-planner-view')).toHaveLength(1);
	});

	/**
	 * ADR-004's actual claim: an isolated app per `ItemView`, not one long-lived app shared
	 * across views. A shared Pinia would let two open leaves mutate each other's state,
	 * which is invisible until the second leaf exists.
	 */
	it('gives each view its own Pinia instance', async () => {
		await subject.onOpen();
		await makeView().onOpen();

		expect(pinias).toHaveLength(2);
		expect(pinias[0]).not.toBe(pinias[1]);
	});

	// Unmount, not merely empty: an app left mounted keeps its effects and watchers alive
	// against a tree nobody can see, and both outcomes leave the same empty pane.
	it('unmounts the app it created on close', async () => {
		await subject.onOpen();
		const unmount = vi.spyOn(apps[0], 'unmount');

		await subject.onClose();

		expect(unmount).toHaveBeenCalledTimes(1);
		expect(subject.contentEl.children).toHaveLength(0);
	});

	// Obsidian may close a leaf whose view never opened; nothing here may throw on it.
	it('does nothing when closed without having opened', async () => {
		await expect(subject.onClose()).resolves.toBeUndefined();

		expect(apps).toEqual([]);
	});
});
