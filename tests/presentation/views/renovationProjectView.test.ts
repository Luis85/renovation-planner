/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { installObsidianDom } from '../../helpers/dom';
import { RENOVATION_PROJECT_VIEW, type RenovationProjectView } from '../../../src/presentation/views/RenovationProjectView';
import { t } from '../../../src/presentation/i18n/strings';
import { makeView } from '../../helpers/workspace';

installObsidianDom();

describe('the renovation project view', () => {
	let subject: RenovationProjectView;

	beforeEach(() => {
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
	 * `styles/chrome.css` hides Obsidian's view header for THIS view only, keyed on the
	 * persisted type — a string CSS cannot import. This is the check that pairs the
	 * selector to the constant, so renaming the type cannot silently leave the header
	 * visible (or, worse, hide some other plugin's).
	 */
	it('keys the hidden view header on this view type', () => {
		const chrome = readFileSync('styles/chrome.css', 'utf8');

		expect(chrome).toContain(`[data-type="${RENOVATION_PROJECT_VIEW}"]`);
	});
});
