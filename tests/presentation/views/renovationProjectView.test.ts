/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { installObsidianDom } from '../../helpers/dom';
import { RENOVATION_PROJECT_VIEW, RenovationProjectView } from '../../../src/presentation/views/RenovationProjectView';
import { FakeLeaf } from '../../helpers/workspace';

installObsidianDom();

const view = () => new RenovationProjectView(new FakeLeaf() as never);

describe('the renovation project view', () => {
	let subject: RenovationProjectView;

	beforeEach(() => {
		subject = view();
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

	it('has a display name and an icon', () => {
		expect(subject.getDisplayText()).toBe('Renovation project');
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
	 */
	it('leaves the view chrome alone', async () => {
		const chrome = subject.containerEl.appendChild(document.createElement('div'));

		await subject.onOpen();
		await subject.onClose();

		expect(chrome.parentElement).toBe(subject.containerEl);
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
